/**
 * Integração com o FFmpeg: verificação do ambiente e montagem da linha de comando.
 *
 * Uma única execução do FFmpeg recebe os quadros PNG (com alfa) por stdin e gera, em paralelo:
 *   - .mov com alfa REAL: ProRes 4444 (yuva444p10le) ou PNG-in-MOV (rgba, sem perdas)
 *   - .mp4 H.264 yuv420p sobre fundo verde #00FF00 sólido (chroma key)
 * Opcionalmente mixa os cues de som (adelay + amix) e os inclui nos dois arquivos.
 */
import { spawn, spawnSync } from 'node:child_process';

export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

/** Verifica binário, versão, encoders e o filtro amix. Retorna { ok, version, problems[] }. */
export function checkFfmpeg() {
    const problems = [];
    const version = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
    if (version.error || version.status !== 0) {
        return { ok: false, version: null, problems: [`FFmpeg não encontrado (comando: "${FFMPEG}"). Instale e coloque no PATH ou defina FFMPEG_PATH.`] };
    }
    const first = version.stdout.split('\n')[0];
    const encoders = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout ?? '';
    for (const encoder of ['prores_ks', 'libx264', 'aac', 'png']) {
        if (!new RegExp(`\\b${encoder}\\b`).test(encoders)) problems.push(`Encoder ausente neste build do FFmpeg: ${encoder}`);
    }
    const amix = spawnSync(FFMPEG, ['-hide_banner', '-h', 'filter=amix'], { encoding: 'utf8' }).stdout ?? '';
    if (!/normalize/.test(amix)) problems.push('FFmpeg antigo: o filtro amix não tem a opção "normalize" (use FFmpeg 4.4 ou mais novo).');
    return { ok: problems.length === 0, version: first, problems };
}

/**
 * Monta os argumentos do FFmpeg.
 * @param {{width:number,height:number,fps:number,duration:number,
 *          outputs:{kind:'mov'|'mp4', path:string, movCodec?:'prores'|'png'}[],
 *          cues:{file:string, at:number, gain:number}[]}} o
 */
export function buildArgs({ width, height, fps, duration, outputs, cues = [] }) {
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-nostats',
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', 'pipe:0'];
    for (const cue of cues) args.push('-i', cue.file);

    const mov = outputs.find((o) => o.kind === 'mov');
    const mp4 = outputs.find((o) => o.kind === 'mp4');
    const graph = [];

    // ---- vídeo ----
    const srcs = [];
    if (mov) srcs.push('mov');
    if (mp4) srcs.push('mp4');
    if (srcs.length === 2) graph.push('[0:v]format=rgba,split=2[src_mov][src_mp4]');
    else graph.push(`[0:v]format=rgba[src_${srcs[0]}]`);

    if (mov) {
        graph.push(mov.movCodec === 'png' ? '[src_mov]format=rgba[vmov]' : '[src_mov]format=yuva444p10le[vmov]');
    }
    if (mp4) {
        // Fundo #00FF00 sólido + overlay do quadro RGBA; conversão explícita RGB→YUV em BT.709 (limited range)
        graph.push(`color=c=0x00FF00:s=${width}x${height}:r=${fps}[green]`);
        graph.push('[green][src_mp4]overlay=format=rgb:shortest=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[vmp4]');
    }

    // ---- áudio (opcional) ----
    const hasAudio = cues.length > 0;
    if (hasAudio) {
        cues.forEach((cue, i) => {
            const ms = Math.max(0, Math.round(cue.at * 1000));
            graph.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${cue.gain.toFixed(3)}[c${i}]`);
        });
        const inputs = cues.map((_, i) => `[c${i}]`).join('');
        graph.push(`${inputs}amix=inputs=${cues.length}:duration=longest:normalize=0,apad,atrim=0:${duration.toFixed(3)},asetpts=N/SR/TB[amix]`);
        if (mov && mp4) graph.push('[amix]asplit=2[amov][amp4]');
    }
    const audioLabel = (kind) => (mov && mp4 ? (kind === 'mov' ? '[amov]' : '[amp4]') : '[amix]');

    args.push('-filter_complex', graph.join(';'));

    if (mov) {
        args.push('-map', '[vmov]');
        if (hasAudio) args.push('-map', audioLabel('mov'));
        if (mov.movCodec === 'png') args.push('-c:v', 'png', '-pix_fmt', 'rgba');
        else args.push('-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', '-qscale:v', '4');
        if (hasAudio) args.push('-c:a', 'pcm_s16le');
        args.push('-r', String(fps), mov.path);
    }
    if (mp4) {
        args.push('-map', '[vmp4]');
        if (hasAudio) args.push('-map', audioLabel('mp4'));
        args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv');
        if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
        args.push('-movflags', '+faststart', '-r', String(fps), mp4.path);
    }
    return args;
}

/** Inicia o FFmpeg e devolve { stdin, done } — `done` resolve ao terminar com sucesso, rejeita com o stderr. */
export function startFfmpeg(args) {
    const child = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    child.stdin.on('error', () => { /* EPIPE se o FFmpeg morrer: o erro real vem do `done` */ });
    const done = new Promise((resolve, reject) => {
        child.on('error', (error) => reject(new Error(`Não foi possível iniciar o FFmpeg: ${error.message}`)));
        child.on('close', (code, signal) => {
            if (code === 0) resolve();
            else reject(new Error(signal ? `FFmpeg interrompido (${signal})` : `FFmpeg falhou (código ${code}):\n${stderr.trim()}`));
        });
    });
    return { child, stdin: child.stdin, done };
}

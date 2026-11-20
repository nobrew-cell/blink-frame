/**
 * Renderizador headless: abre o template no Chromium (fundo transparente), avança quadro a quadro
 * (t = frame / fps), captura cada quadro como PNG com alfa e envia ao FFmpeg.
 *
 * Determinismo: o motor é função pura de `t` (sem timers/transitions), então não há relógio a "travar" —
 * cada quadro é pedido explicitamente via window.renderFrame(t). Como reforço, desativamos transitions/animations por CSS.
 */
import { chromium } from 'playwright';
import { once } from 'node:events';
import { mkdir, rm, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { buildArgs, startFfmpeg } from './ffmpeg.js';
import { update } from './jobs.js';

export const FPS_OPTIONS = [24, 25, 30, 50, 60];

function launchOptions() {
    const options = {
        headless: true,
        args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars', '--disable-lcd-text'],
    };
    // Sem baixar o Chromium: BF_BROWSER_CHANNEL=msedge (ou chrome) usa o navegador instalado no Windows.
    if (process.env.BF_BROWSER_CHANNEL) options.channel = process.env.BF_BROWSER_CHANNEL;
    if (process.env.BF_BROWSER_PATH) options.executablePath = process.env.BF_BROWSER_PATH;
    return options;
}

/** Resolve o arquivo de áudio de um cue: primeiro na pasta do template, depois em /public/sounds. */
async function resolveSound(name, { templatesDir, publicDir, slug }) {
    if (!/^[a-z0-9-]+$/.test(name)) return null;
    for (const file of [path.join(templatesDir, slug, 'sounds', `${name}.wav`), path.join(publicDir, 'sounds', `${name}.wav`)]) {
        if (await access(file).then(() => true, () => false)) return file;
    }
    return null;
}

const safeName = (text) =>
    String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * @param job  job (jobs.js) com { id, slug, size, fields, fps, formats, movCodec, sounds }
 * @param ctx  { baseUrl, outputDir, templatesDir, publicDir }
 */
export async function renderJob(job, { baseUrl, outputDir, templatesDir, publicDir }) {
    const jobDir = path.join(outputDir, job.id);
    await mkdir(jobDir, { recursive: true });

    let browser;
    let ffmpeg;
    job.abort = () => { ffmpeg?.child.kill('SIGKILL'); browser?.close().catch(() => {}); };

    try {
        update(job, { status: 'rendering', message: 'Abrindo o navegador…' });
        browser = await chromium.launch(launchOptions());
        const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
        page.on('pageerror', (error) => console.warn('[runner]', error.message));

        await page.goto(`${baseUrl}/runner.html?template=${encodeURIComponent(job.slug)}&size=${encodeURIComponent(job.size)}`);
        await page.waitForFunction(() => Boolean(window.__ready));
        await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;caret-color:transparent!important}' });

        // Aplica os campos (incluindo logo em data URL, grande demais para a URL) e lê as dimensões/duração finais
        const info = await page.evaluate(({ fields, size }) => window.__configure({ fields, size }), { fields: job.fields, size: job.size });
        const { width, height, duration } = info;
        await page.setViewportSize({ width, height });
        await page.evaluate(() => document.fonts.ready);

        const fps = job.fps;
        const total = Math.max(1, Math.round(duration * fps));
        update(job, { total, message: 'Desenhando cada quadro' });

        // Áudio
        const cues = [];
        if (job.sounds) {
            for (const cue of info.sounds) {
                const file = await resolveSound(cue.sound, { templatesDir, publicDir, slug: job.slug });
                if (file) cues.push({ file, at: cue.at, gain: cue.gain });
            }
        }

        const base = `${job.slug}${safeName(info.values.name ?? info.values.headline) ? '-' + safeName(info.values.name ?? info.values.headline) : ''}`;
        const outputs = [];
        if (job.formats.includes('mov')) outputs.push({ kind: 'mov', path: path.join(jobDir, `${base}-alfa.mov`), movCodec: job.movCodec });
        if (job.formats.includes('mp4')) outputs.push({ kind: 'mp4', path: path.join(jobDir, `${base}-chroma-verde.mp4`) });

        ffmpeg = startFfmpeg(buildArgs({ width, height, fps, duration, outputs, cues }));
        let ffmpegFailed = false;
        ffmpeg.done.catch(() => { ffmpegFailed = true; });

        for (let frame = 0; frame < total; frame++) {
            if (job.cancelled) throw new Error('Cancelado');
            if (ffmpegFailed) break;
            await page.evaluate((t) => window.renderFrame(t), frame / fps);
            const png = await page.screenshot({ type: 'png', omitBackground: true });
            if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, 'drain').catch(() => {});
            update(job, { frame: frame + 1, progress: ((frame + 1) / total) * 0.97 });
        }

        update(job, { status: 'encoding', message: 'Finalizando os arquivos…', progress: 0.97 });
        ffmpeg.stdin.end();
        await ffmpeg.done;
        await browser.close();
        browser = null;

        const files = {};
        for (const out of outputs) files[out.kind] = { path: out.path, name: path.basename(out.path), size: (await stat(out.path)).size };
        update(job, { status: 'done', progress: 1, message: 'Pronto', files });
    } catch (error) {
        await rm(jobDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    } finally {
        job.abort = null;
        await browser?.close().catch(() => {});
    }
}

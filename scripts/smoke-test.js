/**
 * Teste de ponta a ponta: renderiza cada template (curto, 15 fps), valida os arquivos com ffprobe
 * e confere o canal alfa do .mov e o fundo verde do .mp4.
 *   uso: npm run test:render
 */
import { spawnSync } from 'node:child_process';
import { startServer } from '../server/app.js';
import { FFPROBE, FFMPEG } from '../server/ffmpeg.js';

const { server, url } = await startServer({ port: 0 });
let failures = 0;
const check = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

const probe = (file) => JSON.parse(spawnSync(FFPROBE, ['-v', 'error', '-count_packets', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }).stdout).streams;

/** Lê o pixel (x,y) do primeiro quadro como RGBA. */
const pixel = (file, x, y, frame = 0) => {
    const r = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-an', '-vf', `select=eq(n\\,${frame}),format=rgba,crop=1:1:${x}:${y}`, '-frames:v', '1', '-f', 'rawvideo', '-'], { encoding: 'buffer' });
    return [...r.stdout.subarray(0, 4)];
};

const templates = await (await fetch(`${url}/api/templates`)).json();
console.log(`Templates encontrados: ${templates.map((t) => t.slug).join(', ')}`);

for (const tpl of templates) {
    console.log(`\n▶ ${tpl.slug}`);
    const started = Date.now();
    const { id } = await (await fetch(`${url}/api/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: tpl.slug, size: 'landscape', fields: {}, fps: 24, formats: ['mov', 'mp4'], sounds: true }),
    })).json();
    let job;
    do {
        await new Promise((r) => setTimeout(r, 500));
        job = await (await fetch(`${url}/api/render/${id}`)).json();
    } while (!['done', 'error', 'cancelled'].includes(job.status));
    check(job.status === 'done', `render concluído em ${((Date.now() - started) / 1000).toFixed(1)}s (${job.total} quadros) ${job.error ?? ''}`);
    if (job.status !== 'done') continue;

    for (const kind of ['mov', 'mp4']) {
        const res = await fetch(`${url}/api/download/${id}/${kind}`);
        check(res.ok, `download ${kind}: ${job.files[kind].name} (${(job.files[kind].size / 1024).toFixed(0)} KB)`);
    }
    // Arquivos ficam em output/<id>/
    const { readdirSync } = await import('node:fs');
    const dir = `output/${id}`;
    const files = readdirSync(dir);
    const mov = `${dir}/${files.find((f) => f.endsWith('.mov'))}`;
    const mp4 = `${dir}/${files.find((f) => f.endsWith('.mp4'))}`;
    const [mv, ma] = probe(mov);
    check(mv.codec_name === 'prores' && /^yuva444p(10|12)le$/.test(mv.pix_fmt), `mov: ${mv.codec_name} ${mv.pix_fmt} ${mv.width}x${mv.height}, ${mv.nb_read_packets} quadros`);
    check(ma?.codec_type === 'audio', 'mov: contém áudio');
    const [pv, pa] = probe(mp4);
    check(pv.codec_name === 'h264' && pv.pix_fmt === 'yuv420p', `mp4: ${pv.codec_name} ${pv.pix_fmt} ${pv.width}x${pv.height}`);
    check(pa?.codec_type === 'audio', 'mp4: contém áudio');
    const corner = pixel(mov, 2, 2, 0);
    check(corner[3] === 0, `mov: canto superior esquerdo transparente (alfa=${corner[3]})`);
    const green = pixel(mp4, 2, 2, 0);
    check(green[1] > 235 && green[0] < 40 && green[2] < 40, `mp4: fundo verde chroma (rgb=${green.slice(0, 3)})`);
}

server.close();
console.log(failures ? `\n${failures} falha(s).` : '\nTudo OK.');
process.exit(failures ? 1 : 0);

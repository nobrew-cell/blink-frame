/**
 * Servidor local do BlinkFrame (Express): vitrine, editor, API de templates e API de renderização.
 * Escuta SOMENTE em 127.0.0.1 — nada sai da sua máquina.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, rm, stat, mkdir } from 'node:fs/promises';
import { listTemplates, hasTemplate } from './templates.js';
import { createJob, getJob, snapshot, subscribe, enqueue, cancel } from './jobs.js';
import { renderJob, FPS_OPTIONS } from './renderer.js';
import { checkFfmpeg } from './ffmpeg.js';
import { createThumbs } from './thumbs.js';

/** Identifica esta execução do servidor: a intro animada aparece uma vez por execução. */
const BOOT_ID = `${Date.now().toString(36)}-${process.pid}`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const TEMPLATES = path.join(ROOT, 'templates');
const OUTPUT = path.join(ROOT, 'output');
const SIZES = ['landscape', 'vertical', 'square'];

/** Remove saídas com mais de 24 h. */
async function cleanOutput(maxAgeMs = 24 * 3600 * 1000) {
    await mkdir(OUTPUT, { recursive: true });
    for (const name of await readdir(OUTPUT)) {
        const dir = path.join(OUTPUT, name);
        const info = await stat(dir).catch(() => null);
        if (info && Date.now() - info.mtimeMs > maxAgeMs) await rm(dir, { recursive: true, force: true });
    }
}

export async function startServer({ port = 3000, host = '127.0.0.1' } = {}) {
    await cleanOutput();
    let baseUrl = `http://${host}:${port}`; // o Chromium headless acessa o próprio servidor por IPv4 explícito
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '16mb' })); // logos em data URL

    // Estáticos
    app.use('/templates', express.static(TEMPLATES, { etag: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
    // Fontes empacotadas (public/fonts) quase nunca mudam: cache longo. O restante do /public sempre revalida.
    app.use('/fonts', express.static(path.join(PUBLIC, 'fonts'), { maxAge: '7d' }));
    app.use(express.static(PUBLIC, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

    const thumbs = createThumbs({ templatesDir: TEMPLATES, publicDir: PUBLIC, cacheDir: path.join(ROOT, '.cache', 'thumbs'), baseUrl: () => baseUrl });
    // Miniaturas: o nome do arquivo muda quando o template muda, então o cache do navegador pode ser longo.
    app.use('/thumbs', express.static(path.join(ROOT, '.cache', 'thumbs'), { maxAge: '30d', immutable: true }));

    // API
    app.get('/api/thumb/:slug', async (req, res) => {
        try {
            const thumb = await thumbs.get(req.params.slug);
            if (!thumb) return res.status(404).json({ error: 'Template inexistente.' });
            res.json({ url: `/thumbs/${thumb.file}`, duration: thumb.duration });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
    app.get('/api/boot', (req, res) => res.json({ id: BOOT_ID }));
    app.get('/api/health', (req, res) => res.json({ ffmpeg: checkFfmpeg(), node: process.version, fps: FPS_OPTIONS }));
    app.get('/api/templates', async (req, res) => res.json(await listTemplates(TEMPLATES)));

    app.post('/api/render', async (req, res) => {
        const { template, size = 'landscape', fields = {}, fps = 30, formats = ['mov', 'mp4'], movCodec = 'prores', sounds = false } = req.body ?? {};
        if (!(await hasTemplate(TEMPLATES, template))) return res.status(400).json({ error: 'Template inexistente.' });
        if (!SIZES.includes(size)) return res.status(400).json({ error: 'Formato inválido.' });
        if (!FPS_OPTIONS.includes(Number(fps))) return res.status(400).json({ error: `FPS inválido (use ${FPS_OPTIONS.join(', ')}).` });
        if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return res.status(400).json({ error: 'Campos inválidos.' });
        const chosen = Array.isArray(formats) ? formats.filter((f) => ['mov', 'mp4'].includes(f)) : [];
        if (!chosen.length) return res.status(400).json({ error: 'Escolha ao menos um formato (mov ou mp4).' });
        const ff = checkFfmpeg();
        if (!ff.ok) return res.status(503).json({ error: ff.problems.join(' ') });

        const job = createJob({
            slug: template, size, fields, fps: Number(fps), formats: [...new Set(chosen)],
            movCodec: movCodec === 'png' ? 'png' : 'prores', sounds: Boolean(sounds),
        });
        enqueue(job, (j) => renderJob(j, { baseUrl, outputDir: OUTPUT, templatesDir: TEMPLATES, publicDir: PUBLIC }));
        res.status(202).json({ id: job.id });
    });

    app.get('/api/render/:id', (req, res) => {
        const job = getJob(req.params.id);
        return job ? res.json(snapshot(job)) : res.status(404).json({ error: 'Job não encontrado.' });
    });
    app.get('/api/render/:id/events', (req, res) => {
        const job = getJob(req.params.id);
        return job ? subscribe(job, req, res) : res.status(404).end();
    });
    app.post('/api/render/:id/cancel', (req, res) => {
        const job = getJob(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job não encontrado.' });
        cancel(job);
        res.json(snapshot(job));
    });
    app.get('/api/download/:id/:kind', (req, res) => {
        const job = getJob(req.params.id);
        const file = job?.files?.[req.params.kind];
        if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });
        res.download(file.path, file.name);
    });

    return new Promise((resolve, reject) => {
        const server = app.listen(port, host, () => {
            baseUrl = `http://${host}:${server.address().port}`;
            resolve({ server, port: server.address().port, url: baseUrl });
        });
        server.on('error', reject);
    });
}

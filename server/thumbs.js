/**
 * Miniaturas da vitrine: um JPEG do quadro de capa de cada template (fundo "cena"), gerado uma vez e guardado em
 * .cache/thumbs. O nome do arquivo inclui uma "versão" (data de modificação do template e do motor): editou o
 * template ou o motor? A miniatura é refeita sozinha. Assim a vitrine mostra imagens leves e só anima ao passar o mouse.
 */
import { chromium } from 'playwright';
import { mkdir, readdir, stat, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { hasTemplate } from './templates.js';

const IDLE_MS = 45_000;

function launchOptions() {
    const options = { headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars'] };
    if (process.env.BF_BROWSER_CHANNEL) options.channel = process.env.BF_BROWSER_CHANNEL;
    if (process.env.BF_BROWSER_PATH) options.executablePath = process.env.BF_BROWSER_PATH;
    return options;
}

async function newestMtime(dir, depth = 2) {
    let newest = 0;
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (depth > 0) newest = Math.max(newest, await newestMtime(full, depth - 1)); }
        else if (/\.(js|json|css|html)$/.test(entry.name)) newest = Math.max(newest, (await stat(full).catch(() => ({ mtimeMs: 0 }))).mtimeMs);
    }
    return newest;
}

export function createThumbs({ templatesDir, publicDir, cacheDir, baseUrl: getBaseUrl }) {
    const inflight = new Map();
    let chain = Promise.resolve();
    let browser = null;
    let idle = null;

    async function getBrowser() {
        clearTimeout(idle);
        browser ??= await chromium.launch(launchOptions());
        idle = setTimeout(() => { browser?.close().catch(() => {}); browser = null; }, IDLE_MS);
        idle.unref?.();
        return browser;
    }

    async function make(slug, key, file) {
        const context = await (await getBrowser()).newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.5 });
        try {
            const page = await context.newPage();
            await page.goto(`${getBaseUrl()}/runner.html?template=${encodeURIComponent(slug)}&bg=scene&size=landscape`);
            await page.waitForFunction(() => Boolean(window.__ready));
            await page.evaluate(() => window.__ready);
            await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
            const info = await page.evaluate(() => { const t = window.__template; window.renderFrame(t.thumbAt); return { duration: t.duration }; });
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(150);
            const jpeg = await page.screenshot({ type: 'jpeg', quality: 80 });
            await writeFile(path.join(cacheDir, file), jpeg);
            await writeFile(path.join(cacheDir, `${slug}-${key}.json`), JSON.stringify(info));
            return info;
        } finally { await context.close(); }
    }

    /** Devolve { file, duration } (gera se preciso; uma geração por vez). */
    async function get(slug) {
        if (!(await hasTemplate(templatesDir, slug))) return null;
        await mkdir(cacheDir, { recursive: true });
        const mtime = Math.max(await newestMtime(path.join(templatesDir, slug)), await newestMtime(path.join(publicDir, 'engine')));
        const key = crypto.createHash('sha1').update(String(mtime)).digest('hex').slice(0, 10);
        const file = `${slug}-${key}.jpg`;
        const sidecar = path.join(cacheDir, `${slug}-${key}.json`);
        const cached = await readFile(sidecar, 'utf8').then(JSON.parse, () => null);
        if (cached) return { file, duration: cached.duration };
        if (!inflight.has(file)) {
            const job = chain.then(() => make(slug, key, file)).then(async (info) => {
                // apaga versões antigas deste template
                for (const name of await readdir(cacheDir)) if (name.startsWith(`${slug}-`) && !name.startsWith(`${slug}-${key}.`)) await rm(path.join(cacheDir, name), { force: true });
                return { file, duration: info.duration };
            }).finally(() => inflight.delete(file));
            chain = job.catch(() => {});
            inflight.set(file, job);
        }
        return inflight.get(file);
    }

    return { get, close: () => browser?.close().catch(() => {}) };
}

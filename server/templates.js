/**
 * Registro dinâmico de templates.
 * Cada pasta em /templates com `meta.json` + `template.js` vira um modelo da vitrine — sem reiniciar o servidor.
 */
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

export const SLUG = /^[a-z0-9-]+$/;

export async function listTemplates(templatesDir) {
    const entries = await readdir(templatesDir, { withFileTypes: true }).catch(() => []);
    const found = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !SLUG.test(entry.name)) continue;
        const dir = path.join(templatesDir, entry.name);
        try {
            await access(path.join(dir, 'template.js'));
            const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8'));
            found.push({
                slug: entry.name,
                name: meta.name ?? entry.name,
                description: meta.description ?? '',
                category: meta.category ?? 'lower-third',
                tags: Array.isArray(meta.tags) ? meta.tags : [],
                order: Number.isFinite(meta.order) ? meta.order : 999,
            });
        } catch (error) {
            console.warn(`[templates] ignorando "${entry.name}": ${error.message}`);
        }
    }
    return found.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
}

export async function hasTemplate(templatesDir, slug) {
    if (typeof slug !== 'string' || !SLUG.test(slug)) return false;
    return access(path.join(templatesDir, slug, 'template.js')).then(() => true, () => false);
}

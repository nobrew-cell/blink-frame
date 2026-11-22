/**
 * Paletas e estilos reutilizáveis entre templates.
 *
 *   - Embutidas: /presets/palettes.json (edite o arquivo para acrescentar paletas; ver docs/GUIA-TEMPLATES.md)
 *   - Do usuário: localStorage `blinkframe:presets:v1`  +  exportação/importação em JSON
 *
 * Formato de um preset:  { id, name, kind: 'palette' | 'style', values: { chaveDoCampo: valor } }
 * As chaves são as dos campos padronizados (accent, textColor, plate, font, position, scale, speed…).
 * Ao aplicar, engine/schema.js (applyPreset) filtra e valida para o template aberto.
 */
import { PRESET_KINDS } from '/engine/schema.js';
import { storage } from './dom.js';

const KEY = 'blinkframe:presets:v1';
const MAX_PRESETS = 200;

const newId = () => globalThis.crypto?.randomUUID?.() ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Valida um preset vindo de fora (arquivo importado ou localStorage). Retorna null se inválido. */
export function cleanPreset(raw) {
    if (!raw || typeof raw !== 'object' || !(raw.kind in PRESET_KINDS) || typeof raw.name !== 'string') return null;
    const name = raw.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
    if (!name || typeof raw.values !== 'object' || raw.values === null || Array.isArray(raw.values)) return null;
    const values = {};
    for (const [key, value] of Object.entries(raw.values).slice(0, 40)) {
        if (!/^[A-Za-z0-9_]{1,40}$/.test(key)) continue;
        if (typeof value === 'string' && value.length <= 64) values[key] = value; // cor (#rrggbb) ou id de fonte/opção
        else if (typeof value === 'number' && Number.isFinite(value)) values[key] = value;
        else if (typeof value === 'boolean') values[key] = value;
    }
    return Object.keys(values).length ? { id: typeof raw.id === 'string' ? raw.id.slice(0, 64) : newId(), name, kind: raw.kind, values } : null;
}

export function loadUserPresets() {
    const list = storage.read(KEY, []);
    return Array.isArray(list) ? list.map(cleanPreset).filter(Boolean) : [];
}

const save = (list) => storage.write(KEY, list.slice(0, MAX_PRESETS));

export function addPreset({ name, kind, values }) {
    const preset = cleanPreset({ name, kind, values });
    if (!preset) return null;
    const list = loadUserPresets();
    save([...list, { ...preset, id: newId() }]);
    return preset;
}

export function removePreset(id) {
    save(loadUserPresets().filter((preset) => preset.id !== id));
}

export const exportPresetsJson = () => JSON.stringify({ app: 'BlinkFrame', version: 1, presets: loadUserPresets() }, null, 2);

/** Mescla presets de um JSON exportado. Retorna { added, skipped }. */
export function importPresetsJson(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
    const incoming = Array.isArray(data) ? data : data?.presets;
    if (!Array.isArray(incoming)) throw new Error('Não encontrei uma lista "presets" nesse arquivo.');
    const current = loadUserPresets();
    let added = 0;
    for (const raw of incoming) {
        const preset = cleanPreset(raw);
        if (!preset || current.length >= MAX_PRESETS) continue;
        current.push({ ...preset, id: newId() });
        added++;
    }
    save(current);
    return { added, skipped: incoming.length - added };
}

/** Paletas que acompanham o app (public/presets/palettes.json). Falha silenciosa: devolve []. */
export async function loadBuiltinPalettes() {
    try {
        const data = await (await fetch('/presets/palettes.json', { cache: 'no-cache' })).json();
        return (data.palettes ?? []).map((p) => cleanPreset({ ...p, kind: 'palette' })).filter(Boolean);
    } catch {
        return [];
    }
}

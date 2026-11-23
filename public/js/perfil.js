/** Meu espaço: favoritos, paletas e estilos salvos, preferências e backup. Tudo local (localStorage). */
import { buildCard } from './cards.js';
import { getFavorites, setFavorites, getPrefs, setPref, onStoreChange, PREF_DEFAULTS } from './shared/store.js';
import { loadUserPresets, removePreset, addPreset, loadBuiltinPalettes, exportPresetsJson, importPresetsJson, cleanPreset } from './editor/presets-store.js';
import { downloadText } from './editor/dom.js';

const panel = document.getElementById('panel');
const tabsBox = document.getElementById('tabs');

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
    return node;
};
const ICONS = {
    fav: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.8a4.3 4.3 0 017.5 2.5c0 5.6-7.5 10.2-7.5 10.2z"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1.1 1.5-2.3-.6-1.3.2-2.7 1.7-2.7H17a4 4 0 004-4A9 9 0 0012 3z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
    prefs: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    backup: '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>',
};
const svg = (key) => { const s = el('span', { className: 'ico' }); s.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`; return s; };

let templates = [];
let builtin = [];
const note = el('p', { className: 'me-note' });
note.setAttribute('aria-live', 'polite');
const say = (text) => { note.textContent = text; };

/* ---------- Favoritos ---------- */
function viewFavorites() {
    const slugs = getFavorites();
    const items = slugs.map((slug) => templates.find((t) => t.slug === slug)).filter(Boolean);
    if (!items.length) {
        return el('div', { className: 'me-empty' }, el('h2', { textContent: 'Nenhum favorito ainda' }),
            el('p', { textContent: 'Na vitrine, toque no coração de um modelo para guardá-lo aqui, bem à mão.' }),
            el('a', { className: 'btn', href: '/?vitrine', textContent: 'Ir para a vitrine →' }));
    }
    return el('div', {}, el('h2', { textContent: `Favoritos (${items.length})` }), el('div', { className: 'grid small' }, ...items.map(buildCard)));
}

/* ---------- Paletas e estilos ---------- */
const dots = (preset) => el('span', { className: 'preset-dots' }, ...['accent', 'textColor', 'plate'].map((k) => preset.values[k]).filter(Boolean).map((c) => el('i', { style: `background:${c}` })));

function presetRow(preset, removable) {
    const extra = Object.keys(preset.values).filter((k) => !['accent', 'textColor', 'plate'].includes(k)).length;
    const row = el('div', { className: 'preset-row' }, dots(preset),
        el('span', { className: 'preset-title' }, el('b', { textContent: preset.name }), el('small', { textContent: preset.kind === 'style' ? `Estilo · ${Object.keys(preset.values).length} ajustes` : 'Paleta' + (extra ? ` · +${extra}` : '') })));
    if (removable) {
        const remove = el('button', { type: 'button', className: 'btn-danger-soft', textContent: 'Excluir' });
        remove.addEventListener('click', () => { if (confirm(`Excluir "${preset.name}"?`)) { removePreset(preset.id); render(); } });
        row.append(remove);
    }
    return row;
}

function viewPresets() {
    const mine = loadUserPresets();
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]; fileInput.value = '';
        if (!file) return;
        try { const { added, skipped } = importPresetsJson(await file.text()); say(`${added} importado(s)${skipped ? `, ${skipped} inválido(s) ignorado(s)` : ''}.`); render(); } catch (error) { say(error.message); }
    });
    const exportBtn = el('button', { type: 'button', className: 'btn-soft', textContent: 'Exportar .json' });
    exportBtn.addEventListener('click', () => { if (!mine.length) return say('Nada para exportar ainda.'); downloadText('blinkframe-presets.json', exportPresetsJson()); say('Arquivo baixado.'); });
    const importBtn = el('button', { type: 'button', className: 'btn-soft', textContent: 'Importar .json', onclick: () => fileInput.click() });
    const group = (title, list, removable, empty) => el('div', { className: 'me-group' }, el('h3', { textContent: title }),
        list.length ? el('div', { className: 'preset-rows' }, ...list.map((p) => presetRow(p, removable))) : el('p', { className: 'me-hint', textContent: empty }));
    return el('div', {}, el('h2', { textContent: 'Paletas e estilos' }),
        el('p', { className: 'me-hint', textContent: 'Para criar um novo, abra um modelo no editor e use a seção "Paletas e estilos salvos". Aqui você organiza, exclui e leva para outro computador.' }),
        el('div', { className: 'me-actions' }, exportBtn, importBtn, fileInput),
        group('Suas paletas', mine.filter((p) => p.kind === 'palette'), true, 'Você ainda não salvou nenhuma paleta.'),
        group('Seus estilos', mine.filter((p) => p.kind === 'style'), true, 'Você ainda não salvou nenhum estilo (cores + fonte + posição + ajustes).'),
        group('Paletas do BlinkFrame', builtin, false, ''));
}

/* ---------- Preferências ---------- */
function row(label, hintText, control) { return el('label', { className: 'pref-row' }, el('span', {}, el('b', { textContent: label }), el('small', { textContent: hintText })), control); }
function viewPrefs() {
    const prefs = getPrefs();
    const start = el('select', {}, el('option', { value: 'vitrine', textContent: 'Vitrine' }), el('option', { value: 'espaco', textContent: 'Meu espaço' }));
    start.value = prefs.startPage;
    start.addEventListener('change', () => { setPref('startPage', start.value); say('Salvo.'); });
    const live = el('input', { type: 'checkbox', className: 'switch', checked: prefs.livePreviews });
    live.setAttribute('role', 'switch');
    live.addEventListener('change', () => { setPref('livePreviews', live.checked); say('Salvo.'); });
    const channel = el('input', { type: 'text', value: prefs.channel, maxLength: 40, placeholder: 'Ex.: Meu Canal' });
    channel.addEventListener('change', () => { setPref('channel', channel.value.trim()); say('Salvo.'); });
    return el('div', {}, el('h2', { textContent: 'Preferências' }),
        row('Página inicial', 'Qual tela abre quando você inicia o BlinkFrame', start),
        row('Prévias ao vivo na vitrine', 'Desligue se o computador ficar pesado: os cartões mostram só o quadro de capa', live),
        row('Nome do seu canal', 'Guardado para uso futuro nos modelos (ainda não preenche nada sozinho)', channel));
}

/* ---------- Backup ---------- */
function viewBackup() {
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    const exportBtn = el('button', { type: 'button', className: 'btn', textContent: 'Baixar backup completo' });
    exportBtn.addEventListener('click', () => {
        downloadText('blinkframe-meu-espaco.json', JSON.stringify({ app: 'BlinkFrame', kind: 'meu-espaco', version: 1, favorites: getFavorites(), prefs: getPrefs(), presets: loadUserPresets() }, null, 2));
        say('Backup baixado.');
    });
    const importBtn = el('button', { type: 'button', className: 'btn-soft', textContent: 'Restaurar de um backup', onclick: () => fileInput.click() });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]; fileInput.value = '';
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (data?.app !== 'BlinkFrame') throw new Error('Esse arquivo não é um backup do BlinkFrame.');
            if (Array.isArray(data.favorites)) setFavorites([...new Set([...getFavorites(), ...data.favorites.filter((s) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s))])]);
            const existing = new Set(loadUserPresets().map((p) => `${p.kind}|${p.name}|${JSON.stringify(p.values)}`));
            let added = 0;
            for (const raw of Array.isArray(data.presets) ? data.presets : []) { const p = cleanPreset(raw); if (p && !existing.has(`${p.kind}|${p.name}|${JSON.stringify(p.values)}`)) { addPreset(p); added++; } }
            if (data.prefs && typeof data.prefs === 'object') for (const key of Object.keys(PREF_DEFAULTS)) if (key in data.prefs) setPref(key, data.prefs[key]);
            say(`Backup restaurado (${added} preset(s) novo(s); favoritos mesclados).`);
            render();
        } catch (error) { say(error.message); }
    });
    return el('div', {}, el('h2', { textContent: 'Backup' }),
        el('p', { className: 'me-hint', textContent: 'Tudo fica só neste navegador. Baixe um arquivo para guardar ou levar para outro computador. Restaurar mescla com o que você já tem.' }),
        el('div', { className: 'me-actions' }, exportBtn, importBtn, fileInput));
}

const TABS = [
    { id: 'favoritos', label: 'Favoritos', icon: 'fav', view: viewFavorites },
    { id: 'paletas', label: 'Paletas e estilos', icon: 'palette', view: viewPresets },
    { id: 'preferencias', label: 'Preferências', icon: 'prefs', view: viewPrefs },
    { id: 'backup', label: 'Backup', icon: 'backup', view: viewBackup },
];
const current = () => TABS.find((t) => t.id === location.hash.slice(1)) ?? TABS[0];

function render() {
    const tab = current();
    tabsBox.replaceChildren(...TABS.map((t) => {
        const link = el('a', { href: `#${t.id}`, role: 'tab' }, svg(t.icon), t.label);
        link.setAttribute('aria-selected', String(t === tab));
        return link;
    }));
    note.textContent = '';
    panel.replaceChildren(tab.view(), note);
}

async function main() {
    [templates, builtin] = await Promise.all([fetch('/api/templates').then((r) => r.json()).catch(() => []), loadBuiltinPalettes()]);
    render();
    window.addEventListener('hashchange', render);
    // Favoritos mudam por coração em outra aba: redesenha só quando for a aba de favoritos
    onStoreChange(() => { if (current().id === 'favoritos') render(); });
}
main();

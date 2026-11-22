/**
 * Seção "Paletas e estilos salvos".
 *
 *   Paletas   embutidas (presets/palettes.json) + as suas; clicar aplica as cores no template aberto.
 *   Estilos   cores + fonte + posição + ajustes (tamanho, velocidade…) que você salvou; valem em qualquer template
 *             que tenha os mesmos campos (os que não existem são ignorados).
 *   Backup    exportar/importar tudo em um .json (para levar a outro computador ou compartilhar).
 *
 * Os presets do usuário ficam em localStorage (presets-store.js). Nada aqui conhece um template específico.
 */
import { applyPreset, capturePreset } from '/engine/schema.js';
import { el, downloadText } from './dom.js';
import { state, setValues } from './state.js';
import {
    addPreset, removePreset, loadUserPresets, loadBuiltinPalettes, exportPresetsJson, importPresetsJson,
} from './presets-store.js';

let builtin = [];
loadBuiltinPalettes().then((list) => { builtin = list; });

/** Primeiras cores do preset (destaque, texto, fundo) para a amostra visual. */
const swatches = (preset) => ['accent', 'textColor', 'plate'].map((key) => preset.values[key]).filter(Boolean);

function apply(preset) {
    setValues(applyPreset(state.schema, state.values, preset));
}

function chip(preset, { removable, refresh }) {
    const button = el('button', { type: 'button', className: 'preset-chip', title: preset.name });
    button.append(
        el('span', { className: 'preset-dots' }, ...swatches(preset).map((color) => el('i', { style: `background:${color}` }))),
        el('span', { className: 'preset-name', textContent: preset.name }),
    );
    button.addEventListener('click', () => apply(preset));
    if (!removable) return button;
    const remove = el('button', { type: 'button', className: 'preset-remove', title: `Excluir "${preset.name}"`, textContent: '×' });
    remove.setAttribute('aria-label', `Excluir ${preset.name}`);
    remove.addEventListener('click', () => { removePreset(preset.id); refresh(); });
    return el('div', { className: 'preset-item' }, button, remove);
}

export function createPresetsSection() {
    const root = el('div', { className: 'presets' });
    const message = el('p', { className: 'hint' });
    message.setAttribute('aria-live', 'polite');
    const say = (text) => { message.textContent = text; };

    const name = el('input', { type: 'text', maxLength: 40, placeholder: 'Nome (ex.: Meu canal)', autocomplete: 'off', spellcheck: false });
    name.setAttribute('aria-label', 'Nome do preset');
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });

    function save(kind) {
        const label = name.value.trim() || (kind === 'palette' ? 'Paleta' : 'Estilo');
        const values = capturePreset(state.schema, state.values, kind);
        if (!Object.keys(values).length) { say('Este template não tem campos para salvar nesse tipo de preset.'); return; }
        const saved = addPreset({ name: label, kind, values });
        if (!saved) { say('Não foi possível salvar o preset.'); return; }
        name.value = '';
        say(`${kind === 'palette' ? 'Paleta' : 'Estilo'} "${saved.name}" salvo.`);
        refresh();
    }

    const saveRow = el('div', { className: 'preset-save' },
        name,
        el('div', { className: 'preset-save-actions' },
            el('button', { type: 'button', className: 'btn-soft', textContent: 'Salvar paleta atual', onclick: () => save('palette') }),
            el('button', { type: 'button', className: 'btn-soft', textContent: 'Salvar estilo atual', onclick: () => save('style') })));
    name.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); save('palette'); } });

    const exportButton = el('button', { type: 'button', className: 'btn-link', textContent: 'Exportar .json' });
    exportButton.addEventListener('click', () => {
        if (!loadUserPresets().length) { say('Você ainda não salvou nenhum preset para exportar.'); return; }
        downloadText('blinkframe-presets.json', exportPresetsJson());
        say('Arquivo blinkframe-presets.json baixado.');
    });
    const importButton = el('button', { type: 'button', className: 'btn-link', textContent: 'Importar .json' });
    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
            const { added, skipped } = importPresetsJson(await file.text());
            say(`${added} preset(s) importado(s)${skipped ? `, ${skipped} ignorado(s) por estarem inválidos` : ''}.`);
            refresh();
        } catch (error) { say(error.message); }
    });

    const lists = el('div');
    function refresh() {
        const mine = loadUserPresets();
        const group = (title, items, removable) => (items.length
            ? el('div', { className: 'preset-group' }, el('span', { className: 'label', textContent: title }),
                el('div', { className: 'preset-list' }, ...items.map((preset) => chip(preset, { removable, refresh }))))
            : null);
        lists.replaceChildren(...[
            group('Paletas do BlinkFrame', builtin, false),
            group('Suas paletas', mine.filter((p) => p.kind === 'palette'), true),
            group('Seus estilos (cores, fonte, posição e ajustes)', mine.filter((p) => p.kind === 'style'), true),
        ].filter(Boolean));
    }

    // As paletas embutidas chegam por fetch: se ainda não carregaram, completa a lista quando chegarem.
    refresh();
    loadBuiltinPalettes().then((list) => { builtin = list; refresh(); });

    root.append(lists, el('span', { className: 'label', textContent: 'Salvar o que está na tela' }), saveRow,
        el('div', { className: 'preset-backup' }, exportButton, importButton, fileInput), message);
    return root;
}

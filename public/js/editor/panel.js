/**
 * Painel lateral: monta as seções dobráveis (estilo Photoshop) a partir do schema do template.
 *
 * Nada aqui conhece um template específico. Cada campo do schema já traz sua `section` (engine/schema.js) e o
 * painel só distribui: Formato e posição · Conteúdo · Ícone e mídia · Aparência · Paletas e estilos salvos ·
 * Transparência · Áudio e efeitos · Ajustes avançados.
 *
 * Todas as seções começam fechadas (veja `opened` abaixo).
 */
import { SECTIONS } from '/engine/schema.js';
import { el, storage } from './dom.js';
import { state, on, emit, setValues, setValue } from './state.js';
import { renderField, switchRow } from './controls.js';
import { createFormatPicker } from './format-picker.js';
import { createPresetsSection } from './presets-ui.js';

/** Ícones de cada seção (traço de 1.7, 20×20): ajudam a achar a função sem ler o rótulo. */
const SECTION_ICONS = {
    layout: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 9h14M9 9v7"/>',
    timing: '<circle cx="10" cy="11" r="6"/><path d="M10 8v3.5l2.2 1.3M8 2.5h4"/>',
    content: '<path d="M4 5h12M4 9h12M4 13h8"/>',
    media: '<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="M3.5 14.5l4-4 3 3 2-2 4 4"/>',
    appearance: '<path d="M10 3a7 7 0 100 14c1.2 0 1.6-.9 1.2-1.8-.5-1 .1-2.2 1.3-2.2H14a3 3 0 003-3A7 7 0 0010 3z"/><circle cx="6.7" cy="9" r=".8"/><circle cx="9" cy="6.3" r=".8"/><circle cx="12.5" cy="7" r=".8"/>',
    presets: '<path d="M10 3l2 4.2 4.6.6-3.3 3.2.8 4.6L10 13.4 5.9 15.6l.8-4.6L3.4 7.8 8 7.2z"/>',
    transparency: '<rect x="3.5" y="3.5" width="13" height="13" rx="2"/><path d="M3.5 10h13M10 3.5v13" opacity=".55"/><path d="M10 10h6.5v6.5H10z" fill="currentColor" stroke="none" opacity=".4"/>',
    audio: '<path d="M4 8v4h3l4 3V5L7 8H4z"/><path d="M14 7.5a3.5 3.5 0 010 5"/>',
    advanced: '<path d="M4 6h7M15 6h1M4 14h1M9 14h7"/><circle cx="13" cy="6" r="2"/><circle cx="7" cy="14" r="2"/>',
};
const sectionIcon = (id) => {
    const span = el('span', { className: 'acc-icon' });
    span.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SECTION_ICONS[id] ?? SECTION_ICONS.advanced}</svg>`;
    return span;
};

// Todas as seções começam FECHADAS; a pessoa abre o que quer editar. O que ela abriu fica aberto enquanto o editor
// estiver aberto (reconstruir o painel após aplicar um preset não fecha nada), mas não é lembrado entre visitas.
const opened = new Map();
const isOpen = (section) => opened.get(section.id) ?? false;
const rememberOpen = (id, open) => opened.set(id, open);

/** Seção dobrável: <details> nativo (teclado e leitores de tela funcionam sem código extra). */
function accordion(section, children, { badge } = {}) {
    const details = el('details', { className: 'acc' },
        el('summary', {}, sectionIcon(section.id), el('span', { className: 'acc-title', textContent: section.label }), badge ? el('span', { className: 'acc-badge', textContent: badge }) : null,
            el('span', { className: 'chev', ariaHidden: 'true' })),
        el('div', { className: 'acc-body' }, ...children));
    details.open = isOpen(section);
    details.dataset.section = section.id;
    details.addEventListener('toggle', () => rememberOpen(section.id, details.open));
    return details;
}

let soundSwitch = null;

/** Seção "Áudio e efeitos": interruptor dos sons do template (mixados no .mov e no .mp4). */
function audioControls() {
    const available = state.soundsAvailable > 0;
    soundSwitch = switchRow({
        id: 'sounds', label: 'Efeitos sonoros', checked: available && state.sounds, disabled: !available,
        hintText: available ? 'Mixados no .mov e no .mp4 exportados' : 'Este template não tem efeitos sonoros',
        onChange: (value) => { state.sounds = value; emit('change', { keys: ['sounds'] }); },
    });
    return soundSwitch;
}

/** Atualiza só o interruptor de som (a duração/quantidade de sons muda ao trocar a velocidade). */
function syncAudio() {
    const input = soundSwitch?.querySelector('input');
    if (!input) return;
    const available = state.soundsAvailable > 0;
    input.disabled = !available;
    input.checked = available && state.sounds;
    soundSwitch.classList.toggle('disabled', !available);
    soundSwitch.querySelector('small').textContent = available ? 'Mixados no .mov e no .mp4 exportados' : 'Este template não tem efeitos sonoros';
}

/** "Tudo visível": volta todas as opacidades por elemento a 100%. */
function transparencyReset(fields) {
    const button = el('button', { type: 'button', className: 'btn-link', textContent: 'Tudo visível' });
    button.addEventListener('click', () => setValues(Object.fromEntries(fields.map((f) => [f.key, f.default]))));
    return button;
}

function buildSections() {
    const bySection = Map.groupBy ? Map.groupBy(state.schema, (f) => f.section) : state.schema.reduce((map, f) => map.set(f.section, [...(map.get(f.section) ?? []), f]), new Map());
    const known = new Set(SECTIONS.map((s) => s.id));
    const orphans = state.schema.filter((f) => !known.has(f.section)); // seção desconhecida → avançado
    // Dentro de cada seção os interruptores (toggle) vão para o fim: primeiro o que se edita, depois o que se liga/desliga.
    const toggleLast = (list) => [...list.filter((f) => f.type !== 'toggle'), ...list.filter((f) => f.type === 'toggle')];
    const fieldsOf = (id) => toggleLast([...(bySection.get(id) ?? []), ...(id === 'advanced' ? orphans : [])]);
    const controlsOf = (id) => fieldsOf(id).map(renderField).filter(Boolean);

    const out = [];
    for (const section of SECTIONS) {
        let body = controlsOf(section.id);
        let badge;
        if (section.id === 'layout') body = [state.sizes.length > 1 ? createFormatPicker() : null, ...body].filter(Boolean);
        else if (section.id === 'presets') body = [createPresetsSection()];
        else if (section.id === 'audio') body = [audioControls(), ...body];
        else if (section.id === 'transparency' && body.length) body = [...body, transparencyReset(fieldsOf('transparency'))];
        if (!body.length) continue;
        out.push(accordion(section, body, { badge }));
    }
    return out;
}

export function initPanel(root) {
    const build = () => {
        const scroll = root.parentElement?.scrollTop ?? 0;
        root.replaceChildren(...buildSections());
        if (root.parentElement) root.parentElement.scrollTop = scroll; // reconstruir (preset, restaurar) não pula a rolagem
    };
    on('ready', build);
    on('change', ({ rebuild }) => { if (rebuild) build(); });
    on('configured', syncAudio);
    return { rebuild: build, setValue };
}

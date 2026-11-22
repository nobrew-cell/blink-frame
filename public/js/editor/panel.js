/**
 * Painel lateral: monta as seções dobráveis (estilo Photoshop) a partir do schema do template.
 *
 * Nada aqui conhece um template específico. Cada campo do schema já traz sua `section` (engine/schema.js) e o
 * painel só distribui: Formato e posição · Conteúdo · Ícone e mídia · Aparência · Paletas e estilos salvos ·
 * Transparência · Áudio e efeitos · Ajustes avançados.
 *
 * O que está aberto/fechado é lembrado entre visitas (localStorage `blinkframe:sections:v1`); na primeira visita
 * vale o `open` de cada seção em SECTIONS.
 */
import { SECTIONS } from '/engine/schema.js';
import { el, storage } from './dom.js';
import { state, on, emit, setValues, setValue } from './state.js';
import { renderField, switchRow } from './controls.js';
import { createFormatPicker } from './format-picker.js';
import { createPresetsSection } from './presets-ui.js';

const OPEN_KEY = 'blinkframe:sections:v1';

const openStates = () => storage.read(OPEN_KEY, {}) ?? {};
const isOpen = (section) => openStates()[section.id] ?? Boolean(section.open);
function rememberOpen(id, open) { storage.write(OPEN_KEY, { ...openStates(), [id]: open }); }

/** Seção dobrável: <details> nativo (teclado e leitores de tela funcionam sem código extra). */
function accordion(section, children, { badge } = {}) {
    const details = el('details', { className: 'acc' },
        el('summary', {}, el('span', { className: 'acc-title', textContent: section.label }), badge ? el('span', { className: 'acc-badge', textContent: badge }) : null,
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

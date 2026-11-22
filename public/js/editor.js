/**
 * Editor do BlinkFrame — ponto de entrada. Só orquestra; a lógica mora em js/editor/*:
 *
 *   state.js          estado único (valores, formato, tempo) + eventos
 *   output.js         quem desenha o estado: iframe do preview (e, no futuro, a saída ao vivo/OBS)
 *   panel.js          seções dobráveis geradas do schema  ←  controls.js · font-picker.js · format-picker.js
 *                     media-controls.js · presets-ui.js (+ presets-store.js)
 *   transport.js      play/pause, scrubber e teclado
 *   export-ui.js      POST /api/render + progresso (SSE)
 *
 * Fluxo: runner.html carrega o template → READY → o editor lê o schema (`window.__template.fields`), monta o painel
 * e passa a empurrar cada mudança de valor para o runner (debounce), que reconfigura e responde CONFIGURED.
 */
import { MSG } from '/engine/protocol.js';
import { $, debounce, storage } from './editor/dom.js';
import { state, on, emit, setValues } from './editor/state.js';
import { createRunnerOutput } from './editor/output.js';
import { initPanel } from './editor/panel.js';
import { initTransport } from './editor/transport.js';
import { initExport } from './editor/export-ui.js';

const params = new URLSearchParams(location.search);
state.slug = params.get('template') || '';
const DRAFT_KEY = `blinkframe:draft:${state.slug}`;

const frame = $('preview');
const output = createRunnerOutput(frame);

/* ---------- rascunho (por template) ---------- */
const saveDraft = debounce(() => storage.write(DRAFT_KEY, { values: state.values, size: state.size, sounds: state.sounds }), 300);

/* ---------- saída: empurra o estado para o runner ---------- */
const push = debounce(() => output.pushFields(state.values, state.size), 90);
on('change', () => { push(); saveDraft(); });

function showStageError(message) {
    const box = $('stage-error');
    box.hidden = false;
    box.textContent = `Não foi possível abrir este template: ${message}`;
}

output.listen((message) => {
    if (message?.type === MSG.READY) onReady();
    else if (message?.type === MSG.CONFIGURED) onConfigured();
    else if (message?.type === MSG.ERROR) showStageError(message.message);
});

function onReady() {
    const template = output.info();
    const draft = storage.read(DRAFT_KEY);
    state.meta = template.meta;
    state.schema = template.fields;
    state.sizes = template.sizes;
    state.defaults = Object.fromEntries(template.fields.map((f) => [f.key, f.default]));
    state.values = { ...state.defaults, ...(draft?.values ?? {}) };
    state.size = template.sizes.includes(draft?.size) ? draft.size : template.sizes[0];
    state.sounds = Boolean(draft?.sounds);
    state.ready = true;
    emit('ready');
    output.pushFields(state.values, state.size); // aplica o rascunho: o runner usa o mesmo estado do painel
}

function onConfigured() {
    const template = output.info();
    state.duration = template.duration;
    state.holdAt = template.holdAt;
    state.soundsAvailable = template.sounds.length;
    frame.style.width = `${template.width}px`;
    frame.style.height = `${template.height}px`;
    fitStage();
    emit('configured');
}

/* ---------- palco: escala do iframe para caber na área ---------- */
function fitStage() {
    let template;
    try { template = output.info(); } catch { return; }
    if (!template) return;
    const box = $('stage-box');
    const k = Math.max(0.05, Math.min((box.clientWidth - 48) / template.width, (box.clientHeight - 48) / template.height));
    frame.style.transform = `scale(${k})`;
    const wrap = $('stage-frame');
    wrap.style.width = `${template.width * k}px`;
    wrap.style.height = `${template.height * k}px`;
}
new ResizeObserver(fitStage).observe($('stage-box'));

/* ---------- fundo do preview ---------- */
function applyBackground() {
    try { output.setBackground(state.bg); } catch { /* runner ainda carregando */ }
    document.querySelectorAll('.bg-picker button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bg === state.bg)));
}
document.querySelectorAll('.bg-picker button').forEach((b) => b.addEventListener('click', () => { state.bg = b.dataset.bg; applyBackground(); }));

/* ---------- restaurar padrão ---------- */
$('reset').addEventListener('click', () => {
    storage.remove(DRAFT_KEY);
    state.size = state.sizes[0];
    state.sounds = false;
    setValues({ ...state.defaults });
});

/* ---------- inicialização ---------- */
async function init() {
    if (!state.slug) { location.href = '/'; return; }
    initPanel($('panel'));
    initTransport(output);
    initExport();
    const templates = await (await fetch('/api/templates')).json();
    const meta = templates.find((t) => t.slug === state.slug);
    if (!meta) { $('tpl-name').textContent = 'Template não encontrado'; showStageError(`"${state.slug}" não existe em /templates.`); return; }
    $('tpl-name').textContent = meta.name;
    document.title = `${meta.name} — BlinkFrame`;
    frame.addEventListener('load', applyBackground);
    frame.src = `/runner.html?template=${encodeURIComponent(state.slug)}&bg=${state.bg}`;
}
init().catch((error) => showStageError(error.message));

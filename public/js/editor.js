/**
 * Editor do BlinkFrame.
 *  - carrega o runner (iframe de mesma origem) com ?template=<slug>
 *  - gera os controles a partir do schema `fields` exposto em window.__template
 *  - dirige o relógio do preview (play/pause/scrubber): chama iframe.contentWindow.renderFrame(t)
 *  - exporta via POST /api/render com progresso por SSE
 */
import { FONTS } from '/engine/fonts.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const slug = params.get('template') || '';
const DRAFT_KEY = `blinkframe:draft:${slug}`;
const PREVIEW_FPS = 30;
const SIZE_LABELS = { landscape: ['16:9', 'Horizontal'], vertical: ['9:16', 'Vertical'], square: ['1:1', 'Quadrado'] };

const frame = $('preview');
const state = {
    schema: [], sizes: [], size: 'landscape', values: {}, defaults: {},
    duration: 1, t: 0, playing: true, bg: 'checker', soundsAvailable: 0, ready: false, last: performance.now(),
};

/* ---------- utilidades ---------- */
const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
};
const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const fmtSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const debounce = (fn, ms) => { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };
const store = {
    get() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } },
    set(value) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch { /* cota cheia ou bloqueado */ } },
    clear() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } },
};

/* ---------- comunicação com o runner ---------- */
const win = () => frame.contentWindow;
const pushFields = () => win().postMessage({ type: 'bf:fields', fields: state.values, size: state.size }, location.origin);
const schedulePush = debounce(() => { pushFields(); store.set({ values: state.values, size: state.size }); }, 90);

window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'bf:ready') onReady();
    else if (event.data?.type === 'bf:configured') onConfigured();
    else if (event.data?.type === 'bf:error') showStageError(event.data.message);
});

function showStageError(message) {
    const box = $('stage-error');
    box.hidden = false;
    box.textContent = `Não foi possível abrir este template: ${message}`;
}

function onReady() {
    const tpl = win().__template;
    state.schema = tpl.fields;
    state.sizes = tpl.sizes;
    state.defaults = Object.fromEntries(tpl.fields.map((f) => [f.key, f.default]));
    const draft = store.get();
    state.values = { ...state.defaults, ...(draft?.values ?? {}) };
    state.size = tpl.sizes.includes(draft?.size) ? draft.size : tpl.sizes[0];
    state.ready = true;
    buildSizes();
    buildControls();
    pushFields(); // aplica o rascunho (e garante que o runner use o mesmo estado do painel)
}

function onConfigured() {
    const tpl = win().__template;
    state.duration = tpl.duration;
    state.soundsAvailable = tpl.sounds.length;
    state.t = Math.min(state.t, state.duration);
    $('scrubber').max = String(state.duration);
    $('duration').textContent = fmtTime(state.duration);
    frame.style.width = `${tpl.width}px`;
    frame.style.height = `${tpl.height}px`;
    $('sounds-row').classList.toggle('disabled', state.soundsAvailable === 0);
    if (!state.soundsAvailable) $('sounds').checked = false;
    fitStage();
    drawFrame();
}

/* ---------- palco: escala do iframe ---------- */
function fitStage() {
    const tpl = win()?.__template;
    if (!tpl) return;
    const box = $('stage-box');
    const k = Math.min((box.clientWidth - 48) / tpl.width, (box.clientHeight - 48) / tpl.height);
    const scale = Math.max(0.05, k);
    frame.style.transform = `scale(${scale})`;
    const wrap = $('stage-frame');
    wrap.style.width = `${tpl.width * scale}px`;
    wrap.style.height = `${tpl.height * scale}px`;
}
new ResizeObserver(fitStage).observe($('stage-box'));

/* ---------- painel: formato ---------- */
function buildSizes() {
    const box = $('sizes');
    box.replaceChildren(...state.sizes.map((size) => {
        const [ratio, label] = SIZE_LABELS[size] ?? [size, size];
        const button = el('button', { type: 'button' }, ratio, el('small', { textContent: label }));
        button.setAttribute('aria-pressed', String(size === state.size));
        button.addEventListener('click', () => {
            state.size = size;
            [...box.children].forEach((b, i) => b.setAttribute('aria-pressed', String(state.sizes[i] === size)));
            schedulePush();
        });
        return button;
    }));
    box.hidden = state.sizes.length < 2;
    box.previousElementSibling.hidden = state.sizes.length < 2;
}

/* ---------- painel: controles gerados do schema ---------- */
const GROUPS = [
    ['Conteúdo', ['text', 'image']],
    ['Estilo', ['color', 'font', 'toggle']],
    ['Layout e movimento', ['select', 'range']],
];

function buildControls() {
    const root = $('controls');
    root.replaceChildren();
    for (const [title, types] of GROUPS) {
        const fields = state.schema.filter((f) => f.group !== 'opacity' && types.includes(f.type ?? 'text'));
        if (!fields.length) continue;
        root.append(el('section', { className: 'group' }, el('h2', { textContent: title }), ...fields.map(buildField)));
    }
    // Transparência: um controle de opacidade por elemento do template (ver opacityControls() no kit)
    const layers = state.schema.filter((f) => f.group === 'opacity');
    if (layers.length) {
        const reset = el('button', { type: 'button', className: 'link', textContent: 'Tudo visível' });
        reset.addEventListener('click', () => {
            for (const f of layers) state.values[f.key] = f.default;
            buildControls();
            schedulePush();
        });
        root.append(el('section', { className: 'group opacity-group' }, el('h2', { textContent: 'Transparência dos elementos' }),
            el('p', { className: 'hint', textContent: '100% = totalmente visível · 0% = escondido. Cada elemento é independente.' }),
            ...layers.map(buildField), reset));
    }
}

function set(key, value) {
    state.values[key] = value;
    schedulePush();
}

function buildField(field) {
    const id = `f-${field.key}`;
    const value = state.values[field.key];
    const wrap = el('div', { className: 'field' });
    const label = (extra) => el('label', { htmlFor: id }, field.label, extra ?? '');

    switch (field.type ?? 'text') {
        case 'text': {
            const input = el('input', { type: 'text', id, value, maxLength: field.maxLength ?? 200, autocomplete: 'off' });
            const counter = el('div', { className: 'count', textContent: `${value.length}/${field.maxLength ?? 200}` });
            input.addEventListener('input', () => { counter.textContent = `${input.value.length}/${field.maxLength ?? 200}`; set(field.key, input.value); });
            wrap.append(label(), input, counter);
            break;
        }
        case 'color': {
            const picker = el('input', { type: 'color', id, value });
            const hex = el('input', { type: 'text', value, maxLength: 7, spellcheck: false, ariaLabel: `${field.label} (hex)` });
            picker.addEventListener('input', () => { hex.value = picker.value; set(field.key, picker.value); });
            hex.addEventListener('input', () => {
                const v = hex.value.startsWith('#') ? hex.value : `#${hex.value}`;
                if (/^#[0-9a-f]{6}$/i.test(v)) { picker.value = v; set(field.key, v.toLowerCase()); }
            });
            wrap.append(label(), el('div', { className: 'color-row' }, picker, hex));
            break;
        }
        case 'font': {
            const select = el('select', { id }, ...FONTS.map((f) => el('option', { value: f.id, textContent: f.label })));
            select.value = value;
            select.addEventListener('change', () => set(field.key, select.value));
            wrap.append(label(), select);
            break;
        }
        case 'select': {
            const select = el('select', { id }, ...field.options.map((o) => el('option', { value: o.value, textContent: o.label })));
            select.value = value;
            select.addEventListener('change', () => set(field.key, select.value));
            wrap.append(label(), select);
            break;
        }
        case 'range': {
            const readout = el('span', { className: 'value' });
            const show = (v) => {
                readout.textContent = field.group === 'opacity' ? `${Math.round(Number(v) * 100)}%`
                    : field.key === 'speed' || field.key === 'scale' ? `${Number(v).toFixed(2)}×` : String(v);
            };
            const input = el('input', { type: 'range', id, min: field.min, max: field.max, step: field.step ?? 0.01, value });
            show(value);
            input.addEventListener('input', () => { show(input.value); set(field.key, Number(input.value)); });
            wrap.append(label(readout), input);
            break;
        }
        case 'toggle': {
            const input = el('input', { type: 'checkbox', id, checked: Boolean(value) });
            input.addEventListener('change', () => set(field.key, input.checked));
            return el('label', { className: 'toggle', htmlFor: id }, input, field.label);
        }
        case 'image': wrap.append(el('span', { className: 'label', textContent: field.label }), buildImageField(field)); break;
    }
    return wrap;
}

/** Upload de logo: redimensiona (máx. 512 px) e converte para PNG com alfa; SVG também é rasterizado. */
async function toLogoDataUrl(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const natural = Math.max(img.naturalWidth || 512, img.naturalHeight || 512);
        const k = Math.min(1, 512 / natural);
        const w = Math.max(1, Math.round((img.naturalWidth || 512) * k));
        const h = Math.max(1, Math.round((img.naturalHeight || 512) * k));
        const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
}

function buildImageField(field) {
    const thumb = el('div', { className: 'logo-thumb' });
    const paint = () => {
        const v = state.values[field.key];
        thumb.replaceChildren(v ? el('img', { src: v, alt: '' }) : el('span', { textContent: 'sem logo' }));
        remove.hidden = !v;
    };
    const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true });
    const pick = el('button', { type: 'button', className: 'file-btn', textContent: 'Escolher imagem…' });
    const remove = el('button', { type: 'button', className: 'link', textContent: 'Remover' });
    pick.addEventListener('click', () => input.click());
    remove.addEventListener('click', () => { set(field.key, ''); paint(); });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try { set(field.key, await toLogoDataUrl(file)); paint(); }
        catch { alert('Não foi possível ler essa imagem. Tente PNG, JPG, WebP ou SVG.'); }
    });
    paint();
    return el('div', { className: 'logo-field' }, thumb, el('div', { style: 'display:grid;gap:6px;justify-items:start' }, pick, remove), input);
}

$('reset').addEventListener('click', () => {
    store.clear();
    state.values = { ...state.defaults };
    state.size = state.sizes[0];
    buildSizes();
    buildControls();
    pushFields();
});

/* ---------- transporte: play / scrubber / teclado ---------- */
function drawFrame() {
    try { win().renderFrame(state.t); } catch { /* runner ainda carregando */ }
    $('time').textContent = fmtTime(state.t);
    $('frame').textContent = `quadro ${Math.round(state.t * PREVIEW_FPS)}`;
    $('scrubber').value = String(state.t);
}

function setPlaying(on) {
    state.playing = on;
    state.last = performance.now();
    $('play').textContent = on ? '❚❚' : '▶';
}

function tick(now) {
    if (state.playing && state.ready) {
        state.t += (now - state.last) / 1000;
        if (state.t >= state.duration) state.t %= state.duration; // loop
        drawFrame();
    }
    state.last = now;
    requestAnimationFrame(tick);
}

const step = (frames) => {
    setPlaying(false);
    state.t = Math.min(state.duration, Math.max(0, state.t + frames / PREVIEW_FPS));
    drawFrame();
};

$('play').addEventListener('click', () => setPlaying(!state.playing));
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('scrubber').addEventListener('input', (e) => { setPlaying(false); state.t = Number(e.target.value); drawFrame(); });
document.addEventListener('keydown', (e) => {
    if (e.target.closest('input[type="text"], select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -10 : -1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? 10 : 1); }
    else if (e.code === 'Home') { e.preventDefault(); setPlaying(false); state.t = 0; drawFrame(); }
});

/* ---------- fundo da prévia ---------- */
function applyBg() {
    try { win().document.body.dataset.bg = state.bg; } catch { /* ainda carregando */ }
    document.querySelectorAll('.bg-picker button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bg === state.bg)));
}
document.querySelectorAll('.bg-picker button').forEach((b) => b.addEventListener('click', () => { state.bg = b.dataset.bg; applyBg(); }));

/* ---------- exportação ---------- */
let currentEvents = null;
let currentJob = null;

function setJobUi({ message, progress = 0, sub = '', busy = true }) {
    $('job').hidden = false;
    $('job-msg').textContent = message;
    $('meter-fill').style.width = `${Math.round(progress * 100)}%`;
    $('meter').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    $('job-sub').textContent = sub;
    $('job-cancel').hidden = !busy;
    $('export').disabled = busy;
}

async function startExport() {
    const formats = [$('fmt-mov').checked && 'mov', $('fmt-mp4').checked && 'mp4'].filter(Boolean);
    if (!formats.length) { setJobUi({ message: 'Escolha ao menos um formato.', busy: false }); return; }
    $('downloads').replaceChildren();
    $('job-error').hidden = true;
    setJobUi({ message: 'Enviando…' });
    try {
        const res = await fetch('/api/render', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template: slug, size: state.size, fields: state.values, fps: Number($('fps').value), formats,
                movCodec: $('mov-codec').value, sounds: $('sounds').checked,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao iniciar a exportação.');
        currentJob = data.id;
        follow(data.id);
    } catch (error) {
        setJobUi({ message: 'Não foi possível exportar', busy: false });
        $('job-error').hidden = false;
        $('job-error').textContent = error.message;
    }
}

function follow(id) {
    currentEvents?.close();
    const events = new EventSource(`/api/render/${id}/events`);
    currentEvents = events;
    events.onmessage = (message) => {
        const job = JSON.parse(message.data);
        if (job.status === 'queued') setJobUi({ message: 'Na fila…', sub: job.queuePosition ? `${job.queuePosition} na frente` : '' });
        else if (job.status === 'rendering' || job.status === 'encoding') {
            const sub = job.total ? `quadro ${job.frame}/${job.total}${job.eta ? ` · ~${Math.ceil(job.eta)}s restantes` : ''}` : '';
            setJobUi({ message: job.message, progress: job.progress, sub });
        } else if (job.status === 'done') {
            events.close();
            setJobUi({ message: 'Pronto! Baixe seus arquivos:', progress: 1, busy: false });
            $('downloads').replaceChildren(...Object.entries(job.files).map(([kind, file]) =>
                el('a', { href: `/api/download/${job.id}/${kind}`, download: file.name },
                    el('span', {}, el('b', { textContent: `.${kind}` }), kind === 'mov' ? ' com alfa' : ' fundo verde'),
                    el('small', { textContent: fmtSize(file.size) }))));
        } else if (job.status === 'error') {
            events.close();
            setJobUi({ message: 'A exportação falhou', busy: false });
            $('job-error').hidden = false;
            $('job-error').textContent = job.error;
        } else if (job.status === 'cancelled') {
            events.close();
            setJobUi({ message: 'Exportação cancelada', busy: false });
        }
    };
    events.onerror = () => { /* o EventSource reconecta sozinho; o estado final chega no 1º evento */ };
}

$('export').addEventListener('click', startExport);
$('job-cancel').addEventListener('click', () => { if (currentJob) fetch(`/api/render/${currentJob}/cancel`, { method: 'POST' }); });

/* ---------- inicialização ---------- */
async function init() {
    if (!slug) { location.href = '/'; return; }
    const templates = await (await fetch('/api/templates')).json();
    const meta = templates.find((t) => t.slug === slug);
    if (!meta) { $('tpl-name').textContent = 'Template não encontrado'; showStageError(`"${slug}" não existe em /templates.`); return; }
    $('tpl-name').textContent = meta.name;
    document.title = `${meta.name} — BlinkFrame`;
    frame.addEventListener('load', applyBg);
    frame.src = `/runner.html?template=${encodeURIComponent(slug)}&bg=${state.bg}`;
    requestAnimationFrame(tick);
}
init().catch((error) => showStageError(error.message));

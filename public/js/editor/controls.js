/**
 * Renderizadores de controles: um por tipo de campo do schema (engine/schema.js).
 * Cada um lê o valor atual de `state.values` e grava com `setValue` — sem lógica específica de template.
 * Para criar um tipo novo: acrescente-o em FIELD_TYPES/sanitize (schema.js) e um renderizador em RENDERERS.
 */
import { el, svgIcon } from './dom.js';
import { state, setValue } from './state.js';
import { createFontPicker } from './font-picker.js';
import { imageControl, iconControl } from './media-controls.js';

const idOf = (f) => `f-${f.key}`;
const hint = (f) => (f.hint ? el('p', { className: 'hint', textContent: f.hint }) : null);
const head = (f, extra) => el('div', { className: 'field-head' }, el('label', { htmlFor: idOf(f), textContent: f.label }), extra ?? null);

/* ---------- texto ---------- */
function text(f) {
    const max = f.maxLength ?? 200;
    const value = state.values[f.key] ?? '';
    const input = el('input', { type: 'text', id: idOf(f), value, maxLength: max, autocomplete: 'off', spellcheck: false });
    const count = el('span', { className: 'count', textContent: `${value.length}/${max}` });
    input.addEventListener('input', () => { count.textContent = `${input.value.length}/${max}`; setValue(f.key, input.value); });
    return el('div', { className: 'field' }, head(f, count), input, hint(f));
}

/* ---------- cor (linha compacta: rótulo à esquerda, amostra + hex à direita) ---------- */
function color(f) {
    const value = state.values[f.key];
    const picker = el('input', { type: 'color', id: idOf(f), value });
    const hex = el('input', { type: 'text', value, maxLength: 7, spellcheck: false });
    hex.setAttribute('aria-label', `${f.label} (hexadecimal)`);
    picker.addEventListener('input', () => { hex.value = picker.value; setValue(f.key, picker.value); });
    hex.addEventListener('input', () => {
        const v = hex.value.startsWith('#') ? hex.value : `#${hex.value}`;
        if (/^#[0-9a-f]{6}$/i.test(v)) { picker.value = v; setValue(f.key, v.toLowerCase()); }
    });
    return el('div', { className: 'field field-row' }, el('label', { htmlFor: idOf(f), textContent: f.label }), el('div', { className: 'color-row' }, picker, hex));
}

/* ---------- fonte ---------- */
function font(f) {
    const picker = createFontPicker({ id: idOf(f), value: state.values[f.key], onChange: (v) => setValue(f.key, v) });
    return el('div', { className: 'field' }, head(f), picker);
}

/* ---------- segmentado (alinhamento, lado, poucas opções) ---------- */
function alignGlyph(kind) {
    const widths = [16, 10, 13];
    const bars = widths.map((w, i) => {
        const x = kind === 'left' ? 2 : kind === 'center' ? (24 - w) / 2 : 22 - w;
        return `<rect x="${x}" y="${1 + i * 5.4}" width="${w}" height="3" rx="1.5"/>`;
    });
    return svgIcon(bars.join(''), 20);
}
const sideGlyph = (kind) => svgIcon(kind === 'left'
    ? '<circle cx="6" cy="8" r="4.5"/><rect x="13" y="3" width="9" height="3" rx="1.5"/><rect x="13" y="9" width="6" height="3" rx="1.5"/>'
    : '<circle cx="18" cy="8" r="4.5"/><rect x="2" y="3" width="9" height="3" rx="1.5"/><rect x="2" y="9" width="6" height="3" rx="1.5"/>', 20);

function segmented(f, glyph) {
    const group = el('div', { className: 'seg', role: 'radiogroup' });
    group.setAttribute('aria-label', f.label);
    const paint = () => [...group.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === state.values[f.key])));
    for (const option of f.options) {
        const button = el('button', { type: 'button' }, glyph ? glyph(option.value) : null, el('span', { textContent: option.label }));
        button.setAttribute('role', 'radio');
        button.dataset.value = option.value;
        button.addEventListener('click', () => { setValue(f.key, option.value); paint(); });
        group.append(button);
    }
    paint();
    return el('div', { className: 'field' }, el('span', { className: 'label', textContent: f.label }), group, hint(f));
}

const align = (f) => segmented(f, alignGlyph);

function select(f) {
    if (f.control === 'segmented') return segmented(f, f.key.toLowerCase().endsWith('side') ? sideGlyph : null);
    const input = el('select', { id: idOf(f) }, ...f.options.map((o) => el('option', { value: o.value, textContent: o.label })));
    input.value = state.values[f.key];
    input.addEventListener('change', () => setValue(f.key, input.value));
    return el('div', { className: 'field' }, head(f), input, hint(f));
}

/* ---------- slider ---------- */
const FORMATS = {
    percent: (v) => `${Math.round(Number(v) * 100)}%`,
    multiplier: (v) => `${Number(v).toFixed(2).replace('.', ',')}×`,
    seconds: (v) => `${Number(v).toFixed(1).replace('.', ',')} s`,
    number: (v) => String(v).replace('.', ','),
};

function range(f) {
    const show = FORMATS[f.display] ?? FORMATS.number;
    const readout = el('span', { className: 'value', textContent: show(state.values[f.key]) });
    const input = el('input', { type: 'range', id: idOf(f), min: f.min, max: f.max, step: f.step ?? 0.01, value: state.values[f.key], title: 'Duplo clique restaura o padrão' });
    input.addEventListener('input', () => { readout.textContent = show(input.value); setValue(f.key, Number(input.value)); });
    input.addEventListener('dblclick', () => { input.value = f.default; input.dispatchEvent(new Event('input')); });
    return el('div', { className: 'field' }, head(f, readout), input, hint(f));
}

/* ---------- interruptor ---------- */
export function switchRow({ id, label, hintText, checked, disabled = false, onChange }) {
    const input = el('input', { type: 'checkbox', id, className: 'switch', checked, disabled });
    input.setAttribute('role', 'switch');
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { className: `switch-row${disabled ? ' disabled' : ''}`, htmlFor: id },
        el('span', { className: 'switch-text' }, el('b', { textContent: label }), hintText ? el('small', { textContent: hintText }) : null), input);
}

const toggle = (f) => switchRow({
    id: idOf(f), label: f.label, hintText: f.hint, checked: Boolean(state.values[f.key]), onChange: (v) => setValue(f.key, v),
});

const RENDERERS = { text, color, font, align, select, range, toggle, image: imageControl, icon: iconControl };

/** Controle de um campo do schema (ou null se o tipo não for conhecido). */
export const renderField = (f) => RENDERERS[f.type]?.(f) ?? null;

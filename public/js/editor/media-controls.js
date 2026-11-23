/** Controles de mídia: imagem (logo) e ícone (biblioteca + arquivo próprio). */
import { icons } from '/engine/icons.js';
import { el } from './dom.js';
import { state, setValue } from './state.js';

const MAX_SIDE = 512;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/** Lê PNG/JPG/WebP/SVG e devolve um PNG (data URL) com alfa, com no máximo 512 px no maior lado. */
export async function fileToDataUrl(file) {
    let blob = file;
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
        // SVG sem width/height não tem tamanho natural: deduz do viewBox para não sair pequeno/distorcido.
        const svg = new DOMParser().parseFromString(await file.text(), 'image/svg+xml').documentElement;
        if (svg.nodeName.toLowerCase() !== 'svg') throw new Error('SVG inválido');
        const viewBox = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
        let w = parseFloat(svg.getAttribute('width'));
        let h = parseFloat(svg.getAttribute('height'));
        if (!(w > 0 && h > 0)) [w, h] = viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0 ? [viewBox[2], viewBox[3]] : [MAX_SIDE, MAX_SIDE];
        if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const k = MAX_SIDE / Math.max(w, h);
        svg.setAttribute('width', String(Math.round(w * k)));
        svg.setAttribute('height', String(Math.round(h * k)));
        blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    }
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const natural = Math.max(img.naturalWidth || MAX_SIDE, img.naturalHeight || MAX_SIDE);
        const k = Math.min(1, MAX_SIDE / natural);
        const w = Math.max(1, Math.round((img.naturalWidth || MAX_SIDE) * k));
        const h = Math.max(1, Math.round((img.naturalHeight || MAX_SIDE) * k));
        const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Botão "Escolher…" + <input type=file> oculto. `onData(dataUrl)` recebe o resultado. */
function uploader(label, onData) {
    const input = el('input', { type: 'file', accept: ACCEPT, hidden: true });
    const button = el('button', { type: 'button', className: 'btn-soft', textContent: label });
    const error = el('p', { className: 'hint error', hidden: true, textContent: 'Não foi possível ler esse arquivo. Use PNG, JPG, WebP ou SVG.' });
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try { error.hidden = true; onData(await fileToDataUrl(file)); } catch { error.hidden = false; }
    });
    return { button, input, error };
}

const tile = (value, emptyText) => {
    const box = el('div', { className: 'media-tile' });
    if (!value) box.append(el('span', { textContent: emptyText }));
    else if (value.startsWith('data:')) box.append(el('img', { src: value, alt: '' }));
    else box.innerHTML = icons[value] ?? '';
    return box;
};

/** Imagem opcional (logo). */
export function imageControl(f) {
    const holder = el('div', { className: 'media-row' });
    const errorSlot = el('div');
    const paint = () => {
        const value = state.values[f.key];
        const up = uploader('Escolher imagem…', (data) => { setValue(f.key, data); paint(); });
        const remove = el('button', { type: 'button', className: 'btn-link', textContent: 'Remover', hidden: !value });
        remove.addEventListener('click', () => { setValue(f.key, ''); paint(); });
        holder.replaceChildren(tile(value, 'sem logo'), el('div', { className: 'media-actions' }, up.button, remove), up.input);
        errorSlot.replaceChildren(up.error);
    };
    paint();
    return el('div', { className: 'field' }, el('span', { className: 'label', textContent: f.label }), holder, errorSlot);
}

/** Ícone: grade de ícones da biblioteca + envio de arquivo próprio (SVG/PNG/JPG/WebP). */
export function iconControl(f) {
    const holder = el('div', { className: 'media-row' });
    const grid = el('div', { className: 'icon-grid', role: 'group' });
    grid.setAttribute('aria-label', `${f.label}: biblioteca`);
    const errorSlot = el('div');

    const paint = () => {
        const value = state.values[f.key];
        const up = uploader('Enviar ícone próprio…', (data) => { setValue(f.key, data); paint(); });
        const reset = el('button', { type: 'button', className: 'btn-link', textContent: 'Usar padrão', hidden: value === f.default });
        reset.addEventListener('click', () => { setValue(f.key, f.default); paint(); });
        holder.replaceChildren(tile(value, 'sem ícone'), el('div', { className: 'media-actions' }, up.button, reset), up.input);
        grid.replaceChildren(...(f.choices ?? []).map((id) => {
            const button = el('button', { type: 'button', className: 'icon-choice', title: id });
            button.innerHTML = icons[id] ?? '';
            button.setAttribute('aria-pressed', String(value === id));
            button.addEventListener('click', () => { setValue(f.key, id); paint(); });
            return button;
        }));
        errorSlot.replaceChildren(up.error);
    };
    paint();
    return el('div', { className: 'field' }, el('span', { className: 'label', textContent: f.label }), holder, grid, errorSlot,
        el('p', { className: 'hint', textContent: 'Arquivos enviados (SVG, PNG, JPG, WebP) mantêm as próprias cores.' }));
}

/** Várias imagens (ex.: logos de patrocinadores): miniaturas com × e botão para acrescentar, até `f.max`. */
export function imagesControl(f) {
    const max = f.max ?? 8;
    const holder = el('div', { className: 'images-grid' });
    const errorSlot = el('div');
    const paint = () => {
        const list = Array.isArray(state.values[f.key]) ? state.values[f.key] : [];
        const up = uploader(list.length ? 'Adicionar outra…' : 'Escolher imagens…', (data) => { setValue(f.key, [...list, data].slice(0, max)); paint(); });
        const cells = list.map((src, index) => {
            const remove = el('button', { type: 'button', className: 'image-remove', title: 'Remover', textContent: '×' });
            remove.setAttribute('aria-label', `Remover imagem ${index + 1}`);
            remove.addEventListener('click', () => { setValue(f.key, list.filter((_, i) => i !== index)); paint(); });
            return el('div', { className: 'image-cell' }, el('img', { src, alt: '' }), remove);
        });
        const actions = el('div', { className: 'media-actions' }, list.length < max ? up.button : el('span', { className: 'hint', textContent: `Máximo de ${max} imagens` }),
            list.length ? Object.assign(el('button', { type: 'button', className: 'btn-link', textContent: 'Remover todas' }), { onclick: () => { setValue(f.key, []); paint(); } }) : null);
        holder.replaceChildren(...cells, actions, up.input);
        errorSlot.replaceChildren(up.error);
    };
    paint();
    return el('div', { className: 'field' }, el('span', { className: 'label', textContent: f.label }), holder, errorSlot);
}

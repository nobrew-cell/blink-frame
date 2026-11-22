/** Seleção de formato: cartões com a forma do quadro, proporção, nome e uma legenda de contexto (onde usar). */
import { SIZE_META } from '/engine/schema.js';
import { el } from './dom.js';
import { state, setSize } from './state.js';

export function createFormatPicker() {
    const group = el('div', { className: 'fmt', role: 'radiogroup' });
    group.setAttribute('aria-label', 'Formato do vídeo');
    const caption = el('p', { className: 'hint fmt-caption' });
    caption.setAttribute('aria-live', 'polite');

    const paint = () => {
        [...group.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.size === state.size)));
        const meta = SIZE_META[state.size];
        caption.textContent = meta ? `${meta.ratio} · ${meta.hint}` : '';
    };

    for (const size of state.sizes) {
        const meta = SIZE_META[size] ?? { ratio: size, label: size };
        const button = el('button', { type: 'button', className: 'fmt-card' },
            el('span', { className: `fmt-shape ${size}`, ariaHidden: 'true' }),
            el('b', { textContent: meta.ratio }),
            el('small', { textContent: meta.label }));
        button.setAttribute('role', 'radio');
        button.dataset.size = size;
        button.addEventListener('click', () => { setSize(size); paint(); });
        group.append(button);
    }
    paint();
    return el('div', { className: 'field' }, el('span', { className: 'label', textContent: 'Formato' }), group, caption);
}

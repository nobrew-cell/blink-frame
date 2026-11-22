/**
 * Seletor de fontes com prévia: cada opção é escrita na própria fonte, agrupadas por categoria.
 * As fontes de prévia usam famílias "BF <id>" (não colidem com as fontes da interface) e só carregam
 * quando a lista é aberta pela primeira vez.
 */
import { FONTS, FONT_CATEGORIES, FONT_BASE } from '/engine/fonts.js';
import { el } from './dom.js';

const faces = new Map();

function loadPreview(font) {
    if (!faces.has(font.id)) {
        const file = font.files[400] ?? Object.values(font.files)[0];
        const face = new FontFace(`BF ${font.id}`, `url(${FONT_BASE}${file}) format('woff2')`, { display: 'swap' });
        faces.set(font.id, face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {}));
    }
    return faces.get(font.id);
}

const cssFamily = (font) => `"BF ${font.id}", system-ui, sans-serif`;
const byId = (id) => FONTS.find((font) => font.id === id) ?? FONTS[0];

export function createFontPicker({ id, value, onChange }) {
    let current = byId(value).id;
    const trigger = el('button', { type: 'button', className: 'font-trigger', id });
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const pop = el('div', { className: 'font-pop', hidden: true, tabIndex: -1 });
    pop.setAttribute('role', 'listbox');
    const wrap = el('div', { className: 'font-picker' }, trigger, pop);
    const options = new Map();

    for (const category of FONT_CATEGORIES) {
        const fonts = FONTS.filter((font) => font.category === category.id);
        if (!fonts.length) continue;
        pop.append(el('div', { className: 'font-group', textContent: category.label }));
        for (const font of fonts) {
            const option = el('button', { type: 'button', className: 'font-opt', tabIndex: -1, textContent: font.label });
            option.setAttribute('role', 'option');
            option.dataset.id = font.id;
            option.style.fontFamily = cssFamily(font);
            option.addEventListener('click', () => choose(font.id));
            options.set(font.id, option);
            pop.append(option);
        }
    }

    function paintTrigger() {
        const font = byId(current);
        loadPreview(font).then(() => { name.style.fontFamily = cssFamily(font); });
        const name = el('span', { className: 'font-name', textContent: font.label });
        name.style.fontFamily = cssFamily(font);
        trigger.replaceChildren(name, el('span', { className: 'chev', ariaHidden: 'true' }));
        for (const [fontId, option] of options) option.setAttribute('aria-selected', String(fontId === current));
    }

    function choose(fontId) {
        current = fontId;
        paintTrigger();
        close(true);
        onChange(fontId);
    }

    const visibleOptions = () => [...options.values()];
    /** Foca uma opção e a mantém visível rolando SÓ o popover (scrollIntoView/focus rolariam o painel e fechariam a lista). */
    const focusOption = (index, { center = false } = {}) => {
        const list = visibleOptions();
        const option = list[(index + list.length) % list.length];
        option.focus({ preventScroll: true });
        const top = option.offsetTop;
        const bottom = top + option.offsetHeight;
        if (center) pop.scrollTop = top - (pop.clientHeight - option.offsetHeight) / 2;
        else if (top < pop.scrollTop + 30) pop.scrollTop = Math.max(0, top - 30); // 30 px: cabeçalho do grupo
        else if (bottom > pop.scrollTop + pop.clientHeight) pop.scrollTop = bottom - pop.clientHeight + 6;
    };

    function position() {
        const rect = trigger.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        const openUp = below < 240 && above > below;
        const room = Math.max(160, Math.min(380, openUp ? above : below));
        Object.assign(pop.style, {
            left: `${rect.left}px`, width: `${rect.width}px`, maxHeight: `${room}px`,
            top: openUp ? 'auto' : `${rect.bottom + 6}px`, bottom: openUp ? `${window.innerHeight - rect.top + 6}px` : 'auto',
        });
    }

    const onOutside = (event) => { if (!wrap.contains(event.target)) close(false); };
    // Eventos de scroll são entregues no quadro seguinte: ignora os que chegam logo após abrir (rolagem feita ANTES do clique).
    let openedAt = 0;
    const onScroll = (event) => { if (!pop.contains(event.target) && performance.now() - openedAt > 200) close(false); };
    const onResize = () => close(false);

    function open() {
        if (!pop.hidden) return;
        FONTS.forEach(loadPreview);
        pop.hidden = false;
        openedAt = performance.now();
        trigger.setAttribute('aria-expanded', 'true');
        position();
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        focusOption([...options.keys()].indexOf(current), { center: true });
    }

    function close(refocus) {
        if (pop.hidden) return;
        pop.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onResize);
        if (refocus) trigger.focus();
    }

    trigger.addEventListener('click', () => (pop.hidden ? open() : close(true)));
    trigger.addEventListener('keydown', (event) => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
    });
    pop.addEventListener('keydown', (event) => {
        const list = visibleOptions();
        const index = list.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(index + 1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(index - 1); }
        else if (event.key === 'Home') { event.preventDefault(); focusOption(0); }
        else if (event.key === 'End') { event.preventDefault(); focusOption(list.length - 1); }
        else if (event.key === 'Escape') { event.preventDefault(); close(true); }
        else if (event.key === 'Tab') close(false);
    });

    paintTrigger();
    return wrap;
}

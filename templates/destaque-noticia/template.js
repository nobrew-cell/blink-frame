/**
 * Destaque / Notícia
 * Selo (AO VIVO com ponto pulsante) + manchete em até 2 linhas + linha de apoio "digitada".
 *
 * Linha do tempo (s):  0.00 selo · 0.25 manchete (wipe) · 0.50 brilho · 0.95 apoio (wipe) + digitação
 *                      6.10 saída reversa · 7.0 fim
 */
import { el, set, fit, field, controls, logoControls, opacityControls, typing, inOut, prog, ease } from '../../engine/kit.js';
import { anchor, backdrop, layoutWidth, wipe, typewriter, pulse, shine } from '../../engine/parts.js';

const fields = [
    field.text('tag', 'Selo', 'AO VIVO', { maxLength: 18 }),
    field.text('headline', 'Texto principal (manchete)', 'Prefeitura anuncia novo plano de mobilidade para o centro da cidade', { maxLength: 110 }),
    field.text('subtitle', 'Subtítulo (apoio)', 'São Paulo · Reportagem especial', { maxLength: 80 }),
    ...logoControls({ side: 'right' }),
    field.toggle('dot', 'Ponto pulsante no selo', true),
    ...controls({ accent: '#e11d2e', text: '#ffffff', plate: '#14161c', font: 'oswald', position: 'left' }),
    ...opacityControls([
        ['tag', 'Selo'], ['headPlate', 'Fundo da manchete'], ['headline', 'Manchete'], ['logo', 'Logo'],
        ['subPlate', 'Fundo da linha de apoio'], ['subtitle', 'Subtítulo'],
    ]),
];

const DURATION = 7;
const SUB_START = 1.05;

function setup(root, ctx) {
    const { values } = ctx;
    const position = values.position;
    const maxW = layoutWidth(ctx);
    const align = { left: 'flex-start', center: 'center', right: 'flex-end' }[position];
    const box = anchor(root, ctx);
    const col = el('div', { display: 'flex', flexDirection: 'column', alignItems: align, maxWidth: `${maxW}px` }, box);

    // Selo inclinado
    const tag = ctx.layer('tag', el('div', {
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 34px 10px 22px', background: 'var(--accent)',
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)', zIndex: 2,
    }, col));
    let dot = null;
    if (values.dot) dot = el('div', { width: '16px', height: '16px', borderRadius: '50%', background: '#fff', flex: 'none' }, tag);
    el('div', { font: '700 30px/1 var(--font)', letterSpacing: '0.08em', color: '#fff', whiteSpace: 'nowrap' }, tag, values.tag.toUpperCase());

    // Manchete
    const logoSize = 92;
    const hasLogo = Boolean(values.logo);
    const headPlate = el('div', {
        display: 'flex', alignItems: 'center', gap: '28px', padding: '22px 36px 24px 30px',
        maxWidth: `${maxW}px`, boxSizing: 'border-box',
    }, col);
    ctx.layer('headPlate', backdrop(headPlate, 'var(--plate)'));
    const textMax = maxW - 30 - 36 - (hasLogo ? logoSize + 28 : 0);
    const headline = ctx.layer('headline', el('div', {
        font: '700 56px/1.12 var(--font)', color: 'var(--text)', maxWidth: `${textMax}px`, overflowWrap: 'anywhere',
        textAlign: position === 'center' ? 'center' : position === 'right' ? 'right' : 'left',
    }, headPlate, values.headline));
    // Até 2 linhas: reduz a fonte até a altura caber em 2 linhas do tamanho atual
    let fontSize = 56;
    headline.style.fontSize = `${fontSize}px`;
    while (fontSize > 24 && headline.offsetHeight > Math.ceil(fontSize * 1.12 * 2) + 1) {
        fontSize -= 1;
        headline.style.fontSize = `${fontSize}px`;
    }
    if (hasLogo) {
        const logoBox = ctx.layer('logo', el('div', { width: `${logoSize}px`, height: `${logoSize}px`, flex: 'none', order: values.logoSide === 'left' ? -1 : 1 }, headPlate));
        const img = document.createElement('img');
        img.src = values.logo;
        set(img, { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
        logoBox.append(img);
    }

    // Linha de apoio
    const sub = el('div', {
        padding: '12px 34px 12px 30px', maxWidth: `${maxW}px`, boxSizing: 'border-box',
    }, col);
    const subText = typewriter(sub, {
        text: values.subtitle,
        styles: { font: '400 30px/1.2 var(--font)', color: '#fff', whiteSpace: 'nowrap', letterSpacing: '0.03em' },
        cps: 34, start: SUB_START + 0.1,
    });
    const subNode = ctx.layer('subtitle', sub.firstChild);
    ctx.layer('subPlate', backdrop(sub, 'var(--accent)'));
    fit(subNode, { maxWidth: maxW - 64, maxSize: 30, minSize: 14 });

    return {
        position, tag, dot, headPlate, headline, sub, subText,
        pulseDot: dot ? pulse(dot, { period: 1.2, fade: true }) : null,
        shimmer: shine(headPlate, { start: 0.6, end: 1.5 }),
    };
}

function render(t, s) {
    const p = (a, b, easing = ease.outCubic) => inOut(t, a, b, 6.1 + (a > 0.5 ? 0.15 : 0), 6.7 + (a > 0.5 ? 0.15 : 0), easing, ease.inCubic);

    s.tag.style.opacity = p(0, 0.45) > 0 ? 1 : 0;
    s.tag.style.transform = `translateX(${(s.position === 'right' ? 1 : -1) * (1 - p(0, 0.45, ease.outBack)) * 120}px)`;

    set(s.headPlate, { clipPath: wipe(s.position, p(0.25, 0.9, ease.outExpo)) });
    set(s.sub, { clipPath: wipe(s.position, p(SUB_START, 1.6, ease.outExpo)) });

    s.subText(t);
    if (s.pulseDot) s.pulseDot(t);
    s.shimmer(t);
}

export default {
    meta: { id: 'destaque-noticia' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 3,
    holdAt: 4.5, // legenda digitada por completo
    fonts: ['oswald'],
    sounds: (ctx) => [
        { at: 0, sound: 'whoosh-in', gain: 0.45 },
        { at: 0.3, sound: 'pop', gain: 0.3 },
        ...typing(SUB_START + 0.1, ctx.values.subtitle.length, 1 / 34, 0.4),
        { at: 6.15, sound: 'whoosh-out', gain: 0.4 },
    ],
    setup,
    render,
};

/**
 * Tela Final Minimalista (16:9)
 * Título com fio de destaque, duas molduras 16:9 (onde ficam os vídeos sugeridos do YouTube) com legenda, e um
 * círculo com o logo, anel girando e a chamada "Inscreva-se". Transparente: o vídeo aparece por trás (opcionalmente
 * escurecido para dar leitura).
 *
 * Linha do tempo (s):  0.00 escurece · 0.10 título · 0.30/0.45 molduras · 0.60 círculo · 0.9 anel · 1.2 legendas
 *                      PAUSA longa (padrão 8 s: telas finais costumam durar de 5 a 20 s) · 10.0 saída · 10.8 fim
 */
import { el, set, fit, field, controls, opacityControls, prog, ease, svgEl } from '../../engine/kit.js';
import { iconNode } from '../../engine/parts.js';

const DURATION = 10.8;
const BOX = { w: 725, h: 408, y: 250 };
const CIRCLE = { d: 240, cy: 815 };

const fields = [
    field.text('title', 'Texto principal (título)', 'Assista em seguida', { maxLength: 40 }),
    field.text('labelLeft', 'Legenda da moldura esquerda', 'Último vídeo', { maxLength: 28, allowEmpty: true }),
    field.text('labelRight', 'Legenda da moldura direita', 'Para você', { maxLength: 28, allowEmpty: true }),
    field.text('subscribe', 'Chamada embaixo do círculo', 'Inscreva-se', { maxLength: 24, allowEmpty: true }),
    field.icon('icon', 'Logo / ícone do canal', 'blinkframe', { choices: ['blinkframe', 'star', 'bolt', 'globe', 'broadcast', 'mic', 'tv', 'camera', 'heart', 'music', 'quote', 'bell'] }),
    field.range('dim', 'Escurecer o vídeo ao fundo', 0.3, { min: 0, max: 0.85, step: 0.05, display: 'percent', section: 'appearance' }),
    ...controls({ accent: '#2f4bff', text: '#ffffff', font: 'manrope', scale: false }),
    ...opacityControls([['title', 'Título'], ['left', 'Moldura esquerda'], ['right', 'Moldura direita'], ['circle', 'Círculo do logo'], ['subscribe', 'Chamada Inscreva-se']]),
];

function frame(parent, ctx, key, x, label) {
    const node = ctx.layer(key, el('div', { position: 'absolute', left: `${x}px`, top: `${BOX.y}px`, width: `${BOX.w}px`, height: `${BOX.h}px`, boxSizing: 'border-box', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '22px', transformOrigin: 'center' }, parent));
    el('div', { position: 'absolute', left: '-2px', top: '-2px', width: '64px', height: '64px', borderTop: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderRadius: '22px 0 0 0', boxSizing: 'border-box' }, node);
    const caption = label ? el('div', { position: 'absolute', left: '28px', bottom: '24px', font: '700 22px/1 var(--font)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text)', whiteSpace: 'nowrap' }, node, label) : null;
    return { node, caption };
}

function setup(root, ctx) {
    const { values, W, H } = ctx;
    const dim = el('div', { position: 'absolute', inset: 0, background: '#000', opacity: 0 }, root);

    const title = ctx.layer('title', el('div', { position: 'absolute', left: 0, right: 0, top: '70px', textAlign: 'center' }, root));
    const titleText = el('div', { font: '700 64px/1.1 var(--font)', color: 'var(--text)', display: 'inline-block', whiteSpace: 'nowrap' }, title, values.title);
    fit(titleText, { maxWidth: W - 300, maxSize: 64, minSize: 28 });
    const underline = el('div', { width: '92px', height: '5px', borderRadius: '3px', background: 'var(--accent)', margin: '16px auto 0', transformOrigin: 'center' }, title);

    const gap = 162;
    const x0 = Math.round((W - BOX.w * 2 - gap) / 2);
    const left = frame(root, ctx, 'left', x0, values.labelLeft);
    const right = frame(root, ctx, 'right', x0 + BOX.w + gap, values.labelRight);

    // Círculo do logo com anel girando
    const circle = ctx.layer('circle', el('div', { position: 'absolute', left: `${W / 2 - CIRCLE.d / 2}px`, top: `${CIRCLE.cy - CIRCLE.d / 2}px`, width: `${CIRCLE.d}px`, height: `${CIRCLE.d}px` }, root));
    el('div', { position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(8,10,16,0.45)', boxSizing: 'border-box' }, circle);
    const glyph = el('div', { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }, circle);
    iconNode(glyph, values.icon, 112, { color: 'var(--text)' });
    const r = CIRCLE.d / 2 + 4;
    const arcSvg = svgEl('svg', { width: CIRCLE.d + 16, height: CIRCLE.d + 16, viewBox: `0 0 ${CIRCLE.d + 16} ${CIRCLE.d + 16}` }, circle);
    set(arcSvg, { position: 'absolute', left: '-8px', top: '-8px', overflow: 'visible' });
    const arc = svgEl('circle', { cx: r + 4, cy: r + 4, r, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 6, 'stroke-linecap': 'round' }, arcSvg);
    const circumference = 2 * Math.PI * r;
    arc.setAttribute('stroke-dasharray', `${circumference}`);

    let call = null;
    if (values.subscribe) {
        call = ctx.layer('subscribe', el('div', { position: 'absolute', left: 0, right: 0, top: `${CIRCLE.cy + CIRCLE.d / 2 + 28}px`, textAlign: 'center', font: '800 26px/1 var(--font)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text)', whiteSpace: 'nowrap' }, root, values.subscribe));
    }
    return { dim, title, underline, left, right, circle, arcSvg, arc, circumference, call, dimLevel: values.dim };
}

function render(t, s, ctx) {
    const enter = (a, b, e = ease.outCubic) => prog(t, a, b, e);
    const out = prog(t, 10.0, 10.8, ease.inCubic);
    const fade = 1 - out;

    s.dim.style.opacity = enter(0, 0.5, ease.linear) * s.dimLevel * fade;

    const ti = enter(0.1, 0.65);
    set(s.title, { opacity: ti * fade, transform: `translateY(${(1 - ti) * 18 - out * 14}px)` });
    s.underline.style.transform = `scaleX(${enter(0.5, 0.95, ease.outExpo)})`;

    [[s.left, 0.3], [s.right, 0.45]].forEach(([box, start]) => {
        const p = enter(start, start + 0.6);
        set(box.node, { opacity: p * fade, transform: `translateY(${(1 - p) * 26 + out * 16}px) scale(${0.97 + 0.03 * p})` });
        if (box.caption) set(box.caption, { opacity: enter(1.2, 1.6, ease.linear) });
    });

    const c = enter(0.6, 1.2, ease.outBack);
    set(s.circle, { opacity: Math.min(1, c * 2) * fade, transform: `translateY(${out * 16}px) scale(${Math.max(0, c)})` });
    // Anel: desenha (0.9–1.8), depois um arco de 28% gira sem parar (relógio contínuo, não congela na pausa)
    const draw = enter(0.9, 1.8, ease.inOutCubic);
    const arcLength = s.circumference * (0.06 + 0.22 * draw);
    s.arc.setAttribute('stroke-dasharray', `${arcLength} ${s.circumference - arcLength}`);
    s.arcSvg.style.transform = `rotate(${-90 + ctx.time * 140}deg)`;
    if (s.call) set(s.call, { opacity: enter(1.2, 1.7, ease.linear) * fade, transform: `translateY(${(1 - enter(1.2, 1.7)) * 10}px)` });
}

export default {
    meta: { id: 'tela-final-minimalista' },
    fields,
    sizes: ['landscape'],
    duration: DURATION,
    thumbAt: 3.0,
    pause: { at: 2.0, length: 8.0, min: 2, max: 40 },
    sounds: [
        { at: 0.1, sound: 'whoosh-in', gain: 0.3 },
        { at: 0.65, sound: 'pop', gain: 0.25 },
        { at: 10.0, sound: 'whoosh-out', gain: 0.3 },
    ],
    setup,
    render,
};

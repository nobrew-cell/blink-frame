/**
 * Lower Minimalista
 * Sem placa: nome com letras em cascata, fio de destaque que desenha e subtítulo em caixa-alta espaçada.
 *
 * Linha do tempo (s):  0.00 fio desenha · 0.10–0.9 letras do nome · 0.60 subtítulo
 *                      3.90 saída (fade + deriva) · 4.5 fim
 */
import { el, set, letters, field, controls, logoControls, opacityControls, prog, ease, fit } from '../../engine/kit.js';
import { anchor, layoutWidth } from '../../engine/parts.js';

const fields = [
    field.text('name', 'Texto principal (nome)', 'Carlos Almeida', { maxLength: 40 }),
    field.text('title', 'Subtítulo (cargo)', 'Jornalista e documentarista', { maxLength: 60 }),
    ...logoControls({ side: 'left' }),
    field.toggle('shadow', 'Sombra suave (legibilidade)', true),
    ...controls({ accent: '#ffb703', text: '#ffffff', font: 'bricolage', position: 'left' }),
    ...opacityControls([['name', 'Nome'], ['rule', 'Fio de destaque'], ['title', 'Cargo'], ['logo', 'Logo']]),
];

const DURATION = 5;

function setup(root, ctx) {
    const { values } = ctx;
    const position = values.position;
    const maxW = layoutWidth(ctx);
    const align = { left: 'flex-start', center: 'center', right: 'flex-end' }[position];
    const shadow = values.shadow ? '0 2px 22px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.45)' : 'none';

    const box = anchor(root, ctx);
    const wrap = el('div', { display: 'flex', alignItems: 'flex-end', gap: '24px' }, box);

    let logoEl = null;
    if (values.logo) {
        logoEl = ctx.layer('logo', el('div', { width: '88px', height: '88px', flex: 'none', marginBottom: '6px', order: values.logoSide === 'right' ? 1 : -1 }, wrap));
        const img = document.createElement('img');
        img.src = values.logo;
        set(img, { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
        logoEl.append(img);
    }

    const col = el('div', { display: 'flex', flexDirection: 'column', alignItems: align }, wrap);
    const textMax = maxW - (values.logo ? 112 : 0);

    const nameNode = el('div', {
        font: '700 72px/1.1 var(--font)', color: 'var(--text)', whiteSpace: 'nowrap', textShadow: shadow, letterSpacing: '-0.01em',
    }, col);
    ctx.layer('name', nameNode);
    const chars = letters(nameNode, values.name);
    fit(nameNode, { maxWidth: textMax, maxSize: 72, minSize: 30 });

    const rule = ctx.layer('rule', el('div', { height: '5px', width: '100%', margin: '14px 0 16px', background: 'var(--accent)', transformOrigin: `${position === 'right' ? 'right' : position === 'center' ? 'center' : 'left'} center`, borderRadius: '3px' }, col));

    const titleNode = ctx.layer('title', el('div', {
        font: '400 28px/1.2 var(--font)', color: 'var(--text)', whiteSpace: 'nowrap', textTransform: 'uppercase',
        letterSpacing: '0.2em', textShadow: shadow, opacity: 0,
    }, col, values.title));
    fit(titleNode, { maxWidth: textMax, maxSize: 28, minSize: 14 });

    return { position, chars, rule, titleNode, logoEl, nameNode };
}

function render(t, s) {
    // Fio de destaque: desenha e, na saída, recolhe
    const draw = t < 3.9 ? prog(t, 0, 0.7, ease.outExpo) : 1 - prog(t, 3.9, 4.4, ease.inCubic);
    s.rule.style.transform = `scaleX(${draw})`;

    // Letras em cascata
    const n = s.chars.length;
    s.chars.forEach((node, i) => {
        const delay = 0.1 + (i / Math.max(n, 1)) * 0.6;
        const p = prog(t, delay, delay + 0.45, ease.outCubic);
        set(node, { opacity: p, transform: `translateY(${(1 - p) * 38}px)` });
    });

    // Subtítulo
    const sub = prog(t, 0.6, 1.2, ease.outCubic);
    set(s.titleNode, { opacity: sub, transform: `translateY(${(1 - sub) * 14}px)` });

    if (s.logoEl) {
        const lp = prog(t, 0.3, 0.9, ease.outCubic);
        set(s.logoEl, { opacity: lp, transform: `translateX(${(1 - lp) * (s.position === 'right' ? 30 : -30)}px)` });
    }

    // Saída: tudo some com leve deriva para cima
    const out = prog(t, 3.9, 4.5, ease.inCubic);
    for (const node of [s.nameNode, s.titleNode, s.logoEl]) {
        if (!node) continue;
        node.style.translate = `0 ${-out * 18}px`;
    }
    if (out > 0) {
        s.chars.forEach((node) => (node.style.opacity = 1 - out));
        s.titleNode.style.opacity = Math.min(sub, 1 - out);
        if (s.logoEl) s.logoEl.style.opacity = 1 - out;
    }
}

export default {
    meta: { id: 'lower-minimalista' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 2.2,
    sounds: [
        { at: 0.1, sound: 'whoosh-in', gain: 0.3 },
        { at: 3.95, sound: 'whoosh-out', gain: 0.3 },
    ],
    setup,
    render,
};

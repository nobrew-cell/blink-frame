/**
 * Lower Corporativo
 * Barra de destaque à esquerda, quadro do logo/ícone (com divisória), nome em negrito e cargo em caixa-alta.
 * A placa clara abre para a direita; na saída os textos descem, a placa fecha e SÓ A BARRA fica, depois some.
 *
 * Linha do tempo (s):  0.00 barra · 0.10 quadro do logo · 0.35 placa abre · 0.70 nome · 0.90 cargo
 *                      PAUSA (padrão 3 s) · 4.6 textos saem · 4.75 placa fecha · 5.3 logo some · 5.5 barra some · 5.9 fim
 */
import { el, set, fit, field, controls, iconControls, opacityControls, prog, ease } from '../../engine/kit.js';
import { anchor, iconNode, layoutWidth, maskLine, wipe } from '../../engine/parts.js';

const DURATION = 5.9;

const fields = [
    field.text('name', 'Texto principal (nome)', 'Jane Cooper', { maxLength: 40 }),
    field.text('role', 'Subtítulo (cargo)', 'Head de Marketing', { maxLength: 50, allowEmpty: true }),
    ...iconControls({ icon: 'hexagon', side: 'left', label: 'Logo / ícone da empresa', choices: ['hexagon', 'star', 'bolt', 'globe', 'broadcast', 'mic', 'tv', 'camera', 'heart', 'music', 'quote', 'at'] }),
    field.toggle('showIcon', 'Mostrar quadro do logo', true, { section: 'media' }),
    ...controls({ accent: '#2563eb', text: '#0b1020', plate: '#ffffff', font: 'montserrat', position: 'left' }),
    ...opacityControls([['bar', 'Barra de destaque'], ['plate', 'Fundo da placa'], ['icon', 'Logo / ícone'], ['name', 'Nome'], ['role', 'Cargo']]),
];

function setup(root, ctx) {
    const { values } = ctx;
    const iconLeft = values.iconSide !== 'right';
    const maxW = layoutWidth(ctx);
    const H = 150;
    const barW = 10;
    const box = anchor(root, ctx);
    const row = el('div', { display: 'flex', alignItems: 'stretch', height: `${H}px`, boxShadow: '0 16px 40px rgba(0,0,0,0.28)' }, box);

    const bar = ctx.layer('bar', el('div', { width: `${barW}px`, background: 'var(--accent)', flex: 'none', transformOrigin: 'center' }, row));

    // Quadro do logo (com divisória entre ele e o texto)
    let cell = null;
    const cellW = values.showIcon ? H : 0;
    if (values.showIcon) {
        cell = el('div', { position: 'relative', width: `${H}px`, flex: 'none', background: 'var(--plate)', display: 'grid', placeItems: 'center', order: iconLeft ? 0 : 2, overflow: 'hidden' }, row);
        ctx.layer('plate', cell);
        const glyph = ctx.layer('icon', el('div', { lineHeight: 0, opacity: 0.8 }, cell));
        iconNode(glyph, values.icon, 78, { color: 'var(--text)' });
        el('div', { position: 'absolute', top: '22px', bottom: '22px', [iconLeft ? 'right' : 'left']: 0, width: '2px', background: 'var(--text)', opacity: 0.12 }, cell);
    }

    // Placa de texto
    const padL = 44;
    const padR = 64;
    const textMax = maxW - barW - cellW - padL - padR;
    const plate = el('div', { background: 'var(--plate)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', padding: `0 ${padR}px 0 ${padL}px`, order: 1, minWidth: '540px', boxSizing: 'border-box' }, row);
    ctx.layer('plate', plate);
    const name = maskLine(plate, values.name, { font: '800 58px/1.1 var(--font)', color: 'var(--text)' });
    ctx.layer('name', name.node);
    fit(name.node, { maxWidth: textMax, maxSize: 58, minSize: 24 });
    let role = null;
    if (values.role) {
        role = maskLine(plate, values.role, { font: '600 25px/1.2 var(--font)', color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase' });
        ctx.layer('role', role.node);
        fit(role.node, { maxWidth: textMax, maxSize: 25, minSize: 14 });
    }
    return { iconLeft, bar, cell, plate, name, role };
}

function render(t, s) {
    const side = s.iconLeft ? 'left' : 'right';
    const enter = (a, b, e = ease.outCubic) => prog(t, a, b, e);
    const leave = (a, b) => prog(t, a, b, ease.inCubic);

    const bar = enter(0, 0.4, ease.outExpo) * (1 - leave(5.5, 5.9));
    set(s.bar, { transform: `scaleY(${bar})`, opacity: 1 });

    if (s.cell) {
        const p = enter(0.1, 0.5, ease.outExpo) * (1 - leave(5.2, 5.6));
        s.cell.style.clipPath = wipe(side, p);
    }
    s.plate.style.clipPath = wipe(s.iconLeft ? 'left' : 'right', enter(0.35, 1.0, ease.outExpo) * (1 - leave(4.75, 5.35)));

    s.name.update(enter(0.7, 1.25) + leave(4.6, 5.0));
    if (s.role) s.role.update(enter(0.9, 1.4) + leave(4.5, 4.85));
}

export default {
    meta: { id: 'lower-corporativo' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 2.8,
    pause: { at: 1.6, length: 3.0, min: 1 },
    sounds: [
        { at: 0.05, sound: 'whoosh-in', gain: 0.4 },
        { at: 0.75, sound: 'pop', gain: 0.25 },
        { at: 4.65, sound: 'whoosh-out', gain: 0.35 },
    ],
    setup,
    render,
};

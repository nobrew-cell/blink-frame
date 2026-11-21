/**
 * Entrevista Clássica
 * Placa sólida com barra de destaque à esquerda, nome, cargo e empresa; logo opcional à direita.
 *
 * Linha do tempo (s):  0.00 barra cresce · 0.15 placa abre (wipe) · 0.30–0.65 textos sobem na máscara
 *                      0.70 logo entra · 5.00 textos saem · 5.20 placa fecha · 5.55 barra some
 */
import { el, set, fit, controls, opacityControls, logoField, inOut, prog, ease } from '../../engine/kit.js';
import { anchor, backdrop, layoutWidth, maskLine, wipe } from '../../engine/parts.js';

const fields = [
    { key: 'name', type: 'text', label: 'Texto principal (nome)', default: 'Maria Souza', maxLength: 40 },
    { key: 'title', type: 'text', label: 'Subtítulo (cargo)', default: 'Diretora de Criação', maxLength: 60 },
    { key: 'company', type: 'text', label: 'Empresa / local', default: 'Estúdio Aurora', maxLength: 48, allowEmpty: true },
    logoField('Logo (opcional)'),
    ...controls({ accent: '#ffb703', text: '#ffffff', plate: '#16161a', font: 'inter', position: 'left' }),
    ...opacityControls([
        ['bar', 'Barra de destaque'], ['plate', 'Fundo da placa'], ['name', 'Nome'], ['title', 'Cargo'], ['company', 'Empresa'], ['logo', 'Logo'],
    ]),
];

const DURATION = 6;

function setup(root, ctx) {
    const { values } = ctx;
    const position = values.position;
    const maxW = layoutWidth(ctx);
    const box = anchor(root, ctx);

    // Barra + placa lado a lado (espelhado quando a lower fica à direita)
    const body = el('div', { display: 'flex', flexDirection: position === 'right' ? 'row-reverse' : 'row', alignItems: 'stretch' }, box);
    const accentBar = ctx.layer('bar', el('div', { width: '12px', background: 'var(--accent)', transformOrigin: 'center bottom', flex: 'none' }, body));
    const plate = el('div', {
        display: 'flex', alignItems: 'center', gap: '28px', padding: '26px 40px 26px 34px',
    }, body);
    ctx.layer('plate', backdrop(plate, 'var(--plate)'));

    const logoSize = 96;
    const hasLogo = Boolean(values.logo);
    const textMax = maxW - 12 - 34 - 40 - (hasLogo ? logoSize + 28 : 0);

    const col = el('div', { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }, plate);
    col.style.textAlign = 'left';

    const name = maskLine(col, values.name, { font: '700 56px/1.15 var(--font)', color: 'var(--text)' });
    ctx.layer('name', name.node);
    fit(name.node, { maxWidth: textMax, maxSize: 56, minSize: 26 });
    const title = maskLine(col, values.title, { font: '400 30px/1.2 var(--font)', color: 'var(--text)', opacity: 0.88 });
    ctx.layer('title', title.node);
    fit(title.node, { maxWidth: textMax, maxSize: 30, minSize: 16 });
    let company = null;
    if (values.company) {
        company = maskLine(col, values.company.toUpperCase(), { font: '700 20px/1.2 var(--font)', color: 'var(--accent)', letterSpacing: '0.14em' });
        ctx.layer('company', company.node);
        fit(company.node, { maxWidth: textMax, maxSize: 20, minSize: 12 });
    }

    let logoBox = null;
    if (hasLogo) {
        logoBox = ctx.layer('logo', el('div', { width: `${logoSize}px`, height: `${logoSize}px`, flex: 'none' }, plate));
        const img = document.createElement('img');
        img.src = values.logo;
        set(img, { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
        logoBox.append(img);
    }

    return { position, accentBar, plate, lines: [name, title, company].filter(Boolean), logoBox };
}

function render(t, s) {
    // Barra
    const bar = inOut(t, 0, 0.55, 5.45, 6, ease.outExpo, ease.inCubic);
    set(s.accentBar, { transform: `scaleY(${bar})`, opacity: bar > 0 ? 1 : 0 });

    // Placa (wipe de entrada e de saída)
    const plateIn = prog(t, 0.15, 0.85, ease.outCubic);
    const plateOut = prog(t, 5.2, 5.8, ease.inCubic);
    const visible = t < 5.2 ? plateIn : 1 - plateOut;
    s.plate.style.clipPath = wipe(s.position, visible);

    // Textos: entram de baixo, saem por cima (p < 0 → sobe além da máscara)
    s.lines.forEach((line, i) => {
        const enter = prog(t, 0.3 + i * 0.13, 0.9 + i * 0.13, ease.outCubic);
        const leave = prog(t, 5.0 + i * 0.06, 5.5 + i * 0.06, ease.inCubic);
        line.update(t < 5.0 ? enter : 1 + leave); // > 1 = sobe além da máscara
    });

    // Logo
    if (s.logoBox) {
        const p = inOut(t, 0.7, 1.3, 5.0, 5.4, ease.outBack, ease.inCubic);
        set(s.logoBox, { opacity: Math.min(1, p), transform: `scale(${0.6 + 0.4 * p})` });
    }
}

export default {
    meta: { id: 'entrevista-classica' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 2.6,
    sounds: [
        { at: 0.05, sound: 'whoosh-in', gain: 0.5 },
        { at: 0.75, sound: 'pop', gain: 0.35 },
        { at: 5.05, sound: 'whoosh-out', gain: 0.4 },
    ],
    setup,
    render,
};

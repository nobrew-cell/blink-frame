/**
 * Entrevista com Ícone
 * Ícone circular (com anel que "respira") ao lado de um bloco escuro: selo superior com barras de áudio,
 * nome, fio de destaque em degradê e subtítulo. O ícone pode ser trocado (biblioteca ou arquivo próprio)
 * e ficar à esquerda ou à direita.
 *
 * Linha do tempo (s):  0.00 ícone salta · 0.25 bloco abre (wipe a partir do lado do ícone) · 0.45 selo
 *                      0.55 nome sobe na máscara · 0.80 fio se desenha · 1.00 subtítulo
 *                      4.90 subtítulo sai · 5.05 nome · 5.20 fio · 5.30 selo · 5.40 bloco fecha · 5.70 ícone some
 */
import { el, set, fit, field, controls, iconControls, opacityControls, prog, ease } from '../../engine/kit.js';
import { anchor, backdrop, iconNode, layoutWidth, maskLine, wipe } from '../../engine/parts.js';

const DURATION = 6.4;
const BARS = [
    { hz: 1.7, phase: 0.0 }, { hz: 2.3, phase: 1.3 }, { hz: 1.3, phase: 2.1 }, { hz: 2.9, phase: 0.6 }, { hz: 2.0, phase: 1.8 },
];

const fields = [
    field.text('badge', 'Selo superior', 'ENTREVISTA', { maxLength: 20, allowEmpty: true }),
    field.text('name', 'Texto principal (nome)', 'Maria Lopez', { maxLength: 40 }),
    field.text('title', 'Subtítulo (cargo)', 'Chef e dona de restaurante', { maxLength: 60, allowEmpty: true }),
    ...iconControls({ icon: 'mic', side: 'left', choices: ['mic', 'headset', 'broadcast', 'music', 'camera', 'tv', 'globe', 'star', 'bolt', 'quote', 'bell', 'heart'] }),
    field.toggle('iconBackground', 'Fundo circular no ícone', true, { section: 'media' }),
    field.toggle('equalizer', 'Barras de áudio no selo', true, { section: 'appearance' }),
    ...controls({ accent: '#f59e0b', text: '#ffffff', plate: '#15161b', font: 'montserrat', position: 'left' }),
    ...opacityControls([
        ['icon', 'Ícone'], ['plate', 'Fundo do bloco'], ['badge', 'Selo superior'], ['name', 'Nome'], ['rule', 'Fio de destaque'], ['title', 'Subtítulo'],
    ]),
];

function setup(root, ctx) {
    const { values } = ctx;
    const iconLeft = values.iconSide !== 'right';
    const maxW = layoutWidth(ctx);
    const box = anchor(root, ctx);
    const row = el('div', { display: 'flex', alignItems: 'center', gap: '22px' }, box);

    // Ícone: anel + disco + glifo (ou imagem do usuário). `order` escolhe o lado.
    const badgeOn = values.iconBackground;
    const iconSize = badgeOn ? 96 : 84;
    const iconWrap = ctx.layer('icon', el('div', { position: 'relative', width: `${iconSize}px`, height: `${iconSize}px`, flex: 'none', order: iconLeft ? -1 : 1 }, row));
    let ring = null;
    if (badgeOn) {
        ring = el('div', { position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--accent)' }, iconWrap);
        el('div', { position: 'absolute', inset: '12px', borderRadius: '50%', background: 'var(--accent)' }, iconWrap);
    }
    const glyphSize = badgeOn ? 40 : iconSize;
    const glyph = el('div', { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }, iconWrap);
    iconNode(glyph, values.icon, glyphSize, { color: badgeOn ? '#0b0b0d' : 'var(--accent)' });

    // Bloco escuro com os textos
    const plate = el('div', { display: 'flex', flexDirection: 'column', padding: '18px 40px 20px 30px', borderRadius: '6px' }, row);
    ctx.layer('plate', backdrop(plate, 'var(--plate)'));
    const textMax = maxW - iconSize - 22 - 30 - 40;

    // Selo superior: texto + barras de áudio
    let badge = null;
    let bars = [];
    if (values.badge || values.equalizer) {
        badge = ctx.layer('badge', el('div', { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', height: '20px' }, plate));
        if (values.badge) {
            el('div', { font: '700 18px/1 var(--font)', letterSpacing: '0.22em', color: 'var(--accent)', whiteSpace: 'nowrap', textTransform: 'uppercase' }, badge, values.badge);
        }
        if (values.equalizer) {
            const eq = el('div', { display: 'flex', alignItems: 'center', gap: '3px', height: '20px' }, badge);
            bars = BARS.map(() => el('div', { width: '3px', height: '6px', borderRadius: '2px', background: 'var(--accent)' }, eq));
        }
    }

    const name = maskLine(plate, values.name, { font: '700 60px/1.12 var(--font)', color: 'var(--text)' });
    ctx.layer('name', name.node);
    fit(name.node, { maxWidth: textMax, maxSize: 60, minSize: 26 });

    const rule = ctx.layer('rule', el('div', {
        height: '3px', margin: '8px 0 10px', alignSelf: 'stretch', borderRadius: '2px',
        background: `linear-gradient(${iconLeft ? '90deg' : '270deg'}, var(--accent), rgba(255,255,255,0))`,
        transformOrigin: iconLeft ? 'left center' : 'right center',
    }, plate));

    let title = null;
    if (values.title) {
        title = maskLine(plate, values.title, { font: '400 30px/1.2 var(--font)', color: 'var(--text)', opacity: 0.9 });
        ctx.layer('title', title.node);
        fit(title.node, { maxWidth: textMax, maxSize: 30, minSize: 16 });
    }

    return { iconLeft, iconWrap, ring, plate, badge, bars, name, rule, title };
}

function render(t, s) {
    const wipeSide = s.iconLeft ? 'left' : 'right';
    const enter = (a, b, easing = ease.outCubic) => prog(t, a, b, easing);
    const leave = (a, b) => prog(t, a, b, ease.inCubic);

    // Ícone: salta ao entrar e encolhe ao sair; o anel aparece e "respira"
    const iconIn = enter(0, 0.55, ease.outBack);
    const iconOut = leave(5.7, 6.3);
    const iconScale = Math.max(0, iconIn) * (1 - iconOut);
    set(s.iconWrap, { opacity: Math.min(1, enter(0, 0.25, ease.linear)) * (1 - iconOut), transform: `scale(${iconScale})` });
    if (s.ring) {
        const breathe = 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / 2.4);
        set(s.ring, { opacity: enter(0.3, 0.8, ease.linear) * (0.4 + 0.45 * breathe), transform: `scale(${1 + 0.05 * breathe})` });
    }

    // Bloco: abre a partir do lado do ícone e fecha no fim
    s.plate.style.clipPath = wipe(wipeSide, enter(0.25, 0.9, ease.outExpo) * (1 - leave(5.4, 6.0)));

    // Selo + barras de áudio (alturas dependem só de t)
    if (s.badge) {
        const p = enter(0.45, 0.9) * (1 - leave(5.3, 5.6));
        set(s.badge, { opacity: p, transform: `translateY(${(1 - p) * 10}px)` });
        s.bars.forEach((bar, i) => {
            const { hz, phase } = BARS[i];
            const level = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * hz + phase);
            bar.style.height = `${5 + 13 * level}px`;
        });
    }

    // Textos sobem na máscara (0 → 1) e saem por cima (1 → 2)
    s.name.update(enter(0.55, 1.15) + leave(5.05, 5.45));
    s.rule.style.transform = `scaleX(${enter(0.8, 1.35, ease.outExpo) * (1 - leave(5.2, 5.6))})`;
    if (s.title) s.title.update(enter(1.0, 1.55) + leave(4.9, 5.3));
}

export default {
    meta: { id: 'entrevista-microfone' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 2.6,
    holdAt: 3.2,
    sounds: [
        { at: 0.05, sound: 'whoosh-in', gain: 0.4 },
        { at: 0.35, sound: 'pop', gain: 0.35 },
        { at: 5.3, sound: 'whoosh-out', gain: 0.35 },
    ],
    setup,
    render,
};

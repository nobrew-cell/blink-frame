/**
 * Cartão de Comentário
 * Cartão branco com ícone de comentário e chamada, uma "resposta" sendo digitada (cursor piscando) e uma seta que
 * pula apontando para os comentários. Na saída o cartão escurece e some.
 *
 * Linha do tempo (s):  0.00 cartão · 0.20 ícone · 0.90–2.3 digitação · 0.8 seta
 *                      PAUSA (padrão 3 s) · 5.6 saída · 6.3 fim
 */
import { el, set, field, controls, iconControls, opacityControls, typing, fit, prog, ease } from '../../engine/kit.js';
import { anchor, backdrop, iconNode, layoutWidth, icon } from '../../engine/parts.js';

const DURATION = 6.3;
const TYPE_START = 0.9;
const TYPE_MAX = 1.4; // a digitação nunca passa de 1,4 s, qualquer que seja o tamanho do texto

const fields = [
    field.text('title', 'Texto principal (chamada)', 'Comente abaixo', { maxLength: 30 }),
    field.text('answer', 'Resposta digitada', 'Sua resposta...', { maxLength: 60, allowEmpty: true }),
    ...iconControls({ icon: 'comment', side: 'left', label: 'Ícone da chamada', choices: ['comment', 'heart', 'star', 'bell', 'like', 'quote', 'at', 'bolt', 'mic', 'music', 'globe', 'user'] }),
    field.toggle('showArrow', 'Seta apontando para baixo', true, { section: 'appearance' }),
    field.color('arrow', 'Cor da seta', '#ffffff'),
    ...controls({ accent: '#2f6bff', text: '#0b0b0d', plate: '#ffffff', font: 'inter', position: 'center' }),
    ...opacityControls([['card', 'Fundo do cartão'], ['icon', 'Ícone'], ['title', 'Chamada'], ['answer', 'Resposta'], ['arrow', 'Seta']]),
];

const typingStep = (n) => Math.min(1 / 16, TYPE_MAX / Math.max(1, n));

function setup(root, ctx) {
    const { values } = ctx;
    const maxW = layoutWidth(ctx);
    const cardW = Math.min(880, maxW);
    const box = anchor(root, ctx);
    const col = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '26px' }, box);

    const card = el('div', { width: `${cardW}px`, boxSizing: 'border-box', padding: '36px 46px 38px', display: 'flex', flexDirection: 'column', gap: '22px', transformOrigin: 'center bottom' }, col);
    const bg = backdrop(card, 'var(--plate)');
    set(bg, { borderRadius: '36px', boxShadow: '0 22px 60px rgba(0,0,0,0.45)' });
    ctx.layer('card', bg);

    const head = el('div', { display: 'flex', alignItems: 'center', gap: '20px', flexDirection: values.iconSide === 'right' ? 'row-reverse' : 'row', justifyContent: values.iconSide === 'right' ? 'flex-end' : 'flex-start' }, card);
    const glyph = ctx.layer('icon', el('div', { lineHeight: 0, flex: 'none' }, head));
    iconNode(glyph, values.icon, 56, { color: 'var(--accent)' });
    const title = ctx.layer('title', el('div', { font: '800 50px/1.05 var(--font)', letterSpacing: '-0.01em', textTransform: 'uppercase', color: 'var(--text)', whiteSpace: 'nowrap' }, head, values.title));
    fit(title, { maxWidth: cardW - 92 - 56 - 20, maxSize: 50, minSize: 22 });

    let line = null;
    let shown = null;
    let caret = null;
    let rest = null;
    if (values.answer) {
        const field = el('div', { height: '2px', background: 'var(--text)', opacity: 0.12 }, card);
        void field;
        line = ctx.layer('answer', el('div', { font: '400 38px/1.25 var(--font)', color: 'var(--text)', minHeight: '1.25em', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, card));
        shown = el('span', { opacity: 0.55 }, line);
        caret = el('span', { display: 'inline-block', width: '3px', height: '1.05em', marginLeft: '2px', verticalAlign: '-0.15em', background: 'var(--accent)' }, line);
        rest = el('span', { opacity: 0 }, line);
    }

    let arrow = null;
    if (values.showArrow) {
        arrow = ctx.layer('arrow', el('div', { lineHeight: 0, color: values.arrow, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))' }, col));
        icon('arrowDown', 96, values.arrow, arrow);
    }
    return { card, head, glyph, title, line, shown, caret, rest, arrow, chars: [...values.answer] };
}

function render(t, s, ctx) {
    const enter = (a, b, e = ease.outCubic) => prog(t, a, b, e);
    const out = prog(t, 5.6, 6.3, ease.inCubic);

    const c = enter(0, 0.55, ease.outBack);
    set(s.card, { opacity: Math.min(1, c * 2) * (1 - out), transform: `translateY(${(1 - Math.min(c, 1)) * 40 + out * 24}px) scale(${0.9 + 0.1 * Math.min(1, c)})`, filter: `brightness(${1 - 0.18 * out})` });
    const g = enter(0.2, 0.7, ease.outBack);
    set(s.glyph, { transform: `scale(${Math.max(0, g)})` });
    s.title.style.opacity = enter(0.2, 0.6, ease.linear);

    if (s.line) {
        const n = s.chars.length;
        const count = Math.min(n, Math.floor(Math.max(0, t - TYPE_START) / typingStep(n) + 1e-9));
        s.shown.textContent = s.chars.slice(0, count).join('');
        s.rest.textContent = s.chars.slice(count).join('');
        // O cursor pisca com o relógio contínuo (continua piscando na pausa) e some quando a saída começa
        const on = Math.floor(ctx.time * 2.2) % 2 === 0 || (t > TYPE_START && t < TYPE_START + n * typingStep(n));
        s.caret.style.opacity = t >= TYPE_START - 0.1 && on ? 1 : 0;
    }

    if (s.arrow) {
        const a = enter(0.8, 1.3);
        const bounce = Math.abs(Math.sin(ctx.time * 4.2)) * 16 * a;
        set(s.arrow, { opacity: a * (1 - prog(t, 5.4, 5.9, ease.linear)), transform: `translateY(${(1 - a) * -20 + bounce}px)` });
    }
}

export default {
    meta: { id: 'cartao-comentario' },
    fields,
    sizes: ['vertical', 'square', 'landscape'],
    duration: DURATION,
    thumbAt: 3.0,
    pause: { at: 2.6, length: 3.0, min: 1 },
    sounds: (ctx) => [
        { at: 0.05, sound: 'whoosh-in', gain: 0.35 },
        ...typing(TYPE_START, ctx.values.answer.length, typingStep(ctx.values.answer.length), 0.35),
        { at: 5.6, sound: 'whoosh-out', gain: 0.3 },
    ],
    setup,
    render,
};

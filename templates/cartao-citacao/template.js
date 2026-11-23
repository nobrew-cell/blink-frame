/**
 * Cartão de Citação
 * Cartão escuro com aspas de destaque, a frase aparecendo palavra por palavra e, embaixo, o autor (fio + nome em
 * caixa-alta) e um logo/ícone no canto (lado escolhido pelo usuário).
 *
 * Linha do tempo (s):  0.00 cartão · 0.35 aspas · 0.70–2.2 palavras · 2.4 autor e ícone
 *                      PAUSA (padrão 3 s, editável em "Tempo em tela") · 6.00 tudo sai · 6.6 fim
 */
import { el, set, fit, field, controls, iconControls, opacityControls, fontFamily, prog, ease } from '../../engine/kit.js';
import { anchor, backdrop, iconNode, layoutWidth, words } from '../../engine/parts.js';

const DURATION = 6.8;
const WORDS_START = 0.7;
const WORDS_SPAN = 1.5; // todas as palavras entram dentro desta janela, qualquer que seja o tamanho da frase

const fields = [
    field.text('quote', 'Citação', 'Por que as coisas na vida são tão difíceis?', { maxLength: 220 }),
    field.text('author', 'Autor', 'Wesley Palla', { maxLength: 40, allowEmpty: true }),
    ...iconControls({ icon: 'blinkframe', side: 'right', label: 'Logo / ícone (canto inferior)', choices: ['blinkframe', 'star', 'quote', 'quote-close', 'mic', 'broadcast', 'camera', 'globe', 'bolt', 'heart', 'bell', 'music'] }),
    field.toggle('showIcon', 'Mostrar logo / ícone', true, { section: 'media' }),
    field.font('authorFont', 'Fonte do autor', 'inter'),
    ...controls({ accent: '#f5b50a', text: '#ffffff', plate: '#15161b', font: 'playfair', position: 'center' }),
    ...opacityControls([['card', 'Fundo do cartão'], ['mark', 'Aspas'], ['quote', 'Citação'], ['author', 'Autor'], ['icon', 'Logo / ícone']]),
];

function setup(root, ctx) {
    const { values, size } = ctx;
    const maxW = layoutWidth(ctx);
    const cardW = Math.min(size === 'landscape' ? 1180 : 1000, maxW);
    const padX = 64;
    const box = anchor(root, ctx);

    const card = el('div', {
        width: `${cardW}px`, boxSizing: 'border-box', padding: '50px 64px 42px', display: 'flex', flexDirection: 'column', gap: '20px',
    }, box);
    const bg = backdrop(card, 'var(--plate)');
    set(bg, { borderRadius: '14px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' });
    ctx.layer('card', bg);

    const mark = ctx.layer('mark', el('div', { alignSelf: 'flex-start', lineHeight: 0 }, card));
    iconNode(mark, 'quote', 64, { color: 'var(--accent)' });

    const quote = ctx.layer('quote', el('div', { font: '400 64px/1.22 var(--font)', color: 'var(--text)', width: '100%', overflowWrap: 'anywhere' }, card));
    const spans = words(quote, values.quote);
    fit(quote, { maxWidth: cardW - padX * 2, maxHeight: size === 'landscape' ? 300 : size === 'square' ? 420 : 640, maxSize: 64, minSize: 26 });

    const footer = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', marginTop: '6px' }, card);
    const author = ctx.layer('author', el('div', { display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, order: values.iconSide === 'left' ? 1 : 0 }, footer));
    let dash = null;
    if (values.author) {
        dash = el('div', { width: '34px', height: '3px', background: 'var(--accent)', flex: 'none', transformOrigin: 'left center' }, author);
        el('div', {
            font: `700 21px/1 ${fontFamily(values.authorFont)}`, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }, author, values.author);
    }
    let icon = null;
    if (values.showIcon) {
        icon = ctx.layer('icon', el('div', { lineHeight: 0, flex: 'none', opacity: 0.85, order: values.iconSide === 'left' ? 0 : 1 }, footer));
        iconNode(icon, values.icon, 46, { color: 'var(--text)' });
    }

    // Janela das palavras: o passo se ajusta ao tamanho da frase
    const step = Math.min(0.15, WORDS_SPAN / Math.max(1, spans.length));
    const wordsEnd = WORDS_START + spans.length * step + 0.3;
    return { card, mark, spans, step, author, dash, icon, footerStart: Math.max(2.1, wordsEnd) };
}

function render(t, s) {
    const enter = prog(t, 0, 0.55, ease.outCubic);
    const out = prog(t, 6.0, 6.6, ease.inCubic);
    set(s.card, { opacity: enter * (1 - out), transform: `translateY(${(1 - enter) * 22 + out * 10}px) scale(${0.965 + 0.035 * enter - 0.02 * out})` });

    const mark = prog(t, 0.35, 0.85, ease.outBack);
    set(s.mark, { opacity: Math.min(1, mark * 1.6), transform: `scale(${Math.max(0, mark)})`, transformOrigin: 'left center' });

    s.spans.forEach((span, i) => {
        const p = prog(t, WORDS_START + i * s.step, WORDS_START + i * s.step + 0.3, ease.outCubic);
        set(span, { opacity: p, transform: `translateY(${(1 - p) * 8}px)` });
    });

    const a = prog(t, s.footerStart, s.footerStart + 0.5, ease.outCubic);
    set(s.author, { opacity: a, transform: `translateX(${(a - 1) * 16}px)` });
    if (s.dash) s.dash.style.transform = `scaleX(${prog(t, s.footerStart, s.footerStart + 0.45, ease.outExpo)})`;
    if (s.icon) {
        const p = prog(t, s.footerStart + 0.1, s.footerStart + 0.6, ease.outCubic);
        set(s.icon, { opacity: p * 0.85, transform: `scale(${0.8 + 0.2 * p})` });
    }
}

export default {
    meta: { id: 'cartao-citacao' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 3.2,
    pause: { at: 3.0, length: 3.0, min: 1 },
    sounds: [
        { at: 0.05, sound: 'whoosh-in', gain: 0.35 },
        { at: 0.4, sound: 'pop', gain: 0.3 },
        { at: 6.0, sound: 'whoosh-out', gain: 0.35 },
    ],
    setup,
    render,
};

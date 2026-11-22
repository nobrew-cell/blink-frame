/**
 * Chamada para Shorts
 * Frase de impacto em letras de quadrinhos (levemente inclinada e "tremendo", como desenho em stop-motion) e uma
 * pílula branca com foto, @ e botão "+" que vira "✓" no clique.
 *
 * Linha do tempo (s):  0.00 frase "carimba" · 0.35 pílula sobe · 1.9 clique (+ vira ✓)
 *                      PAUSA (padrão 3 s) · 5.4 saída · 6.0 fim
 */
import { el, set, fit, field, controls, opacityControls, prog, ease, lerp } from '../../engine/kit.js';
import { anchor, layoutWidth, icon, initials, layoutPos } from '../../engine/parts.js';

const DURATION = 6.0;
const CLICK = 1.9;

const fields = [
    field.text('headline', 'Texto principal (frase)', 'Inscreva-se para mais', { maxLength: 36 }),
    field.text('handle', 'Usuário (@)', '@umapalavraclara', { maxLength: 32 }),
    field.image('avatar', 'Foto do canal (opcional)'),
    field.toggle('wobble', 'Frase "tremendo" (estilo quadrinhos)', true, { section: 'appearance' }),
    field.toggle('subscribe', 'Animar o clique (+ vira ✓)', true, { section: 'appearance' }),
    field.color('handleColor', 'Cor do usuário (@)', '#0b0b0d'),
    ...controls({ accent: '#2748e8', text: '#ffffff', plate: '#ffffff', font: 'bangers', position: 'center' }),
    ...opacityControls([['headline', 'Frase'], ['pill', 'Fundo da pílula'], ['avatar', 'Foto'], ['handle', 'Usuário'], ['button', 'Botão']]),
];

/** Ruído determinístico 0..1 a partir de um inteiro (o "tremor" muda a cada 1/10 s). */
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function setup(root, ctx) {
    const { values } = ctx;
    const maxW = Math.min(layoutWidth(ctx), 960);
    const box = anchor(root, ctx);
    const col = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }, box);

    const headline = ctx.layer('headline', el('div', {
        font: '400 150px/1 var(--font)', color: 'var(--text)', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.01em',
        textShadow: '0 6px 0 rgba(0,0,0,0.35), 0 10px 26px rgba(0,0,0,0.4)', transformOrigin: 'center',
    }, col, values.headline));
    fit(headline, { maxWidth: maxW, maxSize: 150, minSize: 40 });

    // Pílula
    const pill = el('div', { position: 'relative', display: 'flex', alignItems: 'center', gap: '18px', padding: '10px 10px 10px 12px', borderRadius: '60px', isolation: 'isolate', transformOrigin: 'center' }, col);
    const bg = el('div', { position: 'absolute', inset: 0, borderRadius: '60px', background: 'var(--plate)', boxShadow: '0 14px 36px rgba(0,0,0,0.4)', zIndex: -1 }, pill);
    ctx.layer('pill', bg);

    const avatar = ctx.layer('avatar', el('div', { width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden', flex: 'none', background: 'linear-gradient(135deg,#6d5dfc,#a855f7)', display: 'grid', placeItems: 'center' }, pill));
    if (values.avatar) {
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = values.avatar;
        set(img, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
        avatar.append(img);
    } else {
        el('div', { font: '800 40px/1 Inter, system-ui, sans-serif', color: '#fff' }, avatar, initials(values.handle.replace('@', ''), 'U'));
    }
    const handle = ctx.layer('handle', el('div', { font: '800 40px/1 Inter, system-ui, sans-serif', color: values.handleColor, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }, pill, values.handle));
    fit(handle, { maxWidth: maxW - 84 - 84 - 80, maxSize: 40, minSize: 20 });

    // Botão: "+" (acento) e "✓" (preto) empilhados
    const button = ctx.layer('button', el('div', { position: 'relative', width: '84px', height: '84px', flex: 'none', display: 'grid' }, pill));
    const ripple = el('div', { position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid var(--accent)', opacity: 0 }, button);
    const plus = el('div', { gridArea: '1 / 1', borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center' }, button);
    icon('plus', 40, '#fff', plus);
    const check = el('div', { gridArea: '1 / 1', borderRadius: '50%', background: '#0b0b0d', display: 'grid', placeItems: 'center', opacity: 0 }, button);
    icon('check', 40, '#fff', check);
    return { headline, pill, button, ripple, plus, check };
}

function render(t, s, ctx) {
    const { values } = ctx;
    const out = prog(t, 5.4, 6.0, ease.inCubic);

    // Frase: "carimba" (escala grande → 1) e depois treme em passos de 1/10 s (usa o relógio contínuo)
    const stamp = prog(t, 0, 0.45, ease.outBack);
    const step = Math.floor(ctx.time * 10);
    const shake = values.wobble ? (hash(step) - 0.5) * 2.4 : 0;
    const shiftY = values.wobble ? (hash(step + 91) - 0.5) * 6 : 0;
    set(s.headline, {
        opacity: Math.min(1, stamp * 3) * (1 - out),
        transform: `translateY(${shiftY - out * 30}px) rotate(${-3 + shake}deg) scale(${lerp(1.5, 1, stamp)})`,
    });

    // Pílula: sobe (cinza → viva) e sai
    const rise = prog(t, 0.35, 0.95, ease.outCubic);
    set(s.pill, { opacity: rise * (1 - out), transform: `translateY(${(1 - rise) * 40 + out * 20}px) scale(${0.94 + 0.06 * rise})`, filter: `brightness(${lerp(0.55, 1, rise)})` });

    // Clique: o botão afunda, um anel se expande e "+" vira "✓"
    const press = prog(t, CLICK - 0.12, CLICK, ease.outQuad) * (1 - prog(t, CLICK, CLICK + 0.2, ease.outQuad));
    const swap = values.subscribe ? prog(t, CLICK, CLICK + 0.2, ease.outCubic) : 0;
    set(s.button, { transform: `scale(${1 - 0.1 * press})` });
    set(s.plus, { opacity: 1 - swap, transform: `rotate(${swap * 90}deg) scale(${1 - swap * 0.4})` });
    set(s.check, { opacity: swap, transform: `scale(${lerp(0.5, 1, ease.outBack(swap))})` });
    const r = values.subscribe ? prog(t, CLICK, CLICK + 0.6, ease.outCubic) : 0;
    set(s.ripple, { opacity: r > 0 && r < 1 ? 0.8 * (1 - r) : 0, transform: `scale(${1 + r * 0.9})` });
}

export default {
    meta: { id: 'chamada-shorts' },
    fields,
    sizes: ['vertical', 'square', 'landscape'],
    duration: DURATION,
    thumbAt: 3.0,
    pause: { at: 2.5, length: 2.9, min: 1 },
    sounds: [
        { at: 0.05, sound: 'pop', gain: 0.5 },
        { at: 0.4, sound: 'whoosh-in', gain: 0.25 },
        { at: CLICK, sound: 'pop', gain: 0.55 },
        { at: 5.4, sound: 'whoosh-out', gain: 0.3 },
    ],
    setup,
    render,
};

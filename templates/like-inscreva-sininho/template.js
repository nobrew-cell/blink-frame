/**
 * Like, Inscreva-se e Sininho
 * Três botões em linha. Um cursor passa por eles na ordem: Like (cinza → azul), Inscreva-se (vermelho → "Inscrito"
 * cinza) e o sininho (balança e ganha um aviso amarelo).
 *
 * Linha do tempo (s):  0.00–0.9 botões entram em cascata · cliques em 1.55 (like), 2.65 (inscrição), 3.75 (sininho)
 *                      4.7 cursor some · PAUSA (padrão 1,7 s) · 6.4 saída · 7.0 fim
 */
import { el, set, field, controls, opacityControls, prog, ease, lerp } from '../../engine/kit.js';
import { anchor, icon, layoutPos, cursorNode, iconBurst, track } from '../../engine/parts.js';

const DURATION = 7.0;
const CLICKS = { like: 1.55, subscribe: 2.65, bell: 3.75 };

const fields = [
    field.text('likeText', 'Texto do Like', 'LIKE', { maxLength: 14 }),
    field.text('subscribeText', 'Texto do Inscreva-se', 'INSCREVA-SE', { maxLength: 16 }),
    field.text('doneText', 'Texto depois de inscrito', 'INSCRITO', { maxLength: 16 }),
    field.toggle('showCursor', 'Cursor clicando nos botões', true, { section: 'appearance' }),
    field.toggle('bursts', 'Efeitos ao clicar (polegares, sininhos)', true, { section: 'appearance' }),
    field.color('likeColor', 'Cor do Like (depois do clique)', '#3b82f6'),
    field.color('bellColor', 'Cor do aviso do sininho', '#fbbf24'),
    ...controls({ accent: '#ff2a3d', text: '#ffffff', plate: '#26272d', font: 'inter', position: 'center' }),
    ...opacityControls([['like', 'Botão Like'], ['subscribe', 'Botão Inscreva-se'], ['bell', 'Sininho'], ['cursor', 'Cursor']]),
];

/** 0 → 1 → 0 em torno de um clique (afunda e volta). */
const pressAt = (t, c) => prog(t, c - 0.13, c, ease.outQuad) * (1 - prog(t, c, c + 0.2, ease.outQuad));

function setup(root, ctx) {
    const { values } = ctx;
    const box = anchor(root, ctx);
    const row = el('div', { position: 'relative', display: 'flex', alignItems: 'center', gap: '22px', padding: '40px 40px' }, box);

    const face = (parent, styles) => el('div', {
        gridArea: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', height: '88px', borderRadius: '44px',
        font: '800 30px/1 var(--font)', letterSpacing: '0.02em', color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', ...styles,
    }, parent);
    const wrapper = (key) => ctx.layer(key, el('div', { position: 'relative', display: 'grid', flex: 'none' }, row));

    // Like
    const likeBtn = wrapper('like');
    const likeBefore = face(likeBtn, { background: 'var(--plate)', padding: '0 38px' });
    icon('like', 34, '#fff', likeBefore);
    el('span', {}, likeBefore, values.likeText);
    const likeAfter = face(likeBtn, { background: values.likeColor, padding: '0 38px', opacity: 0 });
    icon('like', 34, '#fff', likeAfter);
    el('span', {}, likeAfter, values.likeText);

    // Inscreva-se → Inscrito
    const subBtn = wrapper('subscribe');
    const subBefore = face(subBtn, { background: 'var(--accent)', padding: '0 44px' });
    el('span', {}, subBefore, values.subscribeText);
    const subAfter = face(subBtn, { background: 'var(--plate)', padding: '0 44px', opacity: 0 });
    icon('check', 30, '#fff', subAfter);
    el('span', {}, subAfter, values.doneText);

    // Sininho (+ aviso)
    const bellBtn = wrapper('bell');
    const bellFace = face(bellBtn, { background: 'var(--plate)', width: '88px', padding: 0 });
    const bellIcon = icon('bell', 38, '#fff', bellFace);
    set(bellIcon, { transformOrigin: '50% 12%' });
    const dot = el('div', { position: 'absolute', right: '4px', top: '4px', width: '26px', height: '26px', borderRadius: '50%', background: values.bellColor, border: '4px solid var(--plate)', boxSizing: 'border-box', transform: 'scale(0)' }, bellBtn);

    // Cursor e efeitos (posições em px de layout dentro de `row`)
    let cursor = null;
    let keys = null;
    const bursts = [];
    if (values.showCursor) {
        cursor = ctx.layer('cursor', cursorNode(row, { size: 60 }));
        const at = (btn, dx = 16, dy = 12) => { const p = layoutPos(btn, row); return { x: p.cx + dx, y: p.cy + dy }; };
        const a = at(likeBtn);
        const b = at(subBtn);
        const c = at(bellBtn, 10, 14);
        keys = [
            { t: 0.9, x: a.x + 70, y: a.y + 190 },
            { t: 1.45, x: a.x, y: a.y, ease: ease.inOutCubic },
            { t: 1.95, x: a.x, y: a.y },
            { t: 2.55, x: b.x, y: b.y, ease: ease.inOutCubic },
            { t: 3.05, x: b.x, y: b.y },
            { t: 3.65, x: c.x, y: c.y, ease: ease.inOutCubic },
            { t: 4.2, x: c.x, y: c.y },
            { t: 4.8, x: c.x + 90, y: c.y + 160, ease: ease.inCubic },
        ];
    }
    if (values.bursts) {
        bursts.push(iconBurst(likeBtn, { name: 'like', count: 6, color: values.likeColor, size: [20, 32], start: CLICKS.like, duration: 1.0, radius: 90, rise: 50, seed: 3 }));
        bursts.push(iconBurst(bellBtn, { name: 'bell', count: 5, color: values.bellColor, size: [18, 28], start: CLICKS.bell, duration: 1.0, radius: 80, rise: 50, seed: 8 }));
    }
    return { likeBtn, likeBefore, likeAfter, subBtn, subBefore, subAfter, bellBtn, bellIcon, dot, cursor, keys, bursts };
}

function render(t, s) {
    const out = prog(t, 6.4, 7.0, ease.inCubic);
    const buttons = [s.likeBtn, s.subBtn, s.bellBtn];
    const presses = [pressAt(t, CLICKS.like), pressAt(t, CLICKS.subscribe), pressAt(t, CLICKS.bell)];
    buttons.forEach((node, i) => {
        const p = prog(t, 0.1 + i * 0.22, 0.65 + i * 0.22, ease.outBack);
        set(node, { opacity: Math.min(1, p * 2) * (1 - out), transform: `translateY(${(1 - p) * 30 + out * 16}px) scale(${Math.max(0, p) * (1 - 0.07 * presses[i])})` });
    });

    // Like: cinza → azul com pulinho
    const like = prog(t, CLICKS.like, CLICKS.like + 0.16, ease.outCubic);
    s.likeBefore.style.opacity = 1 - like;
    set(s.likeAfter, { opacity: like, transform: `scale(${lerp(0.92, 1, ease.outBack(like))})` });

    // Inscreva-se → Inscrito
    const sub = prog(t, CLICKS.subscribe, CLICKS.subscribe + 0.18, ease.outCubic);
    s.subBefore.style.opacity = 1 - sub;
    set(s.subAfter, { opacity: sub, transform: `scale(${lerp(0.92, 1, ease.outBack(sub))})` });

    // Sininho: balança (oscilação amortecida) e o aviso aparece
    const ring = clampRing(t - CLICKS.bell);
    s.bellIcon.style.transform = `rotate(${ring}deg)`;
    s.dot.style.transform = `scale(${Math.max(0, prog(t, CLICKS.bell + 0.05, CLICKS.bell + 0.4, ease.outBack))})`;

    if (s.cursor) {
        const c = track(t, s.keys);
        const visible = prog(t, 0.9, 1.2, ease.linear) * (1 - prog(t, 4.4, 4.8, ease.linear));
        const press = Math.max(...presses);
        set(s.cursor, { opacity: visible, transform: `translate(${c.x}px, ${c.y}px) scale(${1 - 0.14 * press})` });
    }
    s.bursts.forEach((burst) => burst(t));
}

/** Ângulo do sininho: balanço amortecido durante ~1,2 s depois do clique. */
function clampRing(elapsed) {
    if (elapsed < 0 || elapsed > 1.3) return 0;
    return Math.sin(elapsed * 28) * 24 * Math.exp(-elapsed * 3.2);
}

export default {
    meta: { id: 'like-inscreva-sininho' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 4.8,
    pause: { at: 4.7, length: 1.7, min: 0.5 },
    sounds: [
        { at: 0.1, sound: 'whoosh-in', gain: 0.3 },
        { at: CLICKS.like, sound: 'pop', gain: 0.55 },
        { at: CLICKS.subscribe, sound: 'pop', gain: 0.55 },
        { at: CLICKS.bell, sound: 'pop', gain: 0.55 },
        { at: 6.4, sound: 'whoosh-out', gain: 0.3 },
    ],
    setup,
    render,
};

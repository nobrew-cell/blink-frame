/**
 * Cartão de Inscreva-se
 * Foto do canal com anel, nome e @, botão vermelho. Um cursor chega, clica e o botão vira "Inscrito" (cinza, com ✓)
 * soltando corações. Os dois textos do botão são campos: o de depois do clique é "Inscrito".
 *
 * Linha do tempo (s):  0.00 cartão · 0.25 foto · 0.40 textos · 0.50 botão · 0.9 cursor aparece · 2.1 chega no botão
 *                      2.15 clique · 2.30 vira "Inscrito" + corações · 3.2 cursor some
 *                      PAUSA (padrão 1,8 s) · 5.3 saída · 5.9 fim
 */
import { el, set, fit, field, controls, opacityControls, prog, ease, lerp } from '../../engine/kit.js';
import { anchor, backdrop, iconNode, icon, initials, layoutPos, cursorNode, iconBurst, track } from '../../engine/parts.js';

const DURATION = 5.9;
const CLICK = 2.3;

const fields = [
    field.text('channel', 'Nome do canal', 'Uma Palavra Clara', { maxLength: 30 }),
    field.text('handle', 'Usuário (@)', '@umapalavraclara', { maxLength: 32, allowEmpty: true }),
    field.text('buttonText', 'Botão antes do clique', 'Inscreva-se', { maxLength: 16 }),
    field.text('doneText', 'Botão depois do clique', 'Inscrito', { maxLength: 16 }),
    field.image('avatar', 'Foto do canal (opcional)'),
    field.toggle('badge', 'Selo de play na foto', true, { section: 'media' }),
    field.toggle('showCursor', 'Cursor clicando no botão', true, { section: 'appearance' }),
    field.toggle('hearts', 'Corações ao clicar', true, { section: 'appearance' }),
    field.color('ring', 'Cor do anel da foto', '#ff7a1a'),
    ...controls({ accent: '#ff2a3d', text: '#ffffff', plate: '#15161b', font: 'inter', position: 'center' }),
    ...opacityControls([['card', 'Fundo do cartão'], ['avatar', 'Foto'], ['info', 'Nome e usuário'], ['button', 'Botão'], ['cursor', 'Cursor']]),
];

function setup(root, ctx) {
    const { values } = ctx;
    const box = anchor(root, ctx);
    const card = el('div', { display: 'flex', alignItems: 'center', gap: '24px', padding: '20px 26px 20px 22px', boxSizing: 'border-box' }, box);
    const bg = backdrop(card, 'var(--plate)');
    set(bg, { borderRadius: '30px', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' });
    ctx.layer('card', bg);

    // Foto com anel (+ selo de play)
    const avatar = ctx.layer('avatar', el('div', { position: 'relative', width: '104px', height: '104px', flex: 'none' }, card));
    const ringNode = el('div', { position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(from 200deg, var(--ring, #ff7a1a), #ff3d3d, var(--ring, #ff7a1a))' }, avatar);
    ringNode.style.setProperty('--ring', values.ring);
    const photo = el('div', { position: 'absolute', inset: '5px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#6d5dfc,#a855f7)', display: 'grid', placeItems: 'center' }, avatar);
    if (values.avatar) {
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = values.avatar;
        set(img, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
        photo.append(img);
    } else {
        el('div', { font: '700 40px/1 var(--font)', color: '#fff' }, photo, initials(values.channel, 'CH'));
    }
    if (values.badge) {
        const badge = el('div', { position: 'absolute', right: '-2px', bottom: '-2px', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--plate)', boxSizing: 'border-box', display: 'grid', placeItems: 'center' }, avatar);
        icon('play', 16, '#fff', badge);
    }

    // Nome e @
    const info = ctx.layer('info', el('div', { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }, card));
    const name = el('div', { font: '700 40px/1.1 var(--font)', color: 'var(--text)', whiteSpace: 'nowrap' }, info, values.channel);
    fit(name, { maxWidth: 380, maxSize: 40, minSize: 22 });
    if (values.handle) {
        const handle = el('div', { font: '400 26px/1.2 var(--font)', color: 'var(--text)', opacity: 0.55, whiteSpace: 'nowrap' }, info, values.handle);
        fit(handle, { maxWidth: 380, maxSize: 26, minSize: 16 });
    }

    // Botão: duas faces empilhadas (antes e depois do clique), a largura é a da maior
    const button = ctx.layer('button', el('div', { position: 'relative', display: 'grid', marginLeft: '10px', flex: 'none' }, card));
    const faceStyle = { gridArea: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 36px', height: '76px', borderRadius: '38px', font: '700 30px/1 var(--font)', whiteSpace: 'nowrap' };
    const before = el('div', { ...faceStyle, background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 22px rgba(0,0,0,0.35)' }, button);
    icon('bell', 28, '#fff', before);
    el('span', {}, before, values.buttonText);
    const after = el('div', { ...faceStyle, background: '#2d2e35', color: '#fff', opacity: 0 }, button);
    icon('check', 28, '#fff', after);
    el('span', {}, after, values.doneText);

    // Cursor e corações
    let cursor = null;
    let cursorKeys = null;
    let burst = null;
    if (values.showCursor) {
        cursor = ctx.layer('cursor', cursorNode(card, { size: 58 }));
        const target = layoutPos(button, card);
        cursorKeys = [
            { t: 0.9, x: target.cx + 190, y: target.cy + 170 },
            { t: 2.1, x: target.cx + 14, y: target.cy + 10, ease: ease.inOutCubic },
            { t: 3.0, x: target.cx + 14, y: target.cy + 10 },
            { t: 3.5, x: target.cx + 120, y: target.cy + 120, ease: ease.inCubic },
        ];
    }
    if (values.hearts) burst = iconBurst(button, { name: 'heart', count: 9, color: '#ff4d6d', start: CLICK, duration: 1.2, radius: 130, rise: 60, seed: 5 });
    return { card, avatar, photo, info, button, before, after, cursor, cursorKeys, burst };
}

function render(t, s) {
    const enter = (a, b, e = ease.outCubic) => prog(t, a, b, e);
    const out = prog(t, 5.3, 5.9, ease.inCubic);
    const inCard = enter(0, 0.5);
    set(s.card, { opacity: inCard * (1 - out), transform: `translateY(${(1 - inCard) * 26 + out * 14}px) scale(${0.96 + 0.04 * inCard})` });

    const a = enter(0.25, 0.75, ease.outBack);
    set(s.avatar, { opacity: Math.min(1, a * 2), transform: `scale(${Math.max(0, a)})` });
    const i = enter(0.4, 0.9);
    set(s.info, { opacity: i, transform: `translateX(${(1 - i) * 18}px)` });

    // Botão: entra, "afunda" no clique, troca de face com um pulinho
    const b = enter(0.5, 1.0, ease.outBack);
    const press = prog(t, CLICK - 0.15, CLICK, ease.outQuad) * (1 - prog(t, CLICK, CLICK + 0.2, ease.outQuad));
    const swap = prog(t, CLICK, CLICK + 0.18, ease.outCubic);
    set(s.button, { opacity: Math.min(1, b * 2), transform: `scale(${Math.max(0, b) * (1 - 0.07 * press)})` });
    s.before.style.opacity = 1 - swap;
    set(s.after, { opacity: swap, transform: `scale(${lerp(0.9, 1, ease.outBack(swap))})` });

    if (s.cursor) {
        const c = track(t, s.cursorKeys);
        const visible = prog(t, 0.9, 1.2, ease.linear) * (1 - prog(t, 3.2, 3.5, ease.linear));
        set(s.cursor, { opacity: visible, transform: `translate(${c.x}px, ${c.y}px) scale(${1 - 0.14 * press})` });
    }
    s.burst?.(t);
}

export default {
    meta: { id: 'cartao-inscreva-se' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: DURATION,
    thumbAt: 3.0,
    pause: { at: 3.5, length: 1.8, min: 0.5 },
    sounds: [
        { at: 0.05, sound: 'whoosh-in', gain: 0.35 },
        { at: 0.5, sound: 'pop', gain: 0.25 },
        { at: CLICK, sound: 'pop', gain: 0.6 },
        { at: 5.3, sound: 'whoosh-out', gain: 0.35 },
    ],
    setup,
    render,
};

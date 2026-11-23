/**
 * Créditos Rolantes
 * Rolagem contínua (sobe, como no cinema, ou desce). Aqui não existe "pausa": a duração depende do TAMANHO do
 * conteúdo e da velocidade escolhida: (altura da tela + altura dos créditos) ÷ velocidade. Depois da rolagem o
 * vídeo termina com a logo (opcional).
 *
 * Conteúdo, de cima para baixo: título · grupos (# TÍTULO, função | nome, nomes soltos, ~ observações) ·
 * logos de apoiadores · direitos. Os blocos são separados por linhas em branco no texto (veja engine/credits.js).
 */
import { el, set, field, controls, opacityControls, prog, ease } from '../../engine/kit.js';
import { groupsToText } from '../../engine/credits-data.js';
import { parseCredits, creditBlock, endCard, EXAMPLES_ROLL } from '../../engine/credits.js';

const LEAD = 0.4;


const fields = [
    field.text('title', 'Título (no início da rolagem)', 'CRÉDITOS', { maxLength: 40, allowEmpty: true }),
    field.text('subtitle', 'Subtítulo do título', '', { maxLength: 80, allowEmpty: true }),
    field.credits('credits', 'Créditos', EXAMPLES_ROLL[0].value, { examples: EXAMPLES_ROLL }),
    field.text('logosTitle', 'Título do bloco de logos', 'APOIO', { maxLength: 40, allowEmpty: true }),
    field.images('logos', 'Logos de apoiadores / empresas (até 8)', { max: 8 }),
    field.paragraph('footer', 'Texto de direitos (rodapé da rolagem)', '© 2026 Seu Canal. Todos os direitos reservados.', { rows: 3, maxLength: 600, allowEmpty: true }),

    field.select('direction', 'Direção da rolagem', 'up', [{ value: 'up', label: 'Sobe' }, { value: 'down', label: 'Desce' }], { control: 'segmented', section: 'layout' }),
    field.select('layoutStyle', 'Estilo dos créditos', 'pairs', [
        { value: 'pairs', label: 'Duas colunas (função | nome)' }, { value: 'stack', label: 'Centralizado (função acima do nome)' },
    ], { section: 'layout' }),
    field.range('width', 'Largura do bloco', 0.6, { min: 0.3, max: 0.95, step: 0.01, display: 'percent', section: 'layout' }),

    field.range('rollSpeed', 'Velocidade da rolagem (px por segundo)', 110, { min: 40, max: 320, step: 5, section: 'timing' }),

    field.toggle('showEnd', 'Terminar com a logo', true, { section: 'media' }),
    field.icon('icon', 'Logo final', 'blinkframe', { choices: ['blinkframe', 'star', 'bolt', 'globe', 'broadcast', 'mic', 'tv', 'camera', 'heart', 'music', 'quote', 'bell'] }),
    field.text('endText', 'Texto da logo final', 'Seu Canal', { maxLength: 40, allowEmpty: true, section: 'media' }),
    field.range('endSeconds', 'Tempo da logo final', 3, { min: 1, max: 10, step: 0.5, display: 'seconds', section: 'timing' }),

    field.range('dim', 'Escurecer o vídeo ao fundo', 0.35, { min: 0, max: 0.9, step: 0.05, display: 'percent', section: 'appearance' }),
    field.toggle('fadeEdges', 'Esmaecer no topo e embaixo', true, { section: 'appearance' }),
    field.toggle('nameCaps', 'Nomes em CAIXA ALTA', true, { section: 'appearance' }),
    field.toggle('roleCaps', 'Funções em CAIXA ALTA', false, { section: 'appearance' }),
    ...controls({ accent: '#ffb703', text: '#ffffff', font: 'inter', position: 'center', speed: false }),
    ...opacityControls([['heading', 'Títulos'], ['items', 'Funções e nomes'], ['logos', 'Logos de apoiadores'], ['footer', 'Rodapé'], ['logo', 'Logo final']]),
];

function setup(root, ctx) {
    const { values, W, H } = ctx;
    const scale = values.scale ?? 1;
    const u = (px) => Math.round(px * scale);
    const mx = Math.max(60, Math.round(W * 0.06));
    const position = values.position ?? 'center';
    const colW = Math.round(Math.min(W - mx * 2, W * values.width));
    const left = { left: mx, center: Math.round((W - colW) / 2), right: W - mx - colW }[position];

    const dim = el('div', { position: 'absolute', inset: 0, background: '#000', opacity: 0 }, root);
    const viewport = el('div', { position: 'absolute', inset: 0, overflow: 'hidden' }, root);
    if (values.fadeEdges) {
        const mask = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';
        set(viewport, { maskImage: mask, webkitMaskImage: mask });
    }
    const align = { left: 'flex-start', center: 'center', right: 'flex-end' }[position];
    const col = el('div', { position: 'absolute', top: 0, left: `${left}px`, width: `${colW}px`, display: 'flex', flexDirection: 'column', alignItems: align, gap: `${u(84)}px`, textAlign: position, willChange: 'transform' }, viewport);

    // Título
    if (values.title || values.subtitle) {
        const block = el('div', { display: 'flex', flexDirection: 'column', alignItems: align, gap: `${u(16)}px`, marginBottom: `${u(20)}px` }, col);
        if (values.title) ctx.layer('heading', el('div', { font: `800 ${u(78)}px/1.1 var(--font)`, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--text)' }, block, values.title));
        if (values.subtitle) ctx.layer('heading', el('div', { font: `500 ${u(26)}px/1.3 var(--font)`, letterSpacing: '0.12em', color: 'var(--accent)' }, block, values.subtitle));
    }

    // Grupos
    for (const page of parseCredits(groupsToText(values.credits))) {
        const holder = el('div', { width: '100%', display: 'flex', flexDirection: 'column', alignItems: align }, col);
        const block = creditBlock(holder, page, { style: values.layoutStyle, align: position, nameCaps: values.nameCaps, roleCaps: values.roleCaps, u });
        if (block.heading) ctx.layer('heading', block.heading);
        if (block.sub) ctx.layer('heading', block.sub);
        for (const item of block.items) for (const node of item) ctx.layer('items', node);
    }

    // Logos de apoiadores
    if (values.logos.length) {
        const block = ctx.layer('logos', el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${u(30)}px`, width: '100%' }, col));
        if (values.logosTitle) el('div', { font: `800 ${u(26)}px/1.2 var(--font)`, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent)' }, block, values.logosTitle);
        const row = el('div', { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: `${u(34)}px ${u(64)}px` }, block);
        for (const src of values.logos) {
            const img = document.createElement('img');
            img.alt = '';
            img.draggable = false;
            img.src = src;
            set(img, { height: `${u(88)}px`, maxWidth: `${u(280)}px`, objectFit: 'contain', display: 'block' });
            row.append(img);
        }
    }

    // Direitos
    if (values.footer) {
        const footer = ctx.layer('footer', el('div', { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${u(8)}px`, textAlign: 'center' }, col));
        for (const line of values.footer.split('\n')) if (line.trim()) el('div', { font: `400 ${u(19)}px/1.45 var(--font)`, color: 'var(--text)', opacity: 0.55 }, footer, line.trim());
    }

    // Linha do tempo (a altura só é conhecida depois do layout)
    const contentH = col.offsetHeight;
    const speed = values.rollSpeed;
    const rollEnd = LEAD + (H + contentH) / speed;
    let end = null;
    let endStart = 0;
    let total;
    const OUT = 0.8;
    if (values.showEnd) {
        end = endCard(root, ctx, { icon: values.icon, text: values.endText });
        ctx.layer('logo', end.node);
        endStart = rollEnd + 0.3;
        total = endStart + 0.9 + values.endSeconds + OUT + 0.2;
    } else {
        total = rollEnd + 0.7;
    }
    return { dim, col, end, endStart, contentH, speed, rollEnd, total, up: values.direction !== 'down', dimLevel: values.dim, H, outStart: total - OUT - 0.2, thumb: Math.max(0.5, LEAD + ((H + contentH) / speed) * 0.42) };
}

function render(t, s) {
    const run = Math.max(0, t - LEAD) * s.speed;
    const y = s.up ? s.H - run : -s.contentH + run;
    s.col.style.transform = `translateY(${y}px)`;

    const fadeIn = prog(t, 0, 0.6, ease.linear);
    const fadeOut = prog(t, s.outStart, s.outStart + 0.8, ease.linear);
    s.dim.style.opacity = s.dimLevel * fadeIn * (1 - fadeOut);

    if (s.end) {
        const enter = prog(t, s.endStart, s.endStart + 0.9, ease.linear);
        const out = prog(t, s.outStart, s.outStart + 0.8, ease.inCubic);
        s.end.node.style.opacity = enter * (1 - out);
        s.end.update(enter);
    }
}

export default {
    meta: { id: 'creditos-rolantes' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: (state) => state.total,
    sounds: [{ at: 0.05, sound: 'whoosh-in', gain: 0.3 }],
    thumbAt: (state) => state.thumb,
    setup,
    render,
};

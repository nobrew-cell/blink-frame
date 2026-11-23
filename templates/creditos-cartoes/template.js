/**
 * Créditos em Cartões
 * Os créditos "importantes", um cartão por vez (como nos filmes: Direção, Produção, Roteiro…).
 * Os créditos são TEXTO (um por linha, `Função | Nome`; `# GRUPO`; linha em branco = próximo cartão — veja
 * engine/credits.js). Nesta versão NÃO há uma pausa única: cada cartão tem o seu tempo, e a duração total é a soma
 * de: título de abertura + cartões + logo final. O vídeo fica mais longo conforme você acrescenta créditos.
 *
 * Cada cartão: entra (0,55 s) → fica (Tempo de cada cartão) → sai (0,45 s). Opcional: título antes e logo no fim.
 * Posição: esquerda/centro/direita + cima/meio/baixo; "de onde entra": suave, esquerda, direita, cima ou baixo.
 */
import { el, set, field, controls, opacityControls, prog, ease } from '../../engine/kit.js';
import { groupsToText } from '../../engine/credits-data.js';
import { parseCredits, creditBlock, endCard, LAYOUT_STYLES, EXAMPLES_CARDS } from '../../engine/credits.js';

const IN = 0.55;
const OUT = 0.45;
const GAP = 0.1;
const LEAD = 0.3;

const DEFAULT_CREDITS = `# EQUIPE
Direção | Danny Williams
Produção | Nelly Anderson
Roteiro | Rayn Mooren

# EQUIPE TÉCNICA
Fotografia | Tyler Young
Edição | Thomas Bru
Som | James Donald
Trilha sonora | Kevin Bruch

# ELENCO | em ordem de aparição
Marina | Ana Souza
Carlos | Bruno Lima
Dona Lúcia | Carla Dias`;


const fields = [
    field.text('title', 'Título de abertura', 'CRÉDITOS', { maxLength: 40, allowEmpty: true }),
    field.text('subtitle', 'Subtítulo da abertura', 'Quem fez isso acontecer', { maxLength: 80, allowEmpty: true }),
    field.credits('credits', 'Créditos', DEFAULT_CREDITS, { examples: EXAMPLES_CARDS }),
    field.toggle('onePerCard', 'Um crédito por cartão (cada função vira um cartão)', false, { section: 'content' }),

    field.select('vertical', 'Posição vertical', 'middle', [{ value: 'top', label: 'Cima' }, { value: 'middle', label: 'Meio' }, { value: 'bottom', label: 'Baixo' }], { control: 'segmented', section: 'layout' }),
    field.select('enterFrom', 'De onde entra', 'auto', [
        { value: 'auto', label: 'Automático (do lado da posição)' }, { value: 'fade', label: 'Suave (aparece)' },
        { value: 'left', label: 'Da esquerda' }, { value: 'right', label: 'Da direita' }, { value: 'top', label: 'De cima' }, { value: 'bottom', label: 'De baixo' },
    ], { section: 'layout' }),
    field.select('layoutStyle', 'Estilo dos créditos', 'stack', LAYOUT_STYLES, { section: 'layout' }),
    field.range('columns', 'Colunas (estilo grade)', 3, { min: 1, max: 4, step: 1, section: 'layout' }),

    field.range('pageSeconds', 'Tempo de cada cartão', 3.5, { min: 1.5, max: 12, step: 0.1, display: 'seconds', section: 'timing' }),
    field.toggle('autoTime', 'Mais tempo para cartões com muitas linhas', true, { section: 'timing' }),

    field.toggle('showEnd', 'Terminar com a logo', true, { section: 'media' }),
    field.icon('icon', 'Logo final', 'blinkframe', { choices: ['blinkframe', 'star', 'bolt', 'globe', 'broadcast', 'mic', 'tv', 'camera', 'heart', 'music', 'quote', 'bell'] }),
    field.text('endText', 'Texto da logo final', 'Seu Canal', { maxLength: 40, allowEmpty: true, section: 'media' }),
    field.range('endSeconds', 'Tempo da logo final', 3, { min: 1, max: 10, step: 0.5, display: 'seconds', section: 'timing' }),

    field.select('box', 'Fundo dos créditos', 'card', [
        { value: 'none', label: 'Sem fundo (só texto)' }, { value: 'card', label: 'Cartão' }, { value: 'band', label: 'Faixa na largura toda' }, { value: 'side', label: 'Painel lateral (altura toda)' },
    ], { section: 'appearance' }),
    field.range('boxOpacity', 'Opacidade do fundo', 0.72, { min: 0.1, max: 1, step: 0.02, display: 'percent', section: 'appearance' }),
    field.toggle('nameCaps', 'Nomes em CAIXA ALTA', true, { section: 'appearance' }),
    field.toggle('roleCaps', 'Funções em CAIXA ALTA', false, { section: 'appearance' }),
    ...controls({ accent: '#ffb703', text: '#ffffff', plate: '#0c0d11', font: 'inter', position: 'left', speed: false }),
    ...opacityControls([['panel', 'Fundo dos créditos'], ['heading', 'Títulos dos grupos'], ['items', 'Funções e nomes'], ['logo', 'Logo final']]),
];

const FLEX = { left: 'flex-start', center: 'center', right: 'flex-end', top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const rgba = (hex, alpha) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;

function setup(root, ctx) {
    const { values, W, H, size } = ctx;
    const scale = values.scale ?? 1;
    const u = (px) => Math.round(px * scale);
    const mx = Math.max(60, Math.round(W * 0.06));
    const my = Math.max(60, Math.round(H * 0.08));
    const position = values.position ?? 'left';
    const from = values.enterFrom === 'auto' ? { left: 'left', right: 'right', center: 'bottom' }[position] : values.enterFrom;
    const distance = values.box === 'side' ? Math.round(W * 0.2) : u(150);
    const columns = size === 'landscape' ? values.columns : Math.min(values.columns, 2);

    const pages = parseCredits(groupsToText(values.credits), { oneEach: values.onePerCard });
    const segments = [];
    let cursor = LEAD;
    const add = (segment) => {
        Object.assign(segment, { start: cursor, end: cursor + segment.in + segment.hold + segment.out });
        cursor = segment.end + GAP;
        segments.push(segment);
        return segment;
    };

    // ---- abertura ----
    if (values.title || values.subtitle) {
        const wrap = el('div', { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: `${u(22)}px`, opacity: 0, pointerEvents: 'none' }, root);
        const title = values.title ? el('div', { font: `800 ${u(88)}px/1.1 var(--font)`, textTransform: 'uppercase', color: 'var(--text)', textAlign: 'center', maxWidth: `${W - mx * 2}px` }, wrap, values.title) : null;
        const sub = values.subtitle ? el('div', { font: `500 ${u(28)}px/1.3 var(--font)`, letterSpacing: '0.12em', color: 'var(--accent)', textAlign: 'center', maxWidth: `${W - mx * 2}px` }, wrap, values.subtitle) : null;
        if (title) ctx.layer('heading', title);
        if (sub) ctx.layer('heading', sub);
        add({ kind: 'title', wrap, title, sub, in: 0.9, hold: Math.min(4, values.pageSeconds), out: 0.7 });
    }

    // ---- cartões ----
    for (const page of pages) {
        const rows = page.lines.length + (page.heading ? 1 : 0);
        const hold = Math.min(20, values.pageSeconds + (values.autoTime ? 0.45 * Math.max(0, rows - 3) : 0));
        const wrap = el('div', { position: 'absolute', inset: 0, display: 'flex', opacity: 0, pointerEvents: 'none', justifyContent: FLEX[position], alignItems: FLEX[values.vertical] }, root);
        let shell;
        let bg = null;
        if (values.box === 'band') {
            set(wrap, { alignItems: FLEX[values.vertical], justifyContent: 'stretch' });
            shell = el('div', { position: 'relative', width: '100%', boxSizing: 'border-box', padding: `${u(48)}px ${mx}px`, display: 'flex', justifyContent: FLEX[position] }, wrap);
        } else if (values.box === 'side') {
            set(wrap, { alignItems: 'stretch' });
            shell = el('div', { position: 'relative', boxSizing: 'border-box', padding: `${my}px ${u(72)}px`, display: 'flex', flexDirection: 'column', justifyContent: FLEX[values.vertical], alignItems: FLEX[position], maxWidth: `${Math.round(W * 0.7)}px` }, wrap);
        } else {
            set(wrap, { padding: `${my}px ${mx}px`, boxSizing: 'border-box' });
            shell = el('div', { position: 'relative', boxSizing: 'border-box', padding: values.box === 'card' ? `${u(46)}px ${u(62)}px` : 0, maxWidth: `${W - mx * 2}px` }, wrap);
        }
        if (values.box !== 'none') {
            bg = el('div', { position: 'absolute', inset: 0, background: rgba(values.plate, values.boxOpacity), borderRadius: values.box === 'card' ? `${u(24)}px` : 0, boxShadow: values.box === 'card' ? '0 24px 64px rgba(0,0,0,0.4)' : 'none', zIndex: 0 }, shell);
            ctx.layer('panel', bg);
        }
        const content = el('div', { position: 'relative', zIndex: 1, maxWidth: '100%' }, shell);
        const block = creditBlock(content, page, { style: values.layoutStyle, align: position, columns, nameCaps: values.nameCaps, roleCaps: values.roleCaps, u });
        const nodes = [];
        if (block.heading) { ctx.layer('heading', block.heading); nodes.push(block.heading); }
        if (block.sub) { ctx.layer('heading', block.sub); nodes.push(block.sub); }
        for (const item of block.items) for (const node of item) { ctx.layer('items', node); nodes.push(node); }
        add({ kind: 'page', wrap, shell, nodes, in: IN, hold, out: OUT });
    }

    // ---- logo final ----
    let end = null;
    if (values.showEnd) {
        end = endCard(root, ctx, { icon: values.icon, text: values.endText });
        ctx.layer('logo', end.node);
        add({ kind: 'end', card: end, in: 0.9, hold: values.endSeconds, out: 0.8 });
    }

    const total = segments.length ? cursor - GAP + 0.3 : 1;
    const firstPage = segments.find((s) => s.kind === 'page') ?? segments[0];
    return { segments, from, distance, u, total, thumb: firstPage ? firstPage.start + IN + 0.9 : 0 };
}

function render(t, s) {
    for (const seg of s.segments) {
        const pin = prog(t, seg.start, seg.start + seg.in, ease.outCubic);
        const pout = prog(t, seg.end - seg.out, seg.end, ease.inCubic);
        const visible = pin * (1 - pout);
        if (seg.kind === 'end') { seg.card.node.style.opacity = visible; if (visible > 0) seg.card.update(prog(t, seg.start, seg.start + seg.in, ease.linear)); continue; }
        seg.wrap.style.opacity = visible;
        if (visible <= 0) continue;

        if (seg.kind === 'title') {
            const spacing = 0.5 - 0.22 * ease.outCubic(prog(t, seg.start, seg.start + seg.in + 0.4, ease.linear));
            if (seg.title) set(seg.title, { letterSpacing: `${spacing}em`, transform: `translateX(${spacing * 0.5}em)` });
            continue;
        }

        const slide = (1 - pin) * s.distance + pout * s.distance * 0.45;
        const [dx, dy] = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1], fade: [0, 0] }[s.from] ?? [0, 0];
        const grow = s.from === 'fade' ? 0.97 + 0.03 * pin : 1;
        seg.shell.style.transform = `translate(${dx * slide}px, ${dy * slide}px) scale(${grow})`;

        const step = Math.min(0.09, 0.8 / Math.max(1, seg.nodes.length));
        seg.nodes.forEach((node, i) => {
            const p = prog(t, seg.start + 0.15 + i * step, seg.start + 0.65 + i * step, ease.outCubic);
            set(node, { opacity: p, transform: `translateY(${(1 - p) * s.u(14)}px)` });
        });
    }
}

export default {
    meta: { id: 'creditos-cartoes' },
    fields,
    sizes: ['landscape', 'vertical', 'square'],
    duration: (state) => state.total,
    sounds: (ctx, state) => {
        const segs = state?.segments ?? [];
        return segs.filter((g) => g.kind !== 'end').map((g) => ({ at: g.start + 0.05, sound: 'whoosh-in', gain: 0.3 })).concat([{ at: Math.max(0.1, (state?.total ?? 3) - 1.2), sound: 'whoosh-out', gain: 0.3 }]);
    },
    thumbAt: (state) => state.thumb,
    setup,
    render,
};

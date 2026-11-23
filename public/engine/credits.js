/**
 * BlinkFrame — credits.js
 * ---------------------------------------------------------------------------
 * Base compartilhada pelos templates de créditos (Créditos em Cartões e Créditos Rolantes):
 *   1) o formato de TEXTO em que o usuário escreve os créditos (parseCredits),
 *   2) peças de layout que desenham um bloco de créditos (creditBlock) em três estilos,
 *   3) o cartão final com logo (endCard),
 *   4) modelos prontos para o botão "Carregar um modelo".
 *
 * FORMATO DO TEXTO (uma linha por crédito; tudo opcional, na ordem que o usuário quiser):
 *
 *   # EQUIPE               título de um GRUPO (começa uma página nova nos cartões; vira subtítulo na rolagem)
 *   # EQUIPE | do vídeo    título + linha pequena embaixo
 *   Direção | Ana Souza    crédito: função | nome
 *   | Beto Lima            outro nome para a MESMA função da linha de cima
 *   Carla Dias             só nome (elenco, agradecimentos…)
 *   ~ Texto pequeno        observação (licença, direitos, "em ordem de aparição")
 *   (linha em branco)      separa blocos: nos cartões é uma página nova; na rolagem é um respiro maior
 *   ---                    igual à linha em branco
 */
import { el, set, prog, ease } from './kit.js';
import { iconNode } from './parts.js';

/** @typedef {{ kind: 'credit', role: string, name: string } | { kind: 'note', text: string }} Line */

/**
 * Lê o texto e devolve páginas: [{ heading, sub, lines }].
 * `oneEach: true` quebra cada crédito em uma página própria (o título do grupo vai só na primeira).
 */
export function parseCredits(text, { oneEach = false } = {}) {
    const pages = [];
    let page = null;
    const open = (heading = '', sub = '') => { page = { heading, sub, lines: [] }; pages.push(page); return page; };
    const ensure = () => page ?? open();
    for (const raw of String(text ?? '').split('\n')) {
        const line = raw.trim();
        if (!line || /^-{3,}$/.test(line)) { page = null; continue; }
        if (line.startsWith('#')) {
            const [heading, ...rest] = line.replace(/^#+\s*/, '').split('|');
            open(heading.trim(), rest.join('|').trim());
            continue;
        }
        if (line.startsWith('~')) { ensure().lines.push({ kind: 'note', text: line.replace(/^~\s*/, '') }); continue; }
        const bar = line.indexOf('|');
        if (bar === -1) ensure().lines.push({ kind: 'credit', role: '', name: line });
        else ensure().lines.push({ kind: 'credit', role: line.slice(0, bar).trim(), name: line.slice(bar + 1).trim() });
    }
    const filled = pages.filter((p) => p.heading || p.lines.length);
    if (!oneEach) return filled;
    return filled.flatMap((p) => {
        const credits = p.lines.filter((l) => l.kind === 'credit');
        if (credits.length <= 1) return [p];
        // cada função (com seus nomes de continuação) vira uma página
        const groups = [];
        for (const line of p.lines) {
            if (line.kind === 'credit' && line.role) groups.push([line]);
            else if (groups.length) groups[groups.length - 1].push(line);
            else groups.push([line]);
        }
        return groups.map((lines, index) => ({ heading: index === 0 ? p.heading : '', sub: index === 0 ? p.sub : '', lines }));
    });
}

/** Junta nomes de continuação ("| Beto") à função anterior: devolve [{ role, names[] }] e notas. */
export function mergeLines(lines) {
    const out = [];
    for (const line of lines) {
        if (line.kind === 'note') { out.push({ note: line.text }); continue; }
        const last = out[out.length - 1];
        if (!line.role && last && !last.note && last.role) last.names.push(line.name);
        else out.push({ role: line.role, names: [line.name] });
    }
    return out;
}

/* ========================================================================== */
/* Bloco de créditos                                                           */
/* ========================================================================== */

export const LAYOUT_STYLES = [
    { value: 'stack', label: 'Lista (função acima do nome)' },
    { value: 'pairs', label: 'Duas colunas (função | nome)' },
    { value: 'grid', label: 'Grade (cartões lado a lado)' },
];

/**
 * Desenha UMA página de créditos dentro de `parent`.
 * opts: { style, align: 'left'|'center'|'right', columns, nameCaps, roleCaps, u (função px → px escalado) }
 * Devolve { heading, sub, items } — `items` é uma lista de GRUPOS de nós (cada grupo é um array, normalmente de 1 nó;
 * no estilo de duas colunas são 2: função e nomes) para animar em cascata. heading/sub podem ser null.
 */
export function creditBlock(parent, page, { style = 'stack', align = 'left', columns = 3, nameCaps = true, roleCaps = false, u = (px) => px } = {}) {
    const textAlign = style === 'pairs' ? 'left' : align;
    const itemsAlign = { left: 'flex-start', center: 'center', right: 'flex-end' }[align] ?? 'flex-start';
    const box = el('div', { display: 'flex', flexDirection: 'column', alignItems: itemsAlign, textAlign, gap: `${u(22)}px`, minWidth: 0 }, parent);

    let heading = null;
    let sub = null;
    if (page.heading) {
        const group = el('div', { display: 'flex', flexDirection: 'column', alignItems: itemsAlign, gap: `${u(6)}px`, marginBottom: `${u(4)}px` }, box);
        heading = el('div', { font: `800 ${u(30)}px/1.15 var(--font)`, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }, group, page.heading);
        if (page.sub) sub = el('div', { font: `500 ${u(20)}px/1.3 var(--font)`, letterSpacing: '0.08em', color: 'var(--text)', opacity: 0.6 }, group, page.sub);
    }

    const merged = mergeLines(page.lines);
    const roleNode = (parentNode, role, extra = {}) => el('div', { font: `500 ${u(22)}px/1.25 var(--font)`, color: 'var(--text)', opacity: 0.68, textTransform: roleCaps ? 'uppercase' : 'none', letterSpacing: roleCaps ? '0.1em' : '0.01em', ...extra }, parentNode, role);
    const nameNode = (parentNode, name, extra = {}) => el('div', { font: `700 ${u(34)}px/1.2 var(--font)`, color: 'var(--text)', textTransform: nameCaps ? 'uppercase' : 'none', letterSpacing: nameCaps ? '0.04em' : '0', ...extra }, parentNode, name);
    const noteNode = (parentNode, text, extra = {}) => el('div', { font: `400 ${u(19)}px/1.4 var(--font)`, color: 'var(--text)', opacity: 0.55, ...extra }, parentNode, text);
    const items = [];

    if (style === 'pairs') {
        // Duas colunas alinhadas: função à direita da coluna esquerda, nome à esquerda da coluna direita
        const table = el('div', { display: 'grid', gridTemplateColumns: 'auto auto', columnGap: `${u(30)}px`, rowGap: `${u(14)}px`, alignItems: 'baseline', justifyContent: 'center' }, box);
        for (const entry of merged) {
            if (entry.note) {
                items.push([noteNode(table, entry.note, { gridColumn: '1 / -1', textAlign: 'center' })]);
                continue;
            }
            const role = roleNode(table, entry.role, { textAlign: 'right' });
            const names = el('div', { display: 'flex', flexDirection: 'column', gap: `${u(4)}px` }, table);
            for (const name of entry.names) nameNode(names, name, { font: `700 ${u(28)}px/1.2 var(--font)` });
            items.push([role, names]);
        }
        return { heading, sub, items };
    }

    const container = style === 'grid'
        ? el('div', { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(columns, merged.length))}, minmax(${u(200)}px, auto))`, columnGap: `${u(56)}px`, rowGap: `${u(34)}px`, justifyItems: align === 'left' ? 'start' : align === 'right' ? 'end' : 'center' }, box)
        : el('div', { display: 'flex', flexDirection: 'column', alignItems: itemsAlign, gap: `${u(24)}px` }, box);
    for (const entry of merged) {
        if (entry.note) { items.push([noteNode(container, entry.note, { gridColumn: '1 / -1' })]); continue; }
        const cell = el('div', { display: 'flex', flexDirection: 'column', alignItems: style === 'grid' ? (align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center') : itemsAlign, gap: `${u(4)}px` }, container);
        if (entry.role) roleNode(cell, entry.role);
        for (const name of entry.names) nameNode(cell, name);
        items.push([cell]);
    }
    return { heading, sub, items };
}

/* ========================================================================== */
/* Cartão final (logo)                                                         */
/* ========================================================================== */

/**
 * Logo (ícone da biblioteca ou imagem enviada) + texto, centralizados. Devolve { node, update(p) } com p = 0..1
 * (entrada); a saída fica por conta do template (opacidade do `node`).
 */
export function endCard(parent, ctx, { icon, text, size = 150 } = {}) {
    const u = (px) => px * (ctx.values.scale ?? 1);
    const node = el('div', { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: `${u(26)}px`, opacity: 0 }, parent);
    const glyph = iconNode(node, icon, u(size), { color: 'var(--text)' });
    let label = null;
    if (text) label = el('div', { font: `800 ${u(54)}px/1.1 var(--font)`, letterSpacing: '0.04em', color: 'var(--text)', textAlign: 'center', maxWidth: `${ctx.W * 0.8}px` }, node, text);
    return {
        node,
        update(enter) {
            const p = ease.outCubic(enter);
            set(glyph, { transform: `scale(${0.85 + 0.15 * ease.outBack(Math.min(1, enter))})`, opacity: p });
            if (label) set(label, { opacity: prog(enter, 0.3, 1, ease.linear), transform: `translateY(${(1 - prog(enter, 0.3, 1, ease.outCubic)) * 14}px)` });
        },
    };
}

/* ========================================================================== */
/* Modelos prontos ("Carregar um modelo")                                      */
/* ========================================================================== */

export const EXAMPLES_CARDS = [
    {
        label: 'Filme: equipe e elenco',
        value: `# EQUIPE
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
Dona Lúcia | Carla Dias

~ Nenhum animal foi ferido durante as filmagens.`,
    },
    {
        label: 'Principais: um por cartão',
        value: `Direção | Danny Williams

Produção | Nelly Anderson

Roteiro | Rayn Mooren

Fotografia | Tyler Young

Edição | Thomas Bru`,
    },
    {
        label: 'YouTube / Podcast',
        value: `# EQUIPE DO VÍDEO
Roteiro e apresentação | Seu Nome
Edição | Nome do Editor
Câmera | Nome da Câmera
Trilha sonora | Artista, Música

# AGRADECIMENTOS
Agradecimento especial | Apoiadores do canal
Obrigado por assistir!`,
    },
];

export const EXAMPLES_ROLL = [
    {
        label: 'Filme completo',
        value: `# DIREÇÃO
Direção | Danny Williams
Direção de produção | Nelly Anderson
Roteiro | Rayn Mooren

# EQUIPE TÉCNICA
Direção de fotografia | Tyler Young
Montagem | Thomas Bru
Desenho de som | James Donald
Trilha sonora original | Kevin Bruch
| Anny Carrol
Design gráfico | Karen Lam

# ELENCO | em ordem de aparição
Marina | Ana Souza
Carlos | Bruno Lima
Dona Lúcia | Carla Dias
Delegado | Eduardo Prado
Vizinhos | Fernanda Alves
| Gustavo Neri

# AGRADECIMENTOS
Prefeitura Municipal
Associação dos Moradores
Família e amigos

~ Este filme é uma obra de ficção. Qualquer semelhança com a realidade é mera coincidência.`,
    },
    {
        label: 'YouTube / Podcast',
        value: `# EQUIPE DO VÍDEO
Roteiro e apresentação | Seu Nome
Edição e finalização | Nome do Editor
Câmera | Nome da Câmera
Arte e thumbnail | Nome do Designer
Trilha sonora | Artista, Música

# AGRADECIMENTOS
Apoiadores do canal
Comunidade do Discord
Você, que assistiu até aqui

~ Músicas e efeitos sob licença Creative Commons.`,
    },
    {
        label: 'Documentário (nomes em lista)',
        value: `# UM DOCUMENTÁRIO DE
Danny Williams

# ENTREVISTADOS
Marina Souza
Carlos Lima
Lúcia Dias
Eduardo Prado

# PESQUISA E ROTEIRO
Rayn Mooren
Nelly Anderson

# IMAGENS DE ARQUIVO
Arquivo Público Municipal
Museu da Imagem e do Som

~ Obrigado a todos que compartilharam suas histórias.`,
    },
];

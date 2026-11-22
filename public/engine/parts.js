/**
 * BlinkFrame — parts.js
 * ---------------------------------------------------------------------------
 * Blocos de layout e animação reutilizáveis, construídos sobre o kit.
 *
 * Convenções:
 *   - Funções de layout devolvem o nó criado.
 *   - Funções de animação devolvem um atualizador `(t) => void` PURO em relação a `t` (segundos do template).
 *     Chame todos os atualizadores em `render(t)`.
 *   - Nada de timers, transitions ou Math.random (partículas usam `rand(seed)`).
 */

import { el, set, fit, svg, svgEl, clamp, lerp, prog, ease, rand } from './kit.js';

/* ========================================================================== */
/* Layout                                                                      */
/* ========================================================================== */

/**
 * Margens seguras do formato atual: 6% na horizontal, 8% na vertical (mínimo de 48 px).
 * Retorna { x, y, top, bottom, left, right } em pixels.
 */
export function safe(ctx) {
    const { W, H } = ctx;
    const x = Math.max(48, Math.round(W * 0.06));
    const y = Math.max(48, Math.round(H * 0.08));
    return { x, y, top: y, bottom: y, left: x, right: x };
}

/** Largura útil (em px de LAYOUT) dentro de `anchor()`, já descontando o fator de escala do usuário. */
export function layoutWidth(ctx) {
    const { x } = safe(ctx);
    const scale = ctx.values.scale ?? 1;
    return Math.floor((ctx.W - x * 2) / scale);
}

/**
 * Âncora de uma lower third: contêiner posicionado acima da margem inferior, alinhado à esquerda/centro/direita
 * e escalado pelo controle "Tamanho" (`values.scale`). Anime os FILHOS, nunca a âncora.
 *
 * Em vertical (9:16) a lower sobe para fugir da interface das redes (≈20% da altura).
 */
export function anchor(root, ctx, { position = ctx.values.position ?? 'left', bottom } = {}) {
    const { W, H, size, values } = ctx;
    const { x } = safe(ctx);
    const scale = values.scale ?? 1;
    const lift = bottom ?? Math.round(H * (size === 'vertical' ? 0.2 : size === 'square' ? 0.11 : 0.09));
    const justify = { left: 'flex-start', center: 'center', right: 'flex-end' }[position] ?? 'flex-start';
    const origin = { left: 'left', center: 'center', right: 'right' }[position] ?? 'left';
    const row = el('div', {
        position: 'absolute', left: 0, right: 0, bottom: `${lift}px`, padding: `0 ${x}px`,
        display: 'flex', justifyContent: justify,
    }, root);
    return el('div', {
        display: 'flex', flexDirection: 'column',
        alignItems: { left: 'flex-start', center: 'center', right: 'flex-end' }[position] ?? 'flex-start',
        maxWidth: `${Math.floor((W - x * 2) / scale)}px`,
        transform: `scale(${scale})`, transformOrigin: `${origin} bottom`,
    }, row);
}

/** Linha de largura total no `top` indicado, com o filho alinhado à esquerda/centro/direita dentro das margens seguras. */
export function row(root, ctx, top, position = 'left') {
    const { x } = safe(ctx);
    return el('div', {
        position: 'absolute', left: 0, right: 0, top: `${top}px`, padding: `0 ${x}px`, display: 'flex',
        justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[position],
        textAlign: position,
    }, root);
}

/** Pilha vertical centralizada na área segura. */
export function stack(root, ctx, { gap = 16, align = 'center' } = {}) {
    const { x, y } = safe(ctx);
    return el('div', {
        position: 'absolute', left: `${x}px`, right: `${x}px`, top: `${y}px`, bottom: `${y}px`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align, gap: `${gap}px`,
    }, root);
}

/** Pilha horizontal centralizada verticalmente na área segura. */
export function hstack(root, ctx, { gap = 16, align = 'center' } = {}) {
    const { x, y } = safe(ctx);
    return el('div', {
        position: 'absolute', top: `${y}px`, bottom: `${y}px`, left: `${x}px`, right: `${x}px`,
        display: 'flex', alignItems: align, justifyContent: 'center', gap: `${gap}px`,
    }, root);
}

/** Placa de fundo da tela inteira (cor sólida ou gradiente). Útil para templates não transparentes. */
export function plate(root, color = 'var(--plate, #0b0b0d)') {
    return el('div', { position: 'absolute', inset: 0, background: color, zIndex: -1 }, root);
}

/** Barra inferior na margem segura, com texto opcional e traço de destaque. */
export function bar(root, ctx, { text = '', font = '600 22px var(--font)', color = 'var(--text, #fff)', accent = 'var(--accent, #ffb703)' } = {}) {
    const { y } = safe(ctx);
    const container = el('div', {
        position: 'absolute', left: 0, right: 0, bottom: 0, height: `${y}px`,
        display: 'flex', alignItems: 'center', padding: `0 ${y}px`,
    }, root);
    if (text) el('div', { font, color, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, container, text);
    el('div', { width: '64px', height: '3px', background: accent, flex: 'none', marginLeft: '16px' }, container);
    return container;
}

/* ========================================================================== */
/* Transformações de entrada                                                   */
/* ========================================================================== */

/** `transform` de entrada vindo do lado em que o elemento está (de baixo quando centralizado). p: 0..1 */
export const slide = (position, p, distance = 120) => {
    const d = (1 - p) * distance;
    if (position === 'right') return `translateX(${d}px)`;
    if (position === 'center') return `translateY(${d * 0.7}px)`;
    return `translateX(${-d}px)`;
};

/** `clip-path` que revela o elemento a partir do seu lado (do centro, quando centralizado). p: 0..1 */
export const wipe = (position, p) => {
    const hidden = `${(1 - clamp(p)) * 100}%`;
    if (position === 'right') return `inset(0 0 0 ${hidden})`;
    if (position === 'center') return `inset(0 calc(${hidden} / 2) 0 calc(${hidden} / 2))`;
    return `inset(0 ${hidden} 0 0)`;
};

/* ========================================================================== */
/* Texto                                                                       */
/* ========================================================================== */

/**
 * Ícone de um campo `field.icon`: id da biblioteca (desenhado em `color`) OU imagem enviada pelo usuário
 * (mantém as próprias cores, ajustada ao quadrado `size`). Retorna o nó criado.
 */
export function iconNode(parent, value, size, { color = 'currentColor', styles = {} } = {}) {
    if (typeof value === 'string' && value.startsWith('data:')) {
        const box = el('div', { width: `${size}px`, height: `${size}px`, flex: 'none', ...styles }, parent);
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = value;
        set(img, { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
        box.append(img);
        return box;
    }
    return svg(value, parent, { width: `${size}px`, height: `${size}px`, color, flex: 'none', ...styles });
}

/** Ícone do kit com tamanho e cor. */
export const icon = (name, size, color, parent, extra = {}) =>
    svg(name, parent, { width: `${size}px`, height: `${size}px`, color, flex: 'none', ...extra });

/** Linha de texto única, ajustada a `maxWidth`. `fontValue` é o shorthand CSS `font` (ex.: '700 48px var(--font)'). */
export function line(parent, text, fontValue, maxWidth, maxSize, minSize = 18, styles = {}) {
    const node = el('div', { font: fontValue, whiteSpace: 'nowrap', display: 'inline-block', ...styles }, parent, text);
    fit(node, { maxWidth, maxSize, minSize });
    return node;
}

/** Divide o texto em <span> por palavra (espaços preservados entre elas). */
export const words = (parent, text, styles = {}) =>
    text.split(/\s+/).filter(Boolean).map((word, i, all) => {
        const node = el('span', { display: 'inline-block', whiteSpace: 'pre', ...styles }, parent, word);
        if (i < all.length - 1) parent.appendChild(document.createTextNode(' '));
        return node;
    });

/** Iniciais para avatar: "Jane Doe" → "JD". */
export const initials = (text, fallback = 'YN') =>
    text.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || fallback;

/**
 * Fundo próprio (camada separada) para um contêiner: assim a opacidade do fundo muda sem afetar o conteúdo.
 * O contêiner vira um contexto de empilhamento; o fundo fica atrás dos filhos. Registre o retorno com ctx.layer().
 */
export function backdrop(parent, background) {
    set(parent, { position: 'relative', isolation: 'isolate' });
    return el('div', { position: 'absolute', inset: 0, background, zIndex: -1, pointerEvents: 'none' }, parent);
}

/**
 * Linha de texto dentro de uma "máscara" (overflow: hidden): o texto sobe de baixo para dentro da máscara.
 * Retorna { wrap, node, update(p) } — `p` 0 = escondido abaixo, 1 = visível, valores acima de 1 = sai por cima.
 */
export function maskLine(parent, text, styles = {}) {
    const wrap = el('div', { overflow: 'hidden', padding: '0.08em 0.02em', margin: '-0.08em -0.02em' }, parent);
    const node = el('div', { whiteSpace: 'nowrap', display: 'inline-block', ...styles }, wrap, text);
    return {
        wrap,
        node,
        update: (p) => set(node, { transform: `translateY(${(1 - p) * 115}%)` }),
    };
}

/* ========================================================================== */
/* Animações — todas devolvem (t) => void                                      */
/* ========================================================================== */

/**
 * Texto que "digita" caractere a caractere (ou palavra a palavra com style:'word').
 * O texto completo permanece no layout (parte restante com opacity 0): nada pula de lugar.
 */
export function typewriter(parent, { text = '', styles = {}, cps = 30, start = 0, end, style = 'letter' } = {}) {
    const node = el('div', { whiteSpace: 'pre-wrap', ...styles }, parent);
    const shown = el('span', {}, node);
    const rest = el('span', { opacity: 0 }, node);
    const chunks = style === 'word' ? text.split(/(?<=\s)/) : [...text];
    return (t) => {
        const p = prog(t, start, end ?? start + chunks.length / cps);
        const count = Math.floor(p * chunks.length + 1e-9);
        shown.textContent = chunks.slice(0, count).join('');
        rest.textContent = chunks.slice(count).join('');
    };
}

/**
 * Entrada + saída com opacidade e deslize em um nó existente.
 *   fadeSlide(node, { position, start, end, outStart, outEnd, distance })
 * Sem `outStart` o elemento não sai.
 */
export function fadeSlide(node, { position = 'left', start = 0, end = 0.6, outStart, outEnd, distance = 80, inEase = ease.outCubic, outEase = ease.inCubic } = {}) {
    return (t) => {
        const hasOut = outStart !== undefined && t >= outStart;
        const pIn = prog(t, start, end, inEase);
        const pOut = hasOut ? prog(t, outStart, outEnd ?? outStart + 0.5, outEase) : 0;
        const p = hasOut ? 1 - pOut : pIn;
        set(node, { opacity: p, transform: slide(position, p, distance) });
    };
}

/** Contador que sobe de `from` até `to`. */
export function counter(parent, { from = 0, to = 100, styles = {}, suffix = '', decimals = 0, start = 0, end, easing = ease.outExpo } = {}) {
    const node = el('div', { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...styles }, parent);
    return (t) => {
        const p = prog(t, start, end ?? start + 1, easing);
        node.textContent = lerp(from, to, p).toFixed(decimals) + suffix;
    };
}

/** Anel de progresso (SVG). */
export function ring(parent, { radius = 48, stroke = 8, color = 'var(--accent, #ffb703)', bg = 'rgba(255,255,255,0.15)', start = 0, end, clockwise = true } = {}) {
    const size = (radius + stroke) * 2;
    const c = radius + stroke;
    const circumference = 2 * Math.PI * radius;
    const root = svgEl('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` }, parent);
    root.style.transform = 'rotate(-90deg)';
    svgEl('circle', { cx: c, cy: c, r: radius, fill: 'none', stroke: bg, 'stroke-width': stroke }, root);
    const fg = svgEl('circle', {
        cx: c, cy: c, r: radius, fill: 'none', stroke: color, 'stroke-width': stroke,
        'stroke-linecap': 'round', 'stroke-dasharray': circumference, 'stroke-dashoffset': circumference,
    }, root);
    return (t) => {
        const p = prog(t, start, end ?? start + 1, ease.inOutCubic);
        fg.style.strokeDashoffset = circumference * (clockwise ? 1 - p : 1 + p);
    };
}

/** Explosão de partículas (confete/faíscas) — determinística: posições vêm de `rand(seed)`. */
export function burst(parent, { count = 30, colors = ['var(--accent, #ffb703)', '#fff'], size = [4, 12], start = 0, duration = 1.5, gravity = 400, spread = Math.PI / 3, seed = 7 } = {}) {
    const random = rand(seed);
    const particles = Array.from({ length: count }, () => {
        const angle = -Math.PI / 2 + (random() - 0.5) * spread * 2;
        const velocity = 200 + random() * 300;
        const px = size[0] + random() * (size[1] - size[0]);
        const color = colors[Math.floor(random() * colors.length)];
        const node = el('div', { position: 'absolute', width: `${px}px`, height: `${px}px`, borderRadius: '50%', background: color, opacity: 0 }, parent);
        return { node, angle, velocity };
    });
    return (t) => {
        const elapsed = t - start;
        const p = clamp(elapsed / duration);
        particles.forEach(({ node, angle, velocity }) => {
            if (elapsed <= 0 || p >= 1) { node.style.opacity = 0; return; }
            const x = Math.cos(angle) * velocity * elapsed;
            const y = Math.sin(angle) * velocity * elapsed + 0.5 * gravity * elapsed * elapsed;
            set(node, { transform: `translate(${x}px, ${y}px)`, opacity: 1 - p });
        });
    };
}

/** Traço que "desenha" de (x1,y1) a (x2,y2) — SVG com stroke-dashoffset. */
export function drawLine(parent, { x1 = 0, y1 = 0, x2 = 100, y2 = 0, stroke = 'var(--accent, #ffb703)', width = 3, start = 0, end, easing = ease.outCubic } = {}) {
    const w = Math.max(Math.abs(x2 - x1), width);
    const h = Math.max(Math.abs(y2 - y1), width);
    const root = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` }, parent);
    set(root, { position: 'absolute', left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`, overflow: 'visible' });
    const path = svgEl('path', { fill: 'none', stroke, 'stroke-width': width, 'stroke-linecap': 'round', d: `M0,0 L${Math.abs(x2 - x1)},${Math.abs(y2 - y1)}` }, root);
    const length = path.getTotalLength() || 1;
    path.style.strokeDasharray = length;
    return (t) => {
        path.style.strokeDashoffset = length * (1 - prog(t, start, end ?? start + 1, easing));
    };
}

/** Pulsação de escala (ou opacidade, com `fade: true`) periódica. */
export function pulse(node, { scale = 1.1, period = 1, fade = false } = {}) {
    return (t) => {
        const p = (Math.sin((t * 2 * Math.PI) / period) + 1) / 2;
        if (fade) node.style.opacity = lerp(0.35, 1, p);
        else node.style.transform = `scale(${lerp(1, scale, p)})`;
    };
}

/** Brilho que atravessa um elemento (faixa diagonal translúcida), uma vez entre `start` e `end`. */
export function shine(node, { start = 0, end = 1, color = 'rgba(255,255,255,0.35)', easing = ease.inOutCubic } = {}) {
    set(node, { position: node.style.position || 'relative', overflow: 'hidden' });
    const beam = el('div', {
        position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%', pointerEvents: 'none',
        background: `linear-gradient(100deg, transparent, ${color}, transparent)`, transform: 'translateX(-120%) skewX(-15deg)',
    }, node);
    return (t) => {
        const p = prog(t, start, end, easing);
        beam.style.opacity = p > 0 && p < 1 ? 1 : 0;
        beam.style.transform = `translateX(${lerp(-120, 420, p)}%) skewX(-15deg)`;
    };
}

/* ========================================================================== */
/* Cursor, trilhas de movimento e rajadas de ícones (templates de "clique")    */
/* ========================================================================== */

/**
 * Interpola entre quadros-chave: `track(t, [{ t: 0, x: 0, y: 0 }, { t: 1, x: 100, y: 40, ease: ease.inOutCubic }, …])`.
 * Antes do primeiro vale o primeiro; depois do último, o último. O `ease` de um quadro-chave vale para o trecho
 * que CHEGA nele. Valores além de x/y (ex.: `s` de escala) também são interpolados.
 */
export function track(t, keys) {
    if (t <= keys[0].t) return { ...keys[0] };
    for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i].t) {
            const a = keys[i - 1];
            const b = keys[i];
            const p = (keys[i].ease ?? ease.inOutCubic)(clamp((t - a.t) / (b.t - a.t)));
            const out = {};
            for (const name of Object.keys(b)) if (name !== 't' && name !== 'ease') out[name] = lerp(a[name] ?? b[name], b[name], p);
            return out;
        }
    }
    return { ...keys[keys.length - 1] };
}

/**
 * Ponteiro de mouse (seta). A PONTA da seta fica na origem do nó devolvido: posicione-o com `translate(x, y)`
 * e a ponta cai exatamente no ponto desejado. `size` = altura em px.
 */
export function cursorNode(parent, { size = 54, fill = '#ffffff', stroke = '#0b0b0d' } = {}) {
    const node = el('div', { position: 'absolute', left: 0, top: 0, width: `${size}px`, height: `${size}px`, pointerEvents: 'none', opacity: 0, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.45))' }, parent);
    const root = svgEl('svg', { viewBox: '0 0 24 24', width: size, height: size }, node);
    svgEl('path', { d: 'M3.2 2.2 L3.2 19.4 L7.6 15.4 L10.7 22 L13.6 20.7 L10.6 14.3 L16.6 14.3 Z', fill, stroke, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, root);
    return node;
}

/**
 * Rajada de ícones (corações, polegares, sininhos…) que sobem e somem a partir do centro do `parent`
 * (que precisa ser `position: relative/absolute`). Determinística: posições vêm de `rand(seed)`.
 * Devolve `(t) => void`. `t` é o tempo do template.
 */
export function iconBurst(parent, { name = 'heart', count = 8, color = '#ff4d6d', size = [18, 30], start = 0, duration = 1.1, radius = 90, rise = 70, seed = 11 } = {}) {
    const random = rand(seed);
    const origin = el('div', { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }, parent);
    const items = Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + ((i + random() * 0.6) / count - 0.5) * Math.PI * 1.3;
        const px = size[0] + random() * (size[1] - size[0]);
        const node = svg(name, origin, { position: 'absolute', left: `${-px / 2}px`, top: `${-px / 2}px`, width: `${px}px`, height: `${px}px`, color, opacity: 0 });
        return { node, angle, reach: radius * (0.55 + random() * 0.45), delay: random() * 0.18, spin: (random() - 0.5) * 50 };
    });
    return (t) => {
        for (const { node, angle, reach, delay, spin } of items) {
            const p = clamp((t - start - delay) / duration);
            if (p <= 0 || p >= 1) { node.style.opacity = 0; continue; }
            const out = ease.outCubic(p);
            set(node, {
                opacity: p < 0.15 ? p / 0.15 : 1 - ease.inQuad((p - 0.15) / 0.85),
                transform: `translate(${Math.cos(angle) * reach * out}px, ${Math.sin(angle) * reach * out - rise * p}px) rotate(${spin * p}deg) scale(${0.6 + 0.5 * ease.outBack(Math.min(1, p * 3))})`,
            });
        }
    };
}

/**
 * Posição (x, y em px de LAYOUT, imune a transform) de `node` dentro de `ancestor`. O ancestral precisa ser
 * posicionado (position: relative/absolute — `backdrop()` já faz isso) e nenhum nó entre os dois pode ser posicionado.
 */
export function layoutPos(node, ancestor) {
    let x = 0;
    let y = 0;
    let current = node;
    while (current && current !== ancestor) {
        x += current.offsetLeft;
        y += current.offsetTop;
        current = current.offsetParent;
    }
    return { x, y, w: node.offsetWidth, h: node.offsetHeight, cx: x + node.offsetWidth / 2, cy: y + node.offsetHeight / 2 };
}

/**
 * BlinkFrame — kit.js
 * ---------------------------------------------------------------------------
 * Núcleo do motor de animação DETERMINÍSTICO.
 *
 * Regra de ouro: `render(t, state, ctx)` depende SOMENTE de `t` (segundos).
 *   - nada de CSS transitions/animations, setTimeout, Date.now ou Math.random (use `rand(seed)`);
 *   - o quadro N sempre sai idêntico, seja no preview do editor ou na exportação quadro a quadro.
 *
 * Um template é um módulo ES com `export default { meta?, fields, sizes, duration, thumbAt, sounds, setup, render }`
 * (veja /templates/*). O runner (runner.js) importa o template e chama `defineTemplate(template)`.
 *
 * Ciclo de vida:
 *   configure({ fields, size })  →  sanitize → carrega fontes → setup(root, ctx) → render(t)
 *   window.renderFrame(t)        →  render(t * speed, state, ctx)      (t = tempo da SAÍDA, em segundos)
 *
 * Protocolo com o editor (iframe de mesma origem):
 *   editor → runner : { type: 'bf:fields', fields, size }
 *   runner → editor : { type: 'bf:ready' } (1ª vez)  e  { type: 'bf:configured' } (a cada reconfiguração)
 *   estado exposto  : window.__template  { fields, sizes, size, values, width, height, duration, thumbAt, sounds }
 */

import { FONTS, FONT_BASE } from './fonts.js';

export { FONTS };

/* ========================================================================== */
/* 1. Easings e helpers de progresso                                           */
/* ========================================================================== */

/** Curvas de easing: todas mapeiam 0..1 em 0..1 (`outBack`/`outElastic` ultrapassam 1). */
export const ease = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) =>
        x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    inBack: (x) => 2.70158 * x * x * x - 1.70158 * x * x,
    outBack: (x) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    outElastic: (x) => {
        if (x === 0 || x === 1) return x;
        return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
};

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, p) => a + (b - a) * p;

/** Progresso de `t` entre `start` e `end`, limitado a 0..1 e passado pelo easing. */
export const prog = (t, start, end, easing = ease.linear) => easing(clamp((t - start) / (end - start)));

/**
 * Entra, segura, sai: 0→1 entre inStart..inEnd, 1→0 entre outStart..outEnd.
 * Antes de inStart vale 0; depois de outEnd vale 0.
 */
export const inOut = (t, inStart, inEnd, outStart, outEnd, inEase = ease.outCubic, outEase = ease.inCubic) =>
    t < outStart ? prog(t, inStart, inEnd, inEase) : 1 - prog(t, outStart, outEnd, outEase);

/** Gerador pseudoaleatório determinístico (LCG de Park–Miller). `rand(seed)()` → número em [0, 1). */
export const rand = (seed) => {
    let s = Math.floor(Math.abs(seed)) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/* ========================================================================== */
/* 2. DOM                                                                      */
/* ========================================================================== */

/** Cria um elemento. Texto sempre via `textContent` (a entrada do usuário pode chegar aqui). */
export const el = (tag, styles = {}, parent = null, text = '') => {
    const node = document.createElement(tag);
    Object.assign(node.style, styles);
    if (text) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
};

/** Aplica estilos a um nó. */
export const set = (node, styles) => Object.assign(node.style, styles);

/** Cria um elemento SVG (namespace correto) com atributos. */
export const svgEl = (tag, attrs = {}, parent = null) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (parent) parent.appendChild(node);
    return node;
};

/** Ícones próprios do kit (viewBox 24x24, markup confiável — nunca vem do usuário). */
export const icons = {
    bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6v3.6l-1.7 3A1 1 0 0 0 5.2 16h13.6a1 1 0 0 0 .9-1.4L18 11.6V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.8-2H9.2A3 3 0 0 0 12 22Z"/></svg>',
    like: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 10h4v11H2zM8 21h9.2a2 2 0 0 0 2-1.6l1.6-7.5A2 2 0 0 0 18.9 9.5H14l.8-4.3a1.8 1.8 0 0 0-3.3-1.3L8 10z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M12 5l7 7-7 7"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M5 12l7 7 7-7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.1 4.3 2.4h2c.8-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/></svg>',
    quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20v-6.5C3 8.4 5.6 5 10 4l.8 2.2C8.3 7.1 7 9 7 11h4v9Zm10 0v-6.5C13 8.4 15.6 5 20 4l.8 2.2C18.3 7.1 17 9 17 11h4v9Z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5Z"/></svg>',
    broadcast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    at: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
};

/** Insere um dos ícones do kit dentro de um <span> inline-flex. */
export const svg = (name, parent, styles = {}) => {
    const node = el('span', { display: 'inline-flex', ...styles }, parent);
    node.innerHTML = icons[name] ?? '';
    return node;
};

/**
 * Reduz o `font-size` até o nó caber em `maxWidth` (e `maxHeight`, se informado).
 * Usa offsetWidth/offsetHeight (tamanho de LAYOUT, imune a transform/scale dos ancestrais).
 * As fontes já estão carregadas antes de `setup`, então o resultado é idêntico em toda renderização.
 *
 * - Sem `maxHeight` o nó é tratado como linha única (width: max-content).
 * - Com `maxHeight` o nó pode quebrar linha; ele precisa ter largura definida pelo contêiner.
 */
export function fit(node, { maxWidth, maxHeight = Infinity, maxSize, minSize = 12, step = 1 }) {
    if (maxHeight === Infinity) node.style.width = 'max-content';
    let size = maxSize;
    node.style.fontSize = `${size}px`;
    const overflow = () => node.offsetWidth > maxWidth + 0.5 || node.offsetHeight > maxHeight + 0.5;
    while (size > minSize && overflow()) {
        size -= step;
        node.style.fontSize = `${size}px`;
    }
    return size;
}

/** Divide o texto em <span> por caractere (espaços preservados) — para animações em cascata. */
export const letters = (parent, text, styles = {}) =>
    [...text].map((char) =>
        el('span', { display: 'inline-block', whiteSpace: 'pre', ...styles }, parent, char === ' ' ? ' ' : char),
    );

/* ========================================================================== */
/* 3. Constantes de design                                                     */
/* ========================================================================== */

/** Sem verdes: a versão .mp4 usa fundo #00FF00 (chroma key) e um verde no design seria removido junto. */
export const palette = {
    red: '#e11d2e',
    accent: '#ffb703',
    pink: '#ff3d7f',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    ink: '#0b0b0d',
    white: '#ffffff',
};

/** Formatos de saída [largura, altura]. */
export const SIZES = {
    landscape: [1920, 1080],
    vertical: [1080, 1920],
    square: [1080, 1080],
};

/* ========================================================================== */
/* 4. Fontes                                                                   */
/* ========================================================================== */

const FONT_IDS = new Set(FONTS.map((font) => font.id));

/** Valor CSS de `font-family` para um id de fonte (com fallback seguro). */
export const fontFamily = (id) => {
    const font = FONTS.find((item) => item.id === id) ?? FONTS[0];
    return `"${font.family}", Inter, system-ui, sans-serif`;
};

const loadedFonts = new Map();

/** Carrega os .woff2 de uma fonte via `FontFace` e espera ficarem prontos. Resultado em cache. */
export function loadFont(id) {
    const font = FONTS.find((item) => item.id === id);
    if (!font) return Promise.resolve();
    if (!loadedFonts.has(id)) {
        loadedFonts.set(
            id,
            Promise.all(
                Object.entries(font.files).map(async ([weight, file]) => {
                    const face = new FontFace(font.family, `url(${FONT_BASE}${file}) format('woff2')`, { weight, display: 'block' });
                    document.fonts.add(await face.load());
                }),
            ).catch((error) => console.warn(`Falha ao carregar a fonte ${id}`, error)),
        );
    }
    return loadedFonts.get(id);
}

/* ========================================================================== */
/* 5. Schema de campos (controles do editor) e sanitização                    */
/* ========================================================================== */

/**
 * Tipos de campo suportados (o editor gera o painel automaticamente a partir deles):
 *   text    { key, label, default, maxLength }
 *   color   { key, label, default }                  → "#rrggbb"
 *   font    { key, label, default }                  → id de fonts.js
 *   select  { key, label, default, options:[{value,label}] }
 *   range   { key, label, default, min, max, step, group? }   (group:'opacity' → painel "Transparência"; ver opacityControls)
 *   toggle  { key, label, default }                  → boolean
 *   image   { key, label, default: '' }              → data URL PNG/JPEG/WebP (logo)
 */

/**
 * Controles comuns. Passe só o que faz sentido para o design:
 *   controls({ accent:'#ffb703', text:'#fff', plate:'#16161a', font:'inter', position:'left', scale:true, speed:true })
 * Os templates leem as cores como variáveis CSS no palco (--accent, --text, --plate, --font)
 * e o restante em `ctx.values` (position, scale, speed).
 */
export function controls({ accent, text, plate, font, position, scale = true, speed = true } = {}) {
    const list = [];
    if (accent) list.push({ key: 'accent', type: 'color', label: 'Cor de destaque', default: accent });
    if (text) list.push({ key: 'textColor', type: 'color', label: 'Cor do texto', default: text });
    if (plate) list.push({ key: 'plate', type: 'color', label: 'Cor do fundo', default: plate });
    if (font) list.push({ key: 'font', type: 'font', label: 'Fonte', default: font });
    if (position) {
        list.push({
            key: 'position', type: 'select', label: 'Posição', default: position,
            options: [{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }],
        });
    }
    if (scale) list.push({ key: 'scale', type: 'range', label: 'Tamanho', default: 1, min: 0.6, max: 1.6, step: 0.05 });
    if (speed) list.push({ key: 'speed', type: 'range', label: 'Velocidade da animação', default: 1, min: 0.75, max: 1.5, step: 0.05 });
    return list;
}

/**
 * Opacidade independente por elemento. Declare os elementos do design e registre cada um no setup:
 *   fields: [..., ...opacityControls([['plate', 'Fundo'], ['name', 'Nome'], ['logo', 'Logo']])]
 *   setup:  ctx.layer('plate', node)      // devolve o próprio node
 * O motor multiplica, a cada quadro, a opacidade do usuário (0..1) pela opacidade que o template animou
 * no node (ou pela inicial do estilo): fade-in/out continuam funcionando, só que escalados.
 * Registre nós cuja opacidade não é a de um ancestral que já foi registrado (opacidade de pai afeta os filhos).
 */
export const opacityControls = (layers) => layers.map(([key, label]) => ({
    key: `opacity_${key}`, type: 'range', label, default: 1, min: 0, max: 1, step: 0.05, group: 'opacity',
}));

/** Campo de logo/imagem. Valor vazio = sem logo. */
export const logoField = (label = 'Logo', key = 'logo') => ({ key, type: 'image', label, default: '' });

// data: URL de uma imagem enviada (até ~8 MB)
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_IMAGE_LENGTH = 11_000_000;

/**
 * Valida/normaliza os valores segundo o schema. Chaves desconhecidas são descartadas.
 *   text: remove caracteres de controle, apara, corta em maxLength   (vazio → padrão apenas se `allowEmpty` não for true)
 *   color: #rrggbb · font: id conhecido · select: uma das opções · range: número em min..max
 *   toggle: boolean · image: SOMENTE data URL PNG/JPEG/WebP (nunca uma URL externa)
 */
export function sanitize(fields, input = {}) {
    return Object.fromEntries(
        fields.map((field) => {
            const raw = input[field.key];
            const type = field.type ?? 'text';
            let value = field.default;
            if (type === 'text' && typeof raw === 'string') {
                const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, field.maxLength ?? 200);
                value = cleaned || (field.allowEmpty ? '' : field.default);
            } else if (type === 'color' && typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw)) {
                value = raw.toLowerCase();
            } else if (type === 'font' && FONT_IDS.has(raw)) {
                value = raw;
            } else if (type === 'select' && field.options.some((option) => option.value === raw)) {
                value = raw;
            } else if (type === 'range' && raw !== null && raw !== '' && Number.isFinite(Number(raw))) {
                value = clamp(Number(raw), field.min, field.max);
            } else if (type === 'toggle' && typeof raw === 'boolean') {
                value = raw;
            } else if (type === 'image' && typeof raw === 'string' && raw.length <= MAX_IMAGE_LENGTH && IMAGE_DATA_URL.test(raw)) {
                value = raw;
            }
            return [field.key, value];
        }),
    );
}

/** <img> para um valor de campo de imagem, ajustado ao contêiner (object-fit: contain). */
export function logo(parent, src, styles = {}) {
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.src = src;
    set(img, { display: 'block', width: '100%', height: '100%', objectFit: 'contain', ...styles });
    parent.append(img);
    return img;
}

/* ========================================================================== */
/* 6. Sons                                                                     */
/* ========================================================================== */

/**
 * Cues de som de digitação: uma tecla a cada `step` segundos a partir de `start`, para `count` caracteres,
 * alternando entre key-1..3 (arquivos em /public/sounds).
 */
export const typing = (start, count, step, gain = 0.6) =>
    Array.from({ length: Math.min(count, 60) }, (_, i) => ({
        at: start + i * step,
        sound: `key-${((i * 7) % 3) + 1}`,
        gain: gain * (0.85 + ((i * 5) % 4) * 0.05),
    }));

/* ========================================================================== */
/* 7. defineTemplate — registra o template e expõe a API ao editor/exportador */
/* ========================================================================== */

/**
 * template: {
 *   meta?, fields = [], sizes = ['landscape'], fonts = [], duration, thumbAt,
 *   sounds = [] | (ctx) => [],      // [{ at: segundos, sound: 'whoosh-in', gain: 1 }] na linha do tempo do template
 *   setup(root, ctx) => state,      // constrói o DOM (UMA vez por configuração)
 *   render(t, state, ctx)           // aplica os estilos do instante t (puro!)
 * }
 * ctx: { values, size, W, H }
 *
 * Parâmetros de URL do runner: ?template=<slug>&size=landscape|vertical|square&bg=checker|scene|dark|light|green&play=1
 */
export function defineTemplate(template) {
    const fields = template.fields ?? [];
    const sizes = template.sizes ?? ['landscape'];
    const params = new URLSearchParams(location.search);
    const stage = document.getElementById('stage');

    let ctx;
    let state;
    let current = template.thumbAt ?? 0; // instante de SAÍDA mostrado (re-renderizado ao reconfigurar)
    let speed = 1;
    let calls = 0;
    let layers = []; // [{ node, base, value }] registrados por ctx.layer() no setup

    /** Aplica o instante `t` (timeline do template) e depois escala a opacidade de cada camada registrada. */
    function draw(t) {
        for (const layer of layers) layer.node.style.opacity = layer.base; // volta ao estado inicial: sem acumular entre quadros
        template.render(t, state, ctx);
        for (const layer of layers) {
            if (layer.value === 1) continue;
            const animated = layer.node.style.opacity;
            layer.node.style.opacity = String((animated === '' ? 1 : Number(animated)) * layer.value);
        }
    }

    async function configure({ fields: input = {}, size } = {}) {
        const call = ++calls;
        const chosen = sizes.includes(size) ? size : sizes[0];
        const [W, H] = SIZES[chosen];
        const values = sanitize(fields, input);

        // Fontes escolhidas carregam ANTES do setup, para `fit()` medir os glifos reais.
        const fontKeys = fields.filter((field) => field.type === 'font').map((field) => values[field.key]);
        await Promise.all([...fontKeys, ...(template.fonts ?? [])].map(loadFont));
        if (call !== calls) return window.__template; // uma chamada mais nova (digitação rápida) vence

        layers = [];
        ctx = {
            values, size: chosen, W, H,
            layer(key, node) {
                const value = values[`opacity_${key}`];
                if (node) layers.push({ node, base: node.style.opacity, value: typeof value === 'number' ? value : 1 });
                return node;
            },
        };
        speed = typeof values.speed === 'number' ? values.speed : 1;

        stage.replaceChildren();
        set(stage, { width: `${W}px`, height: `${H}px`, position: 'relative', overflow: 'hidden' });
        for (const [name, key] of [['--accent', 'accent'], ['--text', 'textColor'], ['--plate', 'plate']]) {
            if (values[key]) stage.style.setProperty(name, values[key]);
            else stage.style.removeProperty(name);
        }
        const fontField = fields.find((field) => field.type === 'font');
        stage.style.setProperty('--font', fontField ? fontFamily(values[fontField.key]) : fontFamily('inter'));
        stage.style.fontFamily = 'var(--font)';

        state = template.setup(stage, ctx) || {};

        // Imagens (logos) são desenhadas em todos os quadros: precisam estar decodificadas.
        await Promise.all([...stage.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
        if (call !== calls) return window.__template;

        draw(clamp(current * speed, 0, template.duration));

        window.__template = {
            meta: template.meta ?? {},
            fields,
            sizes,
            size: chosen,
            values,
            width: W,
            height: H,
            // Animação mais rápida = vídeo mais curto (e vice-versa).
            duration: Math.round((template.duration / speed) * 1000) / 1000,
            thumbAt: (template.thumbAt ?? template.duration / 2) / speed,
            sounds: (typeof template.sounds === 'function' ? template.sounds(ctx) : template.sounds ?? [])
                .filter((cue) => cue.at < template.duration)
                .map((cue) => ({ sound: cue.sound, gain: cue.gain ?? 1, at: Math.round((cue.at / speed) * 1000) / 1000 })),
        };
        return window.__template;
    }

    /** Renderiza o instante `t` (segundos de SAÍDA). Síncrono e puro em relação a `t`. */
    window.renderFrame = (t) => {
        current = t;
        if (state) draw(clamp(t * speed, 0, template.duration));
    };
    window.__configure = configure;

    // Reprodução em tempo real (vitrine). No editor, quem dirige o relógio é o próprio editor.
    let rafId = 0;
    window.__play = (on) => {
        cancelAnimationFrame(rafId);
        if (!on) {
            if (window.__template) window.renderFrame(window.__template.thumbAt);
            return;
        }
        const start = performance.now();
        const loop = (now) => {
            window.renderFrame(((now - start) / 1000) % window.__template.duration);
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
    };

    window.addEventListener('message', async (event) => {
        if (event.origin !== location.origin || event.data?.type !== 'bf:fields') return;
        await configure({ fields: event.data.fields ?? ctx?.values, size: event.data.size ?? ctx?.size });
        if (window.parent !== window) window.parent.postMessage({ type: 'bf:configured' }, location.origin);
    });

    return (async () => {
        await document.fonts.ready;
        await configure({ fields: decodeFields(params.get('fields')), size: params.get('size') });
        if (window.parent !== window) window.parent.postMessage({ type: 'bf:ready' }, location.origin);
        if (params.get('play')) window.__play(true);
        return true;
    })();
}

/** ?fields=base64url(JSON) — valores iniciais via URL (imagens grandes não cabem: o editor reenvia por postMessage). */
function decodeFields(param) {
    if (!param) return {};
    try {
        const base64 = param.replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const parsed = JSON.parse(new TextDecoder().decode(bytes));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

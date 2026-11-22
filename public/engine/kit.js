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
 * Protocolo com o editor (iframe de mesma origem) — nomes em protocol.js:
 *   editor → runner : { type: MSG.FIELDS, fields, size }
 *   runner → editor : MSG.READY (1ª vez)  e  MSG.CONFIGURED (a cada reconfiguração)
 *   estado exposto  : window.__template  { fields, sizes, size, values, width, height, duration, thumbAt, holdAt, sounds }
 *
 * Os campos (controles) são descritos por schema.js; os modos de exibição (editor, vitrine, ao vivo) por modes.js.
 */

import { FONTS, FONT_BASE } from './fonts.js';
import { icons } from './icons.js';
import { normalizeFields, sanitize, field } from './schema.js';
import { MSG, MODES } from './protocol.js';
import { createLoop, startLive } from './modes.js';

export { FONTS, icons };
// Contrato de campos (schema.js) reexportado: os templates importam tudo do kit.
export {
    field, controls, logoControls, iconControls, opacityControls, sanitize, normalizeFields,
    SECTIONS, SIZE_META, ALIGN_OPTIONS, SIDE_OPTIONS,
} from './schema.js';

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
/* 5. Campos: ver schema.js                                                    */
/* ========================================================================== */

/** Compatível com templates antigos: `logoField('Logo')` = `field.image('logo', 'Logo')`. */
export const logoField = (label = 'Logo', key = 'logo') => field.image(key, label);

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
 *   meta?, fields = [], sizes = ['landscape'], fonts = [], duration, thumbAt, holdAt?,
 *   sounds = [] | (ctx) => [],      // [{ at: segundos, sound: 'whoosh-in', gain: 1 }] na linha do tempo do template
 *   setup(root, ctx) => state,      // constrói o DOM (UMA vez por configuração)
 *   render(t, state, ctx)           // aplica os estilos do instante t (puro!)
 * }
 * ctx: { values, size, W, H, layer(key, node) }   (layer registra um nó para a transparência por elemento; ver schema.js)
 *
 * thumbAt = quadro de capa. holdAt = instante em que a entrada terminou e a saída não começou (modo ao vivo congela ali).
 *
 * Parâmetros de URL do runner: ?template=<slug>&size=landscape|vertical|square&bg=checker|scene|dark|light|green&mode=driven|loop|live&channel=<id>
 */
export function defineTemplate(template) {
    const fields = normalizeFields(template.fields ?? []);
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
            // Instante em que a entrada terminou e a saída ainda não começou (usado pelo modo ao vivo).
            holdAt: (template.holdAt ?? template.thumbAt ?? template.duration / 2) / speed,
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

    const api = { renderFrame: window.renderFrame, getInfo: () => window.__template, configure, stage };
    window.__play = createLoop(api); // usado pela vitrine: __play(true) anima, __play(false) volta ao quadro de capa

    window.addEventListener('message', async (event) => {
        if (event.origin !== location.origin || event.data?.type !== MSG.FIELDS) return;
        await configure({ fields: event.data.fields ?? ctx?.values, size: event.data.size ?? ctx?.size });
        if (window.parent !== window) window.parent.postMessage({ type: MSG.CONFIGURED }, location.origin);
    });

    return (async () => {
        await document.fonts.ready;
        await configure({ fields: decodeFields(params.get('fields')), size: params.get('size') });
        if (window.parent !== window) window.parent.postMessage({ type: MSG.READY }, location.origin);
        const mode = params.get('mode') || (params.get('play') ? MODES.LOOP : MODES.DRIVEN);
        if (mode === MODES.LOOP) window.__play(true);
        else if (mode === MODES.LIVE) window.__live = startLive({ ...api, channelId: params.get('channel') || 'default' });
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

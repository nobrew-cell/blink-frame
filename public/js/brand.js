/**
 * Logo interativo do BlinkFrame.
 *
 * O SVG anexado ("Aberto Normal") é carregado inline para que só a ÍRIS possa se mover:
 *  - ao passar o mouse sobre algo interativo (cards, botões, abas, campos, controles), a íris desliza
 *    de leve na direção desse elemento; ao sair, volta suavemente ao centro;
 *  - ao passar o mouse sobre a própria marca, o olho "procura o mouse" (acompanha o cursor e ganha o azul
 *    do arquivo "Aberto Procurando o Mouse").
 * Sem hover, o olho fica parado. Com prefers-reduced-motion, nada se move.
 * (Chrome da interface apenas: o determinismo só é exigido do motor de animação dos templates.)
 */

const INTERACTIVE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary', 'label.check',
    '[role="button"]', '[role="tab"]', '[role="switch"]', '[tabindex]:not([tabindex="-1"])', '.card',
].join(',');

// Deslocamento máximo da íris em unidades do SVG (viewBox 431 x 425). Com o logo a ~38 px, 1 unidade ≈ 0,09 px:
// valores abaixo de ~50 não se enxergam. A abertura do olho vai de x≈46 a x≈385; as pálpebras cobrem o excesso.
const LIMITS = {
    element: { x: 78, y: 30 }, // olhar para um elemento interativo
    mouse: { x: 90, y: 34 },   // acompanhar o cursor sobre a própria marca
};
const IRIS_BLUE = '#284F92';   // cor da íris no arquivo "Procurando o Mouse"
const BIG_ELEMENT = 240;       // elementos maiores que isso (cards, barra de tempo) são seguidos pelo ponteiro

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

async function mountEye() {
    const img = document.getElementById('brand-logo');
    if (!img) return null;
    const mark = img.parentElement;

    let svg;
    try {
        const text = await (await fetch(img.getAttribute('src'))).text();
        const parsed = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        if (parsed.nodeName !== 'svg') throw new Error('SVG inválido');
        svg = document.importNode(parsed, true);
    } catch {
        return null; // mantém o <img> estático como fallback
    }

    // A íris é o primeiro grupo dentro do grupo principal do arquivo (id "Íris").
    const iris = [...svg.querySelectorAll('g')].find((g) => g.id === 'Íris') ?? svg.querySelector(':scope > g > g');
    if (!iris) return null;
    iris.classList.add('eye-iris');

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    img.replaceWith(svg);
    return { svg, iris, mark };
}

function setGaze(eye, dx, dy, blue = false) {
    eye.iris.style.transform = dx || dy ? `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` : 'translate(0px, 0px)';
    const color = blue ? IRIS_BLUE : '';
    const use = eye.iris.querySelector(':scope > use');
    const stroke = eye.iris.querySelector(':scope > path');
    if (use) use.style.fill = color;
    if (stroke) stroke.style.stroke = color;
}

/** Converte um ponto da tela em deslocamento da íris (direção do ponto, intensidade pela distância). */
function gazeToward(eye, px, py, limits, softRadius) {
    const box = eye.svg.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const strength = clamp(dist / softRadius, 0, 1);
    return [(dx / dist) * limits.x * strength, (dy / dist) * limits.y * strength];
}

function interactiveTarget(node) {
    const el = node instanceof Element ? node.closest(INTERACTIVE) : null;
    if (!el || el.matches(':disabled, [aria-disabled="true"]') || el.closest('.brand')) return null;
    return el;
}

function wire(eye) {
    let current = null;      // elemento interativo sob o mouse
    let overBrand = false;
    let pointer = { x: 0, y: 0 };
    let frame = 0;

    const apply = () => {
        frame = 0;
        if (reduceMotion.matches) return setGaze(eye, 0, 0);
        if (overBrand) {
            const [dx, dy] = gazeToward(eye, pointer.x, pointer.y, LIMITS.mouse, 48);
            return setGaze(eye, dx, dy, true);
        }
        if (!current || !current.isConnected) return setGaze(eye, 0, 0);
        const rect = current.getBoundingClientRect();
        const big = Math.max(rect.width, rect.height) > BIG_ELEMENT;
        // Elementos pequenos: olha para o centro; grandes: para o ponto sob o cursor (dentro do elemento)
        const tx = big ? clamp(pointer.x, rect.left, rect.right) : rect.left + rect.width / 2;
        const ty = big ? clamp(pointer.y, rect.top, rect.bottom) : rect.top + rect.height / 2;
        const [dx, dy] = gazeToward(eye, tx, ty, LIMITS.element, 180);
        setGaze(eye, dx, dy);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };

    document.addEventListener('pointerover', (event) => {
        if (event.pointerType === 'touch') return;
        pointer = { x: event.clientX, y: event.clientY };
        overBrand = Boolean(event.target instanceof Element && event.target.closest('.brand'));
        current = overBrand ? null : interactiveTarget(event.target);
        schedule();
    });
    document.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        pointer = { x: event.clientX, y: event.clientY };
        if (overBrand || (current && Math.max(current.offsetWidth, current.offsetHeight) > BIG_ELEMENT)) schedule();
    }, { passive: true });
    // Mouse saiu da janela, ou o toque tomou o lugar do mouse: volta ao centro
    document.documentElement.addEventListener('pointerleave', () => { current = null; overBrand = false; schedule(); });
    window.addEventListener('blur', () => { current = null; overBrand = false; schedule(); });
    document.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'touch') { current = null; overBrand = false; schedule(); }
    });
    reduceMotion.addEventListener?.('change', schedule);
}

mountEye().then((eye) => { if (eye) wire(eye); });

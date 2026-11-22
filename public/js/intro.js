/**
 * Intro animada do BlinkFrame — aparece UMA vez a cada vez que o servidor é iniciado (o servidor informa um id de
 * execução em /api/boot; o navegador lembra qual já viu). Roteiro (~5 s):
 *
 *   0.0 s  olho fechado ("Aberto/Fechado" dos SVGs originais)
 *   0.7 s  abre normal, olhando para a frente
 *   1.5 s  procura a seta do mouse (íris azul, como em "Procurando o Mouse"): segue o cursor de verdade;
 *          se o mouse ainda não se mexeu, olha para onde ele costuma estar (canto inferior direito) e depois para o centro
 *   3.4 s  volta ao olho normal, olhando para nós; aparece o nome
 *   4.6 s  some. Clique, Esc ou "Pular" encerram antes. Com prefers-reduced-motion não aparece.
 */
import { el } from './editor/dom.js';

const SEEN_KEY = 'blinkframe:intro:boot';
const IRIS_BLUE = '#284F92';
const LIMIT = { x: 96, y: 38 }; // unidades do SVG (viewBox 431 x 425); as pálpebras cobrem o excesso

const read = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const write = (id) => { try { localStorage.setItem(SEEN_KEY, id); } catch { /* sem armazenamento: a intro só repete */ } };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadSvg(file) {
    const text = await (await fetch(`/brand/${file}`)).text();
    const svg = document.importNode(new DOMParser().parseFromString(text, 'image/svg+xml').documentElement, true);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true');
    // ids internos duplicados entre os dois SVGs quebrariam o <use>: dá um prefixo a cada arquivo
    const prefix = `${file.replace('.svg', '')}-`;
    svg.querySelectorAll('[id]').forEach((node) => { node.id = `${prefix}${node.id}`; });
    svg.querySelectorAll('use').forEach((use) => {
        const ref = use.getAttribute('xlink:href') ?? use.getAttribute('href');
        use.setAttribute('xlink:href', `#${prefix}${ref.slice(1)}`);
        use.setAttribute('href', `#${prefix}${ref.slice(1)}`);
    });
    svg.querySelectorAll('[mask]').forEach((node) => node.setAttribute('mask', `url(#${prefix}${node.getAttribute('mask').slice(5, -1)})`));
    return svg;
}

function irisOf(svg) {
    const iris = [...svg.querySelectorAll('g')].find((g) => g.id.endsWith('Íris')) ?? svg.querySelector(':scope > g > g');
    iris?.classList.add('intro-iris');
    return iris;
}

function gaze(iris, dx, dy, blue) {
    iris.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const color = blue ? IRIS_BLUE : '';
    const use = iris.querySelector(':scope > use');
    const stroke = iris.querySelector(':scope > path');
    if (use) use.style.fill = color;
    if (stroke) stroke.style.stroke = color;
}

async function play() {
    const [closed, open] = await Promise.all([loadSvg('logo-fechado.svg'), loadSvg('logo-normal.svg')]);
    closed.classList.add('closed');
    open.classList.add('open');
    const iris = irisOf(open);
    if (!iris) return;

    const eye = el('div', { className: 'intro-eye' }, closed, open);
    const skip = el('button', { type: 'button', className: 'intro-skip', textContent: 'Pular' });
    const overlay = el('div', { className: 'intro', role: 'presentation' }, eye, el('div', { className: 'intro-name', textContent: 'BlinkFrame' }), skip);
    document.body.append(overlay);

    let pointer = null;
    let following = false;
    let finished = false;
    const eyeCenter = () => { const r = open.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const lookAt = (x, y) => {
        const [cx, cy] = eyeCenter();
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const strength = Math.min(1, dist / 260);
        gaze(iris, (dx / dist) * LIMIT.x * strength, (dy / dist) * LIMIT.y * strength, true);
    };
    addEventListener('pointermove', (event) => {
        pointer = [event.clientX, event.clientY];
        if (following) lookAt(...pointer);
    });

    const end = async () => {
        if (finished) return;
        finished = true;
        overlay.classList.add('out');
        await wait(560);
        overlay.remove();
    };
    skip.addEventListener('click', (event) => { event.stopPropagation(); end(); });
    overlay.addEventListener('click', end);
    addEventListener('keydown', (event) => { if (event.key === 'Escape') end(); });

    const step = async (ms, fn) => { if (finished) return; fn?.(); await wait(ms); };
    requestAnimationFrame(() => overlay.classList.add('on'));
    await step(700);                                            // 1) olho fechado
    await step(800, () => eye.classList.add('opened'));         // 2) abre normal, olhando para nós
    await step(900, () => {                                     // 3) procura a seta do mouse
        following = true;
        if (pointer) lookAt(...pointer); else lookAt(innerWidth * 0.85, innerHeight * 0.85);
    });
    await step(1000, () => { if (!pointer) lookAt(innerWidth * 0.5, innerHeight * 0.9); });
    following = false;
    await step(900, () => { gaze(iris, 0, 0, false); overlay.classList.add('named'); }); // 4) volta ao normal, olhando para nós
    await wait(700);
    await end();
}

async function init() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let id;
    try { id = (await (await fetch('/api/boot', { cache: 'no-store' })).json()).id; } catch { return; }
    if (!id || read() === id) return;
    write(id);
    await play();
}
init().catch(() => { /* a intro é opcional: nunca deve impedir o uso do app */ });

/**
 * Transporte do preview: play/pause, quadro a quadro, scrubber (`t`) e atalhos de teclado.
 * Quem dirige o relógio é o editor: a cada quadro chama `output.renderFrame(t)` (modo "driven" do runner).
 */
import { $, fmtTime } from './dom.js';
import { state, on } from './state.js';

const PREVIEW_FPS = 30;

export function initTransport(output) {
    let last = performance.now();

    function draw() {
        try { output.renderFrame(state.t); } catch { /* runner ainda carregando */ }
        $('time').textContent = fmtTime(state.t);
        $('frame').textContent = `quadro ${Math.round(state.t * PREVIEW_FPS)}`;
        $('scrubber').value = String(state.t);
    }

    function setPlaying(on) {
        state.playing = on;
        last = performance.now();
        $('play').textContent = on ? '❚❚' : '▶';
    }

    function tick(now) {
        if (state.playing && state.ready) {
            state.t += (now - last) / 1000;
            if (state.t >= state.duration) state.t %= state.duration; // loop
            draw();
        }
        last = now;
        requestAnimationFrame(tick);
    }

    const step = (frames) => {
        setPlaying(false);
        state.t = Math.min(state.duration, Math.max(0, state.t + frames / PREVIEW_FPS));
        draw();
    };

    $('play').addEventListener('click', () => setPlaying(!state.playing));
    $('prev').addEventListener('click', () => step(-1));
    $('next').addEventListener('click', () => step(1));
    $('scrubber').addEventListener('input', (event) => { setPlaying(false); state.t = Number(event.target.value); draw(); });
    document.addEventListener('keydown', (event) => {
        if (event.target.closest('input[type="text"], input[type="range"], select, textarea, [role="listbox"], summary')) return;
        if (event.code === 'Space') { event.preventDefault(); setPlaying(!state.playing); }
        else if (event.code === 'ArrowLeft') { event.preventDefault(); step(event.shiftKey ? -10 : -1); }
        else if (event.code === 'ArrowRight') { event.preventDefault(); step(event.shiftKey ? 10 : 1); }
        else if (event.code === 'Home') { event.preventDefault(); setPlaying(false); state.t = 0; draw(); }
    });

    // Reconfigurou (texto, velocidade, formato): a duração pode ter mudado
    on('configured', () => {
        state.t = Math.min(state.t, state.duration);
        $('scrubber').max = String(state.duration);
        $('duration').textContent = fmtTime(state.duration);
        draw();
    });

    requestAnimationFrame(tick);
    return { draw, setPlaying };
}

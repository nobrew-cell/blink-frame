/**
 * BlinkFrame — modes.js
 * ---------------------------------------------------------------------------
 * Modos de exibição do runner. O motor (kit.js) só sabe renderizar o instante `t`; QUEM decide quando e como
 * avançar o tempo é o modo:
 *
 *   driven  editor/exportador chamam window.renderFrame(t)           (padrão; nada a iniciar aqui)
 *   loop    reprodução contínua em tempo real                         (previews da vitrine)
 *   live    saída limpa para OBS/navegador, comandada por "cues"     (gancho para o futuro modo ao vivo)
 *
 * Um novo modo (ex.: "scrub" para uma timeline externa) é só mais uma função neste arquivo, registrada em kit.js.
 *
 * `api` recebido pelos modos:
 *   renderFrame(t)  desenha o instante t (segundos de SAÍDA)         getInfo()  window.__template (duração, holdAt…)
 *   configure(args) aplica campos/formato                           stage      elemento #stage
 */

import { MSG, liveChannelName } from './protocol.js';

/** Modo loop: devolve `play(on)`. `play(false)` para e mostra o quadro de capa (thumbAt). */
export function createLoop({ renderFrame, getInfo }) {
    let raf = 0;
    return (on) => {
        cancelAnimationFrame(raf);
        if (!on) {
            const info = getInfo();
            if (info) renderFrame(info.thumbAt);
            return;
        }
        const start = performance.now();
        const loop = (now) => {
            renderFrame(((now - start) / 1000) % getInfo().duration);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
    };
}

/**
 * Modo ao vivo (base): a página fica transparente e invisível até receber um cue.
 *   cue "in"     toca a entrada (0 → holdAt) e congela no ponto de exibição
 *   cue "out"    toca a saída (holdAt → duração) e volta a ficar invisível
 *   cue "toggle" alterna entre os dois
 * Campos novos (texto, cores…) chegam por MSG.FIELDS e são aplicados sem reiniciar a animação.
 *
 * Uso futuro: no OBS, adicione uma "Fonte de navegador" com
 *   http://127.0.0.1:3000/runner.html?template=<slug>&mode=live&channel=<id>
 * e controle-a de um painel que publique mensagens no BroadcastChannel `blinkframe:live:<id>`.
 * Observação: BroadcastChannel só conecta abas do MESMO navegador. Para o navegador embutido do OBS, o painel
 * deve ser servido pelo servidor local e a ponte trocará para WebSocket/SSE (ponto de extensão: troque `channel`).
 */
export function startLive({ renderFrame, getInfo, configure, stage, channelId }) {
    const channel = new BroadcastChannel(liveChannelName(channelId));
    let raf = 0;
    let t = 0;
    let phase = 'hidden'; // hidden | entering | holding | leaving

    const setVisible = (visible) => { stage.style.visibility = visible ? 'visible' : 'hidden'; };
    const stop = () => cancelAnimationFrame(raf);

    /** Reproduz em tempo real de `from` até `to` segundos e chama `done`. */
    const play = (from, to, done) => {
        stop();
        const start = performance.now();
        const step = (now) => {
            t = Math.min(to, from + (now - start) / 1000);
            renderFrame(t);
            if (t >= to) done();
            else raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    };

    const enter = () => {
        setVisible(true);
        phase = 'entering';
        play(0, getInfo().holdAt, () => { phase = 'holding'; });
    };
    const leave = () => {
        if (phase === 'hidden' || phase === 'leaving') return;
        phase = 'leaving';
        play(Math.max(t, getInfo().holdAt), getInfo().duration, () => { phase = 'hidden'; setVisible(false); });
    };

    const handlers = {
        in: () => { if (phase === 'hidden' || phase === 'leaving') enter(); },
        out: leave,
        toggle: () => (phase === 'hidden' || phase === 'leaving' ? enter() : leave()),
    };

    document.body.dataset.bg = 'none';
    setVisible(false);
    channel.onmessage = async ({ data }) => {
        if (data?.type === MSG.FIELDS) {
            await configure({ fields: data.fields, size: data.size });
            if (phase !== 'hidden') renderFrame(t);
        } else if (data?.type === MSG.CUE) {
            handlers[data.action]?.();
        }
    };
    channel.postMessage({ type: MSG.LIVE_READY });
    return { cue: (action) => handlers[action]?.(), channel };
}

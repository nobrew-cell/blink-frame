/**
 * Saídas: quem DESENHA o estado do editor. Hoje existe o preview em iframe (RunnerOutput); o modo ao vivo
 * (OBS) entra como mais uma saída com a mesma interface, sem mexer no painel nem no estado.
 *
 *   pushFields(values, size)   envia os valores atuais
 *   renderFrame(t)             (só saídas com relógio dirigido) desenha o instante t
 *   cue(action)                (só saídas ao vivo) 'in' | 'out' | 'toggle'
 *
 * Protocolo e nomes de mensagens: engine/protocol.js.
 */
import { MSG, liveChannelName } from '/engine/protocol.js';

/** Preview: iframe de mesma origem com o runner no modo "driven" (o editor dirige o relógio). */
export function createRunnerOutput(frame) {
    const win = () => frame.contentWindow;
    return {
        pushFields(values, size) { win().postMessage({ type: MSG.FIELDS, fields: values, size }, location.origin); },
        renderFrame(t) { win().renderFrame(t); },
        info() { return win().__template; },
        setBackground(bg) { win().document.body.dataset.bg = bg; },
        /** Escuta READY / CONFIGURED / ERROR vindos do iframe. */
        listen(handler) {
            window.addEventListener('message', (event) => {
                if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
                handler(event.data);
            });
        },
    };
}

/**
 * Saída ao vivo (gancho — ainda sem tela própria): publica campos e cues para uma página
 * runner.html?template=<slug>&mode=live&channel=<id> aberta em outra aba/janela do mesmo navegador.
 */
export function createLiveOutput(channelId = 'default') {
    const channel = new BroadcastChannel(liveChannelName(channelId));
    return {
        pushFields(values, size) { channel.postMessage({ type: MSG.FIELDS, fields: values, size }); },
        cue(action) { channel.postMessage({ type: MSG.CUE, action }); },
        close() { channel.close(); },
    };
}

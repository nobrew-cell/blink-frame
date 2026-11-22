/**
 * BlinkFrame — protocol.js
 * ---------------------------------------------------------------------------
 * Mensagens trocadas entre quem CONTROLA um template (o editor, o exportador, no futuro um painel ao vivo)
 * e o runner que o RENDERIZA (runner.html). Centralizar os nomes aqui evita strings soltas.
 *
 * Transportes:
 *   - postMessage (mesma origem): editor ↔ iframe do runner.
 *   - BroadcastChannel (mesma origem, mesmo navegador): painel de controle ↔ saída limpa (OBS "Fonte de navegador").
 *
 * Separação de responsabilidades (base do modo ao vivo):
 *   ESTADO   = valores dos campos + formato  (editor/painel; veja js/editor/state.js)
 *   SAÍDA    = quem desenha o estado          (runner.html em um dos modos de exibição; veja modes.js)
 *   O estado só viaja como mensagens abaixo; a saída nunca lê a interface do editor.
 */

export const MSG = {
    /** controle → runner: { type, fields, size }  — aplica novos valores (reconfigura o template). */
    FIELDS: 'bf:fields',
    /** runner → controle: o template terminou de carregar pela primeira vez. */
    READY: 'bf:ready',
    /** runner → controle: uma reconfiguração terminou (duração/tamanho podem ter mudado). */
    CONFIGURED: 'bf:configured',
    /** runner → controle: erro ao carregar o template. */
    ERROR: 'bf:error',
    /** controle → saída ao vivo: { type, action: 'in' | 'out' | 'toggle' } — dispara a entrada/saída da animação. */
    CUE: 'bf:cue',
    /** saída ao vivo → controle: a saída está pronta para receber cues. */
    LIVE_READY: 'bf:live-ready',
};

/** Modos de exibição do runner (?mode=...). */
export const MODES = {
    /** Padrão. Quem chama dirige o relógio com window.renderFrame(t) (editor e exportador). */
    DRIVEN: 'driven',
    /** Repete a animação em tempo real (previews da vitrine). Também ativado por ?play=1. */
    LOOP: 'loop',
    /** Saída limpa e transparente para OBS/navegador, controlada por cues via BroadcastChannel. */
    LIVE: 'live',
};

/** Nome do canal ao vivo. Um painel e uma saída usam o mesmo `id` (padrão "default"). */
export const liveChannelName = (id = 'default') => `blinkframe:live:${id}`;

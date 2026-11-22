/**
 * Estado do editor + eventos. É a ÚNICA fonte de verdade da interface:
 * o painel escreve aqui, a saída (preview, futuramente OBS) lê daqui.
 *
 *   values   valores dos campos do template (já completos: defaults + rascunho)
 *   size     formato escolhido (landscape | vertical | square)
 *   sounds   incluir os efeitos sonoros na exportação
 *
 * Eventos (on/emit):
 *   'ready'      o template carregou: schema, tamanhos e valores iniciais estão definidos
 *   'change'     { keys, size?, rebuild? } valores/formato mudaram. `rebuild: true` → o painel redesenha os controles
 *   'configured' o runner reconfigurou: duração e quantidade de sons podem ter mudado
 */

export const state = {
    slug: '',
    meta: null,
    schema: [],          // campos normalizados (engine/schema.js)
    sizes: [],
    size: 'landscape',
    values: {},
    defaults: {},
    duration: 1,
    holdAt: 1,
    t: 0,
    playing: true,
    bg: 'checker',
    soundsAvailable: 0,
    sounds: false,
    ready: false,
};

const handlers = new Map();

export function on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event).delete(fn);
}

export function emit(event, payload) {
    for (const fn of handlers.get(event) ?? []) fn(payload);
}

/** Altera um campo (digitação, slider…). Não redesenha o painel. */
export function setValue(key, value) {
    state.values = { ...state.values, [key]: value };
    emit('change', { keys: [key] });
}

/** Altera vários campos de uma vez (preset, restaurar). `rebuild` redesenha os controles. */
export function setValues(patch, { rebuild = true } = {}) {
    state.values = { ...state.values, ...patch };
    emit('change', { keys: Object.keys(patch), rebuild });
}

export function setSize(size) {
    if (state.size === size) return;
    state.size = size;
    emit('change', { keys: [], size: true });
}

/**
 * Dados do usuário que valem para o app todo (vitrine, Meu espaço, editor), guardados em localStorage:
 *   favoritos   lista de slugs de templates
 *   preferências { startPage: 'vitrine' | 'espaco', livePreviews: boolean, channel: string }
 * Tudo tolerante a falhas (modo privado, cota cheia).
 */
const FAV_KEY = 'blinkframe:favorites:v1';
const PREF_KEY = 'blinkframe:prefs:v1';

const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

const listeners = new Set();
export const onStoreChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => fn());
window.addEventListener('storage', (event) => { if (event.key === FAV_KEY || event.key === PREF_KEY) notify(); });

/* ---------- favoritos ---------- */
export const getFavorites = () => { const list = read(FAV_KEY, []); return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)) : []; };
export const isFavorite = (slug) => getFavorites().includes(slug);
export function toggleFavorite(slug) {
    const list = getFavorites();
    const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
    write(FAV_KEY, next);
    notify();
    return next.includes(slug);
}
export function setFavorites(list) { write(FAV_KEY, [...new Set(list)].slice(0, 500)); notify(); }

/* ---------- preferências ---------- */
export const PREF_DEFAULTS = { startPage: 'vitrine', livePreviews: true, channel: '' };
export function getPrefs() {
    const raw = read(PREF_KEY, {});
    const prefs = { ...PREF_DEFAULTS };
    if (raw?.startPage === 'espaco' || raw?.startPage === 'vitrine') prefs.startPage = raw.startPage;
    if (typeof raw?.livePreviews === 'boolean') prefs.livePreviews = raw.livePreviews;
    if (typeof raw?.channel === 'string') prefs.channel = raw.channel.replace(/[\u0000-\u001f]/g, '').slice(0, 40);
    return prefs;
}
export function setPref(key, value) {
    if (!(key in PREF_DEFAULTS)) return;
    write(PREF_KEY, { ...getPrefs(), [key]: value });
    notify();
}

/* ---------- ícones usados nas telas ---------- */
export const heartSvg = (filled) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.8a4.3 4.3 0 017.5 2.5c0 5.6-7.5 10.2-7.5 10.2z"/></svg>`;

/** Botão de coração (favoritar) pronto para qualquer tela. */
export function favoriteButton(slug, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fav-btn';
    const paint = () => {
        const on = isFavorite(slug);
        button.innerHTML = heartSvg(on);
        button.setAttribute('aria-pressed', String(on));
        button.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
        button.setAttribute('aria-label', `${on ? 'Remover dos favoritos' : 'Favoritar'}: ${name}`);
    };
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggleFavorite(slug); });
    onStoreChange(paint);
    paint();
    return button;
}

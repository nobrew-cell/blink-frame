/** Utilitários de DOM e formatação do editor. */

export const $ = (id) => document.getElementById(id);

/** Cria um elemento: el('div', { className: 'x', textContent: 'y' }, ...filhos). */
export const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
    return node;
};

/** Cria um elemento SVG a partir de markup interno confiável (ícones do próprio editor). */
export const svgIcon = (markup, size = 18) => {
    const span = el('span', { className: 'ico' });
    span.innerHTML = `<svg viewBox="0 0 24 16" width="${size}" height="${Math.round(size * 16 / 24)}" fill="currentColor" aria-hidden="true">${markup}</svg>`;
    return span;
};

export const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
export const fmtSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
export const debounce = (fn, ms) => { let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); }; };

/** localStorage tolerante a falhas (modo privado, cota cheia, bloqueado). */
export const storage = {
    read(key, fallback = null) {
        try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; }
    },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

/** Baixa um texto como arquivo. */
export function downloadText(filename, text, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

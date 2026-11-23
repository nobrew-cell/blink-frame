/**
 * Cartão de template (vitrine e Meu espaço), pensado para dezenas de templates:
 *   - o cartão mostra uma MINIATURA (JPEG do quadro de capa, gerada pelo servidor e guardada em cache);
 *   - o iframe do runner só existe enquanto o mouse/foco está no cartão (e se a preferência permitir): ele sobe,
 *     toca a animação e é destruído ao sair. Nunca há mais de um ou dois ao mesmo tempo;
 *   - favoritar (coração) funciona em qualquer tela.
 */
import { favoriteButton, getPrefs } from './shared/store.js';

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter(Boolean));
    return node;
};

const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) { visibility.unobserve(entry.target); entry.target.__load?.(); }
}, { rootMargin: '400px 0px' });

export function buildCard(tpl) {
    const href = `/editor.html?template=${encodeURIComponent(tpl.slug)}`;
    const badge = el('span', { className: 'badge', hidden: true });
    const hint = el('span', { className: 'hint', textContent: '▶ ao vivo' });
    const img = el('img', { alt: '', draggable: false, decoding: 'async' });
    const preview = el('a', { className: 'preview loading', href, ariaLabel: `Abrir ${tpl.name} no editor` }, img, badge, hint);

    const card = el('article', { className: 'card' }, preview,
        favoriteButton(tpl.slug, tpl.name),
        el('div', { className: 'card-body' },
            el('h3', { textContent: tpl.name }),
            el('p', { textContent: tpl.description }),
            el('div', { className: 'tags' }, ...tpl.tags.slice(0, 5).map((tag) => el('span', { textContent: tag }))),
            el('a', { className: 'btn', href, textContent: 'Abrir no editor →' })));

    /* ---- miniatura ---- */
    preview.__load = async () => {
        try {
            const info = await (await fetch(`/api/thumb/${encodeURIComponent(tpl.slug)}`)).json();
            if (!info.url) throw new Error(info.error || 'sem miniatura');
            img.addEventListener('load', () => preview.classList.remove('loading'), { once: true });
            img.src = info.url;
            badge.textContent = `${Number(info.duration).toFixed(1).replace('.', ',')} s`;
            badge.hidden = false;
        } catch { preview.classList.remove('loading'); preview.classList.add('failed'); }
    };
    visibility.observe(preview);

    /* ---- animação ao passar o mouse ---- */
    let iframe = null;
    let enterTimer = null;
    let leaveTimer = null;
    const fit = () => { if (iframe) iframe.style.transform = `scale(${preview.clientWidth / 1920})`; };
    new ResizeObserver(fit).observe(preview);

    function mount() {
        if (iframe || !getPrefs().livePreviews) return;
        iframe = el('iframe', { src: `/runner.html?template=${encodeURIComponent(tpl.slug)}&bg=scene&size=landscape`, tabIndex: -1, title: `Prévia de ${tpl.name}` });
        iframe.setAttribute('aria-hidden', 'true');
        const mine = iframe;
        preview.insertBefore(mine, badge);
        fit();
        mine.addEventListener('load', async () => {
            try {
                const win = mine.contentWindow;
                await win.__ready;
                if (iframe !== mine) return;
                win.__play(true);
                preview.classList.add('playing');
            } catch { /* se falhar, a miniatura continua ali */ }
        }, { once: true });
    }
    function unmount() {
        if (!iframe) return;
        try { iframe.contentWindow.__play(false); } catch { /* ignore */ }
        iframe.remove();
        iframe = null;
        preview.classList.remove('playing');
    }
    const enter = () => { clearTimeout(leaveTimer); clearTimeout(enterTimer); enterTimer = setTimeout(mount, 140); };
    const leave = () => { clearTimeout(enterTimer); clearTimeout(leaveTimer); leaveTimer = setTimeout(unmount, 250); };
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    card.addEventListener('focusin', enter);
    card.addEventListener('focusout', leave);
    return card;
}

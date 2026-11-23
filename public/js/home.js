/** Vitrine: lista os templates (GET /api/templates) com busca, categorias e favoritos. Cartões leves: ver cards.js. */
import { buildCard } from './cards.js';
import { getFavorites, getPrefs, onStoreChange } from './shared/store.js';

// "Meu espaço" como página inicial (preferência): só na primeira abertura da sessão, para não prender o usuário.
try {
    if (getPrefs().startPage === 'espaco' && !location.search.includes('vitrine') && !sessionStorage.getItem('bf-started')) {
        sessionStorage.setItem('bf-started', '1');
        location.replace('/perfil.html');
    }
    sessionStorage.setItem('bf-started', '1');
} catch { /* sessionStorage bloqueado */ }

const grid = document.getElementById('grid');
const count = document.getElementById('count');
const search = document.getElementById('search');
const filters = document.getElementById('filters');

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter(Boolean));
    return node;
};

const CATEGORIES = { 'lower-third': 'Lowers', creditos: 'Créditos' };
const norm = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

async function loadStatus() {
    const box = document.getElementById('status');
    try {
        const health = await (await fetch('/api/health')).json();
        const text = box.querySelector('span');
        if (health.ffmpeg.ok) { box.dataset.state = 'ok'; text.textContent = 'FFmpeg pronto'; }
        else { box.dataset.state = 'bad'; text.textContent = 'FFmpeg não encontrado'; box.title = health.ffmpeg.problems.join('\n'); }
    } catch {
        box.dataset.state = 'bad';
        box.querySelector('span').textContent = 'Servidor indisponível';
    }
}

async function main() {
    loadStatus();
    const templates = await (await fetch('/api/templates')).json();
    const cards = new Map(templates.map((tpl) => [tpl.slug, buildCard(tpl)]));
    let filter = 'all';

    const categories = [...new Set(templates.map((t) => t.category))];
    const options = [['all', 'Todos'], ['fav', '♥ Favoritos'], ...categories.map((c) => [c, CATEGORIES[c] ?? c])];
    const buttons = options.map(([id, label]) => {
        const button = el('button', { type: 'button', textContent: label });
        button.dataset.filter = id;
        button.addEventListener('click', () => { filter = id; apply(); });
        return button;
    });
    filters.replaceChildren(...buttons);

    function apply() {
        const favorites = new Set(getFavorites());
        const query = norm(search.value.trim());
        const shown = templates.filter((tpl) => {
            if (filter === 'fav' && !favorites.has(tpl.slug)) return false;
            if (filter !== 'all' && filter !== 'fav' && tpl.category !== filter) return false;
            return !query || norm(`${tpl.name} ${tpl.description} ${tpl.tags.join(' ')}`).includes(query);
        });
        // Favoritos primeiro (a ordem do app é mantida dentro de cada grupo)
        shown.sort((a, b) => Number(favorites.has(b.slug)) - Number(favorites.has(a.slug)));
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
        count.textContent = `${shown.length} de ${templates.length} modelos${getPrefs().livePreviews ? ' · passe o mouse para ver ao vivo' : ''}`;
        const empty = filter === 'fav' && !favorites.size
            ? el('div', { className: 'card add' }, el('h3', { textContent: 'Nenhum favorito ainda' }), el('p', { textContent: 'Toque no coração de um modelo para guardá-lo aqui e em Meu espaço.' }))
            : shown.length ? null : el('div', { className: 'card add' }, el('h3', { textContent: 'Nada encontrado' }), el('p', { textContent: 'Tente outra palavra ou limpe o filtro.' }));
        const next = [...shown.map((tpl) => cards.get(tpl.slug)), ...(empty ? [empty] : [])];
        // Só mexe no DOM se a lista mudou (mover um cartão recarrega o iframe da prévia)
        const same = next.length === grid.children.length && next.every((node, i) => node === grid.children[i]);
        if (!same) grid.replaceChildren(...next);
    }

    search.addEventListener('input', apply);
    // Favoritar não reordena na hora (os cartões não pulam); a ordem nova vale na próxima busca/filtro.
    onStoreChange(() => { if (filter === 'fav') apply(); });
    apply();
}

main().catch((error) => { grid.textContent = `Não foi possível carregar os modelos: ${error.message}`; });

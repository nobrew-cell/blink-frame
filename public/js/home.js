/** Vitrine: lista os templates (GET /api/templates) e mostra previews ao vivo (iframes do runner). */

const grid = document.getElementById('grid');
const count = document.getElementById('count');

const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
};

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

function buildCard(tpl) {
    const href = `/editor.html?template=${encodeURIComponent(tpl.slug)}`;
    const iframe = el('iframe', { src: `/runner.html?template=${encodeURIComponent(tpl.slug)}&bg=scene`, loading: 'lazy', tabIndex: -1, title: `Prévia de ${tpl.name}` });
    iframe.setAttribute('aria-hidden', 'true');
    const badge = el('span', { className: 'badge', textContent: '…' });
    const preview = el('a', { className: 'preview', href, ariaLabel: `Abrir ${tpl.name} no editor` }, iframe, badge, el('span', { className: 'hint', textContent: '▶ ao vivo' }));

    const card = el('article', { className: 'card' }, preview,
        el('div', { className: 'card-body' },
            el('h3', { textContent: tpl.name }),
            el('p', { textContent: tpl.description }),
            el('div', { className: 'tags' }, ...tpl.tags.map((tag) => el('span', { textContent: tag }))),
            el('a', { className: 'btn', href, textContent: 'Abrir no editor →' })));

    // Escala o iframe 1920x1080 para a largura do cartão
    const fitFrame = () => { iframe.style.transform = `scale(${preview.clientWidth / 1920})`; };
    new ResizeObserver(fitFrame).observe(preview);
    fitFrame();

    let win = null;
    iframe.addEventListener('load', async () => {
        try {
            win = iframe.contentWindow;
            await win.__ready;
            win.__play(false); // quadro de capa (thumbAt)
            badge.textContent = `${win.__template.duration.toFixed(1).replace('.', ',')} s`;
            preview.classList.add('ready');
        } catch { badge.textContent = 'erro'; }
    });
    const play = (on) => () => { try { win?.__play(on); } catch { /* iframe ainda carregando */ } };
    card.addEventListener('pointerenter', play(true));
    card.addEventListener('pointerleave', play(false));
    card.addEventListener('focusin', play(true));
    card.addEventListener('focusout', play(false));
    return card;
}

async function main() {
    loadStatus();
    const templates = await (await fetch('/api/templates')).json();
    count.textContent = `${templates.length} ${templates.length === 1 ? 'modelo' : 'modelos'} · passe o mouse para ver ao vivo`;
    grid.replaceChildren(...templates.map(buildCard),
        el('div', { className: 'card add' },
            el('h3', { textContent: 'Mais modelos?' }),
            el('p', {}, 'Crie uma pasta em ', el('code', { textContent: 'templates/meu-modelo' }), ' com ', el('code', { textContent: 'meta.json' }), ' e ', el('code', { textContent: 'template.js' }), '. Ela aparece aqui sozinha.')));
}

main().catch((error) => { grid.textContent = `Não foi possível carregar os modelos: ${error.message}`; });

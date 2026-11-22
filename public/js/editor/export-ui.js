/**
 * Exportação: envia o estado atual para POST /api/render e acompanha o progresso por SSE.
 * Formatos: .mov com alfa (ProRes 4444 ou PNG) e .mp4 com fundo verde #00FF00 (chroma key).
 */
import { $, el, fmtSize } from './dom.js';
import { state } from './state.js';

let events = null;
let currentJob = null;

function setJob({ message, progress = 0, sub = '', busy = true }) {
    $('job').hidden = false;
    $('job-msg').textContent = message;
    $('meter-fill').style.width = `${Math.round(progress * 100)}%`;
    $('meter').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    $('job-sub').textContent = sub;
    $('job-cancel').hidden = !busy;
    $('export').disabled = busy;
}

function showError(text) {
    $('job-error').hidden = false;
    $('job-error').textContent = text;
}

async function start() {
    const formats = [$('fmt-mov').checked && 'mov', $('fmt-mp4').checked && 'mp4'].filter(Boolean);
    if (!formats.length) { setJob({ message: 'Escolha ao menos um formato.', busy: false }); return; }
    $('downloads').replaceChildren();
    $('job-error').hidden = true;
    setJob({ message: 'Enviando…' });
    try {
        const response = await fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template: state.slug, size: state.size, fields: state.values, fps: Number($('fps').value), formats,
                movCodec: $('mov-codec').value, sounds: state.sounds,
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao iniciar a exportação.');
        currentJob = data.id;
        follow(data.id);
    } catch (error) {
        setJob({ message: 'Não foi possível exportar', busy: false });
        showError(error.message);
    }
}

function follow(id) {
    events?.close();
    const source = new EventSource(`/api/render/${id}/events`);
    events = source;
    source.onmessage = (message) => {
        const job = JSON.parse(message.data);
        if (job.status === 'queued') {
            setJob({ message: 'Na fila…', sub: job.queuePosition ? `${job.queuePosition} na frente` : '' });
        } else if (job.status === 'rendering' || job.status === 'encoding') {
            const sub = job.total ? `quadro ${job.frame}/${job.total}${job.eta ? ` · ~${Math.ceil(job.eta)}s restantes` : ''}` : '';
            setJob({ message: job.message, progress: job.progress, sub });
        } else if (job.status === 'done') {
            source.close();
            setJob({ message: 'Pronto! Baixe seus arquivos:', progress: 1, busy: false });
            $('downloads').replaceChildren(...Object.entries(job.files).map(([kind, file]) =>
                el('a', { href: `/api/download/${job.id}/${kind}`, download: file.name },
                    el('span', {}, el('b', { textContent: `.${kind}` }), kind === 'mov' ? ' com alfa' : ' fundo verde'),
                    el('small', { textContent: fmtSize(file.size) }))));
        } else if (job.status === 'error') {
            source.close();
            setJob({ message: 'A exportação falhou', busy: false });
            showError(job.error);
        } else if (job.status === 'cancelled') {
            source.close();
            setJob({ message: 'Exportação cancelada', busy: false });
        }
    };
    source.onerror = () => { /* o EventSource reconecta sozinho; o estado final chega no 1º evento */ };
}

export function initExport() {
    $('export').addEventListener('click', start);
    $('job-cancel').addEventListener('click', () => { if (currentJob) fetch(`/api/render/${currentJob}/cancel`, { method: 'POST' }); });
}

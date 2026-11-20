/**
 * Jobs de renderização: estado em memória, fila (um por vez) e difusão de progresso via SSE.
 */
import { randomUUID } from 'node:crypto';

const jobs = new Map();
let chain = Promise.resolve();
let waiting = 0;

export function createJob(data) {
    const job = {
        id: randomUUID(),
        status: 'queued', // queued | rendering | encoding | done | error | cancelled
        progress: 0,
        frame: 0,
        total: 0,
        message: 'Na fila',
        files: {},
        error: null,
        cancelled: false,
        startedAt: null,
        createdAt: Date.now(),
        listeners: new Set(),
        abort: null, // função definida pelo renderizador para interromper o trabalho
        ...data,
    };
    jobs.set(job.id, job);
    return job;
}

export const getJob = (id) => jobs.get(id);

/** Versão serializável do job. */
export function snapshot(job) {
    const elapsed = job.startedAt ? (Date.now() - job.startedAt) / 1000 : 0;
    const eta = job.status === 'rendering' && job.progress > 0.02 ? Math.max(0, elapsed / job.progress - elapsed) : null;
    return {
        id: job.id, status: job.status, progress: job.progress, frame: job.frame, total: job.total,
        message: job.message, error: job.error, queuePosition: job.status === 'queued' ? waiting : 0,
        eta, files: Object.fromEntries(Object.entries(job.files).map(([kind, f]) => [kind, { name: f.name, size: f.size }])),
    };
}

export function update(job, patch) {
    Object.assign(job, patch);
    const payload = `data: ${JSON.stringify(snapshot(job))}\n\n`;
    for (const res of job.listeners) res.write(payload);
}

/** Registra um cliente SSE. */
export function subscribe(job, req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot(job))}\n\n`);
    job.listeners.add(res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(heartbeat); job.listeners.delete(res); });
}

/** Enfileira a execução: um job por vez (Chromium + FFmpeg já usam bastante CPU). */
export function enqueue(job, run) {
    waiting += 1;
    chain = chain.then(async () => {
        waiting -= 1;
        if (job.cancelled) return;
        job.startedAt = Date.now();
        try {
            await run(job);
        } catch (error) {
            if (job.cancelled) update(job, { status: 'cancelled', message: 'Cancelado' });
            else update(job, { status: 'error', error: error.message, message: 'Falhou' });
        }
    });
}

export function cancel(job) {
    if (['done', 'error', 'cancelled'].includes(job.status)) return;
    job.cancelled = true;
    job.abort?.();
    if (job.status === 'queued') update(job, { status: 'cancelled', message: 'Cancelado' });
}

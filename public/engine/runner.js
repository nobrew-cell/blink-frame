/**
 * BlinkFrame — runner.js
 * Lê ?template=<slug>, importa /templates/<slug>/template.js e registra via defineTemplate().
 *
 * Expõe:
 *   window.__ready  Promise → resolve quando o template está configurado (rejeita se houver erro)
 *   window.__error  mensagem de erro (se houver)
 */

import { defineTemplate } from './kit.js';

const params = new URLSearchParams(location.search);
document.body.dataset.bg = params.get('bg') || 'none';

window.__ready = (async () => {
    const slug = params.get('template') || '';
    // O slug vira parte de uma URL de import: aceitar somente [a-z0-9-]
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Template inválido: "${slug}"`);
    const module = await import(`/templates/${slug}/template.js`);
    return defineTemplate(module.default);
})().catch((error) => {
    window.__error = String(error?.message ?? error);
    console.error(error);
    document.body.dataset.bg = 'dark';
    document.getElementById('stage').textContent = `Erro ao carregar o template: ${window.__error}`;
    if (window.parent !== window) window.parent.postMessage({ type: 'dp:error', message: window.__error }, location.origin);
    throw error;
});

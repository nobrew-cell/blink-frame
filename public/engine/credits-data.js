/**
 * Dados dos créditos como LISTA de grupos (o que o editor visual edita):
 *   [{ title, sub, rows: [{ role, name }], note }]
 *
 * Sem importações (usado por schema.js e pelos templates). O texto com `#`, `|` e `~` continua existindo só como
 * formato interno do motor (parseCredits) e dos modelos prontos: `groupsToText` e `textToGroups` convertem.
 */

export const MAX_GROUPS = 40;
export const MAX_ROWS = 80;

const clean = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Valida/normaliza a lista (aceita também o texto antigo). Remove grupos totalmente vazios. */
export function cleanGroups(raw) {
    if (typeof raw === 'string') raw = textToGroups(raw);
    if (!Array.isArray(raw)) return null;
    const groups = [];
    for (const g of raw.slice(0, MAX_GROUPS)) {
        if (!g || typeof g !== 'object') continue;
        const rows = (Array.isArray(g.rows) ? g.rows : []).slice(0, MAX_ROWS)
            .map((r) => ({ role: clean(r?.role, 60), name: clean(r?.name, 80) }))
            .filter((r) => r.role || r.name);
        const group = { title: clean(g.title, 60), sub: clean(g.sub, 80), rows, note: clean(g.note, 160) };
        if (group.title || group.sub || group.note || rows.length) groups.push(group);
    }
    return groups;
}

/** Grupos → texto do motor. Funções repetidas em linhas seguidas viram "| nome" (mesma função). */
export function groupsToText(groups) {
    return (cleanGroups(groups) ?? []).map((g) => {
        const lines = [];
        if (g.title || g.sub) lines.push(`# ${g.title}${g.sub ? ` | ${g.sub}` : ''}`);
        let previous = null;
        for (const r of g.rows) {
            if (r.role && r.name) lines.push(r.role === previous ? `| ${r.name}` : `${r.role} | ${r.name}`);
            else if (r.name) lines.push(r.name);
            else lines.push(`${r.role} |`);
            previous = r.role || null;
        }
        if (g.note) lines.push(`~ ${g.note}`);
        return lines.join('\n');
    }).join('\n\n');
}

/** Texto do motor → grupos (para os modelos prontos e para projetos salvos no formato antigo). */
export function textToGroups(text) {
    const groups = [];
    let group = null;
    const open = () => { group = { title: '', sub: '', rows: [], note: '' }; groups.push(group); return group; };
    let previousRole = '';
    for (const rawLine of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
        const line = rawLine.trim();
        if (!line || /^-{3,}$/.test(line)) { group = null; previousRole = ''; continue; }
        if (line.startsWith('#')) {
            const [title, ...sub] = line.slice(1).split('|');
            open();
            group.title = title.trim();
            group.sub = sub.join('|').trim();
            previousRole = '';
        } else if (line.startsWith('~')) {
            (group ?? open()).note = [group?.note, line.slice(1).trim()].filter(Boolean).join(' · ');
        } else if (line.startsWith('|')) {
            (group ?? open()).rows.push({ role: previousRole, name: line.slice(1).trim() });
        } else if (line.includes('|')) {
            const [role, ...name] = line.split('|');
            (group ?? open()).rows.push({ role: role.trim(), name: name.join('|').trim() });
            previousRole = role.trim();
        } else {
            (group ?? open()).rows.push({ role: '', name: line });
            previousRole = '';
        }
    }
    return cleanGroups(groups);
}

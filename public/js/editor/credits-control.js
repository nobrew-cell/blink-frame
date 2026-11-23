/**
 * Editor visual de créditos (campo `credits`): grupos com título, linhas "função | nome" e botões de mais/menos.
 * O valor é uma lista de grupos (engine/credits-data.js); nada de sintaxe para aprender.
 */
import { el } from './dom.js';
import { state, setValue } from './state.js';
import { textToGroups, cleanGroups, MAX_GROUPS, MAX_ROWS } from '/engine/credits-data.js';

const icon = (path) => {
    const span = el('span', { className: 'ico' });
    span.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    return span;
};
const ICONS = {
    plus: '<path d="M8 3v10M3 8h10"/>', minus: '<path d="M3 8h10"/>', up: '<path d="M4 10l4-4 4 4"/>', down: '<path d="M4 6l4 4 4-4"/>',
};

function iconButton(kind, label, onClick, { danger = false, disabled = false } = {}) {
    const button = el('button', { type: 'button', className: `icon-btn${danger ? ' danger' : ''}`, title: label, disabled }, icon(ICONS[kind]));
    button.setAttribute('aria-label', label);
    button.addEventListener('click', onClick);
    return button;
}

export function creditsControl(f) {
    let groups = structuredClone(cleanGroups(state.values[f.key]) ?? []);
    const root = el('div', { className: 'field credits-editor' });
    const commit = () => setValue(f.key, structuredClone(groups));
    const rebuild = () => { draw(); commit(); };

    const input = (value, placeholder, onInput, extra = {}) => {
        const node = el('input', { type: 'text', value, placeholder, autocomplete: 'off', spellcheck: false, ...extra });
        node.addEventListener('input', () => { onInput(node.value); commit(); });
        return node;
    };

    function groupCard(group, index) {
        const rows = el('div', { className: 'credit-rows' });
        const focusRow = (rowIndex, part = 'name') => queueMicrotask(() => root.querySelectorAll('.credit-group')[index]?.querySelectorAll('.credit-row')[rowIndex]?.querySelector(`[data-part="${part}"]`)?.focus());

        group.rows.forEach((row, rowIndex) => {
            const role = input(row.role, 'Função', (v) => { row.role = v; }, { maxLength: 60 });
            const name = input(row.name, 'Nome', (v) => { row.name = v; }, { maxLength: 80 });
            role.dataset.part = 'role';
            name.dataset.part = 'name';
            name.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' || group.rows.length >= MAX_ROWS) return;
                event.preventDefault();
                group.rows.splice(rowIndex + 1, 0, { role: event.shiftKey ? row.role : '', name: '' });
                rebuild();
                focusRow(rowIndex + 1, event.shiftKey ? 'name' : 'role');
            });
            rows.append(el('div', { className: 'credit-row' }, role, name,
                iconButton('minus', 'Remover esta linha', () => { group.rows.splice(rowIndex, 1); rebuild(); }, { danger: true })));
        });

        const addRow = el('button', { type: 'button', className: 'btn-soft add-row', disabled: group.rows.length >= MAX_ROWS }, icon(ICONS.plus), 'Linha');
        addRow.addEventListener('click', () => { group.rows.push({ role: '', name: '' }); rebuild(); focusRow(group.rows.length - 1, 'role'); });
        const addSame = el('button', { type: 'button', className: 'btn-soft add-row', title: 'Outro nome na mesma função da linha de cima', disabled: !group.rows.length || group.rows.length >= MAX_ROWS }, icon(ICONS.plus), 'Mesma função');
        addSame.addEventListener('click', () => {
            const last = group.rows[group.rows.length - 1];
            group.rows.push({ role: last?.role ?? '', name: '' });
            rebuild();
            focusRow(group.rows.length - 1, 'name');
        });

        const title = input(group.title, 'Título do grupo (ex.: ELENCO)', (v) => { group.title = v; }, { maxLength: 60, className: 'group-title' });
        const sub = input(group.sub, 'Subtítulo (opcional)', (v) => { group.sub = v; }, { maxLength: 80 });
        const note = input(group.note, 'Observação pequena (opcional)', (v) => { group.note = v; }, { maxLength: 160 });

        return el('section', { className: 'credit-group' },
            el('div', { className: 'credit-group-head' },
                el('span', { className: 'group-no', textContent: String(index + 1) }), title,
                iconButton('up', 'Subir o grupo', () => { [groups[index - 1], groups[index]] = [groups[index], groups[index - 1]]; rebuild(); }, { disabled: index === 0 }),
                iconButton('down', 'Descer o grupo', () => { [groups[index + 1], groups[index]] = [groups[index], groups[index + 1]]; rebuild(); }, { disabled: index === groups.length - 1 }),
                iconButton('minus', 'Remover o grupo', () => { if (group.rows.length && !confirm('Remover este grupo e todas as linhas dele?')) return; groups.splice(index, 1); rebuild(); }, { danger: true })),
            sub, rows, el('div', { className: 'credit-actions' }, addRow, addSame), note);
    }

    function draw() {
        const children = groups.map(groupCard);
        const addGroup = el('button', { type: 'button', className: 'btn-soft add-group', disabled: groups.length >= MAX_GROUPS }, icon(ICONS.plus), 'Adicionar grupo');
        addGroup.addEventListener('click', () => {
            groups.push({ title: '', sub: '', rows: [{ role: '', name: '' }], note: '' });
            rebuild();
            queueMicrotask(() => root.querySelectorAll('.credit-group')[groups.length - 1]?.querySelector('.group-title')?.focus());
        });
        const examples = (f.examples ?? []).length
            ? el('div', { className: 'examples' }, el('span', { className: 'label', textContent: 'Carregar um modelo' }),
                el('div', { className: 'preset-list' }, ...f.examples.map((example) => {
                    const button = el('button', { type: 'button', className: 'btn-soft', textContent: example.label });
                    button.addEventListener('click', () => {
                        if (groups.length && !confirm('Substituir os créditos atuais por este modelo?')) return;
                        groups = textToGroups(example.value);
                        rebuild();
                    });
                    return button;
                })))
            : null;
        const empty = groups.length ? null : el('p', { className: 'hint', textContent: 'Nenhum grupo ainda. Adicione um grupo ou carregue um modelo.' });
        root.replaceChildren(...[
            el('div', { className: 'field-head' }, el('span', { className: 'label', textContent: f.label }), el('span', { className: 'count', textContent: `${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}` })),
            ...children, empty, addGroup,
            el('p', { className: 'hint', textContent: 'Enter na linha cria outra abaixo. Shift+Enter repete a função (vários nomes na mesma função).' }),
            examples].filter(Boolean));
    }
    draw();
    return root;
}

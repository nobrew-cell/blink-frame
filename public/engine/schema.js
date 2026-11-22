/**
 * BlinkFrame — schema.js
 * ---------------------------------------------------------------------------
 * O CONTRATO ÚNICO entre templates e editor. Um template descreve seus controles como uma lista de `fields`;
 * o editor monta o painel sozinho a partir dela (nunca existe UI específica de template).
 *
 * Campo:   { key, type, label, default, section, hint?, ...extras do tipo }
 * Tipos:   text · color · font · align · select · range · toggle · image · icon
 * Seções:  layout · content · media · appearance · transparency · audio · advanced   (veja SECTIONS)
 *
 * Sem `section`, o campo cai na seção padrão do seu tipo (DEFAULT_SECTION). Use os construtores `field.*`
 * abaixo em vez de objetos soltos: eles garantem rótulos/valores/limites consistentes entre templates.
 *
 * Este módulo não toca no DOM: roda igual no runner (iframe/headless) e no editor.
 */

import { FONTS } from './fonts.js';
import { ICON_IDS } from './icons.js';

/* ========================================================================== */
/* Seções do painel                                                            */
/* ========================================================================== */

/**
 * Ordem e comportamento das seções (estilo Photoshop: títulos dobráveis).
 *   open     → aberta na primeira visita (depois o editor lembra o que o usuário abriu/fechou)
 *   virtual  → o editor acrescenta conteúdo próprio (formato, paletas, sons) mesmo sem campos do template
 */
export const SECTIONS = [
    { id: 'layout', label: 'Formato e posição', open: true, virtual: true },
    { id: 'timing', label: 'Tempo e animação', open: true },
    { id: 'content', label: 'Conteúdo', open: true },
    { id: 'media', label: 'Ícone e mídia', open: true },
    { id: 'appearance', label: 'Aparência', open: true },
    { id: 'presets', label: 'Paletas e estilos salvos', open: false, virtual: true },
    { id: 'transparency', label: 'Transparência dos elementos', open: false },
    { id: 'audio', label: 'Áudio e efeitos', open: false, virtual: true },
    { id: 'advanced', label: 'Ajustes avançados', open: false },
];

export const FIELD_TYPES = ['text', 'color', 'font', 'align', 'select', 'range', 'toggle', 'image', 'icon'];

const DEFAULT_SECTION = {
    text: 'content', image: 'media', icon: 'media',
    color: 'appearance', font: 'appearance',
    align: 'layout', select: 'layout',
    range: 'advanced', toggle: 'advanced',
};

/* ========================================================================== */
/* Opções padronizadas                                                         */
/* ========================================================================== */

export const ALIGN_OPTIONS = [
    { value: 'left', label: 'Esquerda' },
    { value: 'center', label: 'Centro' },
    { value: 'right', label: 'Direita' },
];

export const SIDE_OPTIONS = [
    { value: 'left', label: 'Esquerda' },
    { value: 'right', label: 'Direita' },
];

/** Formatos de saída: a legenda explica onde cada proporção é usada. */
export const SIZE_META = {
    landscape: { ratio: '16:9', label: 'Horizontal', hint: 'YouTube, TV, apresentações' },
    vertical: { ratio: '9:16', label: 'Vertical', hint: 'TikTok, Shorts, Reels' },
    square: { ratio: '1:1', label: 'Quadrado', hint: 'Feed do Instagram, LinkedIn' },
};

/* ========================================================================== */
/* Construtores de campos                                                      */
/* ========================================================================== */

const make = (type, key, label, def, extra = {}) => ({ key, type, label, default: def, ...extra });

export const field = {
    /** Texto. `maxLength` padrão 60; `allowEmpty: true` permite apagar o campo (ex.: empresa opcional). */
    text: (key, label, def, extra = {}) => make('text', key, label, def, { maxLength: 60, ...extra }),
    /** Cor "#rrggbb". */
    color: (key, label, def, extra) => make('color', key, label, def, extra),
    /** Fonte: o valor é um id de fonts.js. */
    font: (key, label, def = 'inter', extra) => make('font', key, label, def, extra),
    /** Alinhamento esquerda/centro/direita (posição da lower no quadro). */
    align: (key = 'position', label = 'Posição', def = 'left', extra) => make('align', key, label, def, { options: ALIGN_OPTIONS, ...extra }),
    /** Lista de opções. `control: 'segmented'` mostra botões lado a lado (use com até 4 opções curtas). */
    select: (key, label, def, options, extra) => make('select', key, label, def, { options, ...extra }),
    /** Lado esquerdo/direito (de um ícone, logo, selo…). */
    side: (key, label, def = 'left', extra) => make('select', key, label, def, { options: SIDE_OPTIONS, control: 'segmented', section: 'media', ...extra }),
    /** Número em uma faixa. `display`: 'percent' (0..1 → %), 'multiplier' (1.25 → 1,25×) ou 'number'. */
    range: (key, label, def, { min = 0, max = 1, step = 0.05, display = 'number', ...extra } = {}) =>
        make('range', key, label, def, { min, max, step, display, ...extra }),
    toggle: (key, label, def, extra) => make('toggle', key, label, def, extra),
    /** Imagem enviada pelo usuário (logo). Vazio = sem imagem. */
    image: (key, label, extra) => make('image', key, label, '', extra),
    /** Ícone: id da biblioteca (icons.js) OU imagem enviada. `choices` = ids oferecidos no seletor. */
    icon: (key, label, def, extra = {}) => make('icon', key, label, def, { choices: ICON_IDS.slice(0, 12), ...extra }),
};

/**
 * Controles comuns, com chaves e rótulos padronizados. Passe só o que o design usa:
 *   ...controls({ accent: '#ffb703', text: '#fff', plate: '#16161a', font: 'inter', position: 'left' })
 * Os templates leem: --accent, --text, --plate, --font (variáveis CSS no palco) e `ctx.values.position|scale|speed`.
 */
export function controls({ accent, text, plate, font, position, scale = true, speed = true } = {}) {
    const list = [];
    if (accent) list.push(field.color('accent', 'Cor de destaque', accent));
    if (text) list.push(field.color('textColor', 'Cor do texto', text));
    if (plate) list.push(field.color('plate', 'Cor do fundo', plate));
    if (font) list.push(field.font('font', 'Fonte', font));
    if (position) list.push(field.align('position', 'Posição', position));
    if (scale) list.push(field.range('scale', 'Tamanho', 1, { min: 0.6, max: 1.6, step: 0.05, display: 'multiplier' }));
    if (speed) list.push(field.range('speed', 'Velocidade da animação', 1, { min: 0.75, max: 1.5, step: 0.05, display: 'multiplier', section: 'timing' }));
    return list;
}

/**
 * Tempo em tela (pausa entre a entrada e a saída), em segundos. O motor acrescenta este campo sozinho quando o
 * template declara `pause: { at, length }` (ver kit.js); use esta função só para mudar rótulo/limites.
 */
export const pauseField = ({ length, min = 0.5, max = 30 }) =>
    field.range('pause', 'Tempo em tela (pausa)', length, { min, max, step: 0.1, display: 'seconds', section: 'timing' });

/** Logo + lado em que ele aparece (esquerda/direita da placa). */
export const logoControls = ({ side = 'right', label = 'Logo (opcional)' } = {}) => [
    field.image('logo', label),
    field.side('logoSide', 'Lado do logo', side),
];

/** Ícone (substituível) + lado em que ele aparece. */
export const iconControls = ({ icon = 'mic', side = 'left', label = 'Ícone', choices } = {}) => [
    field.icon('icon', label, icon, choices ? { choices } : {}),
    field.side('iconSide', 'Lado do ícone', side),
];

/**
 * Opacidade independente por elemento. Declare os elementos do design e registre cada um no setup:
 *   fields: [..., ...opacityControls([['plate', 'Fundo'], ['name', 'Nome'], ['logo', 'Logo']])]
 *   setup:  ctx.layer('plate', node)      // devolve o próprio node
 * O motor multiplica, a cada quadro, a opacidade do usuário (0..1) pela que o template animou no node
 * (ou pela inicial do estilo): fades continuam funcionando, só que escalados.
 * Registre nós que não sejam descendentes de outro nó registrado (a opacidade do pai afeta os filhos).
 */
export const opacityControls = (layers) => layers.map(([key, label]) =>
    field.range(`opacity_${key}`, label, 1, { min: 0, max: 1, step: 0.05, display: 'percent', section: 'transparency' }));

/* ========================================================================== */
/* Normalização e sanitização                                                  */
/* ========================================================================== */

/** Completa tipo e seção. Aceita campos antigos (`group: 'opacity'`). */
export function normalizeField(raw) {
    const type = raw.type ?? 'text';
    const section = raw.section ?? (raw.group === 'opacity' ? 'transparency' : DEFAULT_SECTION[type] ?? 'advanced');
    return { ...raw, type, section };
}

export const normalizeFields = (fields = []) => fields.map(normalizeField);

// data: URL de uma imagem enviada (até ~8 MB). Nunca aceitamos URL externa.
export const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_IMAGE_LENGTH = 11_000_000;
const validImage = (raw) => typeof raw === 'string' && raw.length <= MAX_IMAGE_LENGTH && IMAGE_DATA_URL.test(raw);

const FONT_IDS = new Set(FONTS.map((font) => font.id));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Valida/normaliza os valores segundo o schema. Chaves desconhecidas são descartadas.
 *   text    remove caracteres de controle, apara, corta em maxLength (vazio → padrão, salvo `allowEmpty`)
 *   color   #rrggbb          font   id conhecido         align/select   uma das opções
 *   range   número em min..max                            toggle         boolean
 *   image   SOMENTE data URL PNG/JPEG/WebP                icon           id da biblioteca OU data URL de imagem
 */
export function sanitize(fields, input = {}) {
    return Object.fromEntries(normalizeFields(fields).map((f) => {
        const raw = input[f.key];
        let value = f.default;
        switch (f.type) {
            case 'text':
                if (typeof raw === 'string') {
                    const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, f.maxLength ?? 200);
                    value = cleaned || (f.allowEmpty ? '' : f.default);
                }
                break;
            case 'color': if (typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw)) value = raw.toLowerCase(); break;
            case 'font': if (FONT_IDS.has(raw)) value = raw; break;
            case 'align':
            case 'select': if (f.options?.some((option) => option.value === raw)) value = raw; break;
            case 'range': if (raw !== null && raw !== '' && Number.isFinite(Number(raw))) value = clamp(Number(raw), f.min, f.max); break;
            case 'toggle': if (typeof raw === 'boolean') value = raw; break;
            case 'image': if (validImage(raw)) value = raw; break;
            case 'icon': if (ICON_IDS.includes(raw) || validImage(raw)) value = raw; break;
            default: break;
        }
        return [f.key, value];
    }));
}

/* ========================================================================== */
/* Presets (paletas e estilos reaproveitáveis entre templates)                 */
/* ========================================================================== */

/**
 * Um preset guarda apenas valores de campos "de estilo" — nunca textos, logos ou ícones do usuário.
 *   palette  → campos de cor
 *   style    → cores + fonte + posição + ajustes avançados (tamanho, velocidade, sombra…)
 * Ao aplicar em outro template, só entram as chaves que ele também possui (e válidas para ele).
 */
export const PRESET_KINDS = {
    palette: { label: 'Paleta', match: (f) => f.type === 'color' },
    style: { label: 'Estilo', match: (f) => f.type === 'color' || ['appearance', 'layout', 'advanced'].includes(f.section) },
};

/** Extrai { chave: valor } dos campos que o tipo de preset cobre. */
export function capturePreset(fields, values, kind) {
    const { match } = PRESET_KINDS[kind];
    return Object.fromEntries(normalizeFields(fields).filter((f) => match(f) && values[f.key] !== undefined).map((f) => [f.key, values[f.key]]));
}

/** Aplica um preset sobre `values` e devolve os novos valores (já sanitizados para este template). */
export function applyPreset(fields, values, preset) {
    const { match } = PRESET_KINDS[preset.kind] ?? PRESET_KINDS.style;
    const allowed = new Set(normalizeFields(fields).filter(match).map((f) => f.key));
    const patch = Object.fromEntries(Object.entries(preset.values ?? {}).filter(([key]) => allowed.has(key)));
    return sanitize(fields, { ...values, ...patch });
}

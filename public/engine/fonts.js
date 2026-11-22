/**
 * BlinkFrame — catálogo de fontes (100% offline).
 *
 * Os arquivos .woff2 (subconjunto latin: cobre todo o português) ficam em /public/fonts/<pasta>/ e são servidos
 * pelo servidor local. Todas são SIL Open Font License (veja public/fonts/LICENSES.md).
 *
 * Para adicionar uma fonte:
 *   1. Em uma pasta qualquer: `npm install @fontsource/<nome>` e copie de node_modules/@fontsource/<nome>/files/
 *      os arquivos `<nome>-latin-400-normal.woff2` (e `-700-` se existir) para public/fonts/<nome>/ (mais o LICENSE).
 *   2. Acrescente uma linha em CATALOG abaixo: font(id, rótulo, categoria, pasta, pesos).
 *      Fonte de peso único (ex.: Bungee) → pesos [400]: o catálogo evita o negrito sintético.
 *
 * O `id` é o que fica salvo nos rascunhos/presets: não renomeie ids existentes.
 */
export const FONT_BASE = '/fonts/';

/** Categorias exibidas no seletor de fontes, nesta ordem. */
export const FONT_CATEGORIES = [
    { id: 'sans', label: 'Sem serifa' },
    { id: 'display', label: 'Destaque (display)' },
    { id: 'serif', label: 'Com serifa' },
    { id: 'mono', label: 'Monoespaçada' },
    { id: 'script', label: 'Manuscrita' },
];

/** font(id, rótulo, categoria, pasta, pesos) — `family` é o nome CSS (igual ao rótulo, salvo exceções). */
const font = (id, label, category, folder, weights = [400, 700], family = label) => {
    const file = (weight) => `${folder}/${folder}-latin-${weight}-normal.woff2`;
    return {
        id, label, family, category,
        // Peso único → faixa "100 900": qualquer font-weight pedido usa o mesmo arquivo, sem negrito sintético.
        files: weights.length === 1 ? { '100 900': file(weights[0]) } : Object.fromEntries(weights.map((w) => [w, file(w)])),
    };
};

export const FONTS = [
    // Sem serifa
    font('inter', 'Inter', 'sans', 'inter'),
    font('montserrat', 'Montserrat', 'sans', 'montserrat'),
    font('poppins', 'Poppins', 'sans', 'poppins'),
    font('bricolage', 'Bricolage Grotesque', 'sans', 'bricolage-grotesque'),
    font('dm-sans', 'DM Sans', 'sans', 'dm-sans'),
    font('space-grotesk', 'Space Grotesk', 'sans', 'space-grotesk'),
    font('manrope', 'Manrope', 'sans', 'manrope'),
    font('outfit', 'Outfit', 'sans', 'outfit'),
    font('nunito', 'Nunito', 'sans', 'nunito'),
    font('jakarta', 'Plus Jakarta Sans', 'sans', 'plus-jakarta-sans'),
    // Destaque
    font('oswald', 'Oswald', 'display', 'oswald'),
    font('bebas', 'Bebas Neue', 'display', 'bebas-neue', [400]),
    font('anton', 'Anton', 'display', 'anton', [400]),
    font('bungee', 'Bungee', 'display', 'bungee', [400]),
    font('black-ops', 'Black Ops One', 'display', 'black-ops-one', [400]),
    font('monoton', 'Monoton', 'display', 'monoton', [400]),
    font('press-start', 'Press Start 2P', 'display', 'press-start-2p', [400]),
    font('alfa-slab', 'Alfa Slab One', 'display', 'alfa-slab-one', [400]),
    font('righteous', 'Righteous', 'display', 'righteous', [400]),
    font('russo', 'Russo One', 'display', 'russo-one', [400]),
    font('orbitron', 'Orbitron', 'display', 'orbitron'),
    // Com serifa
    font('playfair', 'Playfair Display', 'serif', 'playfair-display'),
    font('dm-serif', 'DM Serif Display', 'serif', 'dm-serif-display', [400]),
    font('cormorant', 'Cormorant Garamond', 'serif', 'cormorant-garamond'),
    font('lora', 'Lora', 'serif', 'lora'),
    font('merriweather', 'Merriweather', 'serif', 'merriweather'),
    // Monoespaçadas
    font('mono', 'Roboto Mono', 'mono', 'roboto-mono'),
    font('jetbrains', 'JetBrains Mono', 'mono', 'jetbrains-mono'),
    font('space-mono', 'Space Mono', 'mono', 'space-mono'),
    // Manuscritas
    font('pacifico', 'Pacifico', 'script', 'pacifico', [400]),
    font('caveat', 'Caveat', 'script', 'caveat'),
    font('dancing', 'Dancing Script', 'script', 'dancing-script'),
];

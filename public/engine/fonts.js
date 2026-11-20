/**
 * BlinkFrame — catálogo de fontes (100% offline).
 *
 * Os arquivos .woff2 vêm dos pacotes `@fontsource/*` instalados em node_modules e são servidos
 * pelo servidor local em /vendor/fontsource/. Para adicionar uma fonte:
 *   1. `npm install @fontsource/<nome>`
 *   2. adicione uma entrada abaixo (id, rótulo, família CSS e arquivos por peso).
 *
 * `files` mapeia peso -> arquivo (relativo a FONT_BASE). A chave pode ser uma faixa ("100 900"),
 * útil para fontes de peso único, evitando negrito sintético.
 */
export const FONT_BASE = '/vendor/fontsource/';

export const FONTS = [
    { id: 'inter', label: 'Inter', family: 'Inter', files: { 400: 'inter/files/inter-latin-400-normal.woff2', 700: 'inter/files/inter-latin-700-normal.woff2' } },
    { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', files: { 400: 'montserrat/files/montserrat-latin-400-normal.woff2', 700: 'montserrat/files/montserrat-latin-700-normal.woff2' } },
    { id: 'poppins', label: 'Poppins', family: 'Poppins', files: { 400: 'poppins/files/poppins-latin-400-normal.woff2', 700: 'poppins/files/poppins-latin-700-normal.woff2' } },
    { id: 'bricolage', label: 'Bricolage Grotesque', family: 'Bricolage Grotesque', files: { 400: 'bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff2', 700: 'bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2' } },
    { id: 'oswald', label: 'Oswald', family: 'Oswald', files: { 400: 'oswald/files/oswald-latin-400-normal.woff2', 700: 'oswald/files/oswald-latin-700-normal.woff2' } },
    { id: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue', files: { '100 900': 'bebas-neue/files/bebas-neue-latin-400-normal.woff2' } },
    { id: 'playfair', label: 'Playfair Display', family: 'Playfair Display', files: { 400: 'playfair-display/files/playfair-display-latin-400-normal.woff2', 700: 'playfair-display/files/playfair-display-latin-700-normal.woff2' } },
    { id: 'mono', label: 'Roboto Mono', family: 'Roboto Mono', files: { 400: 'roboto-mono/files/roboto-mono-latin-400-normal.woff2', 700: 'roboto-mono/files/roboto-mono-latin-700-normal.woff2' } },
];

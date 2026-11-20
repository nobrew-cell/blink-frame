/**
 * Diagnóstico do ambiente: Node, FFmpeg (versão/encoders), pacotes de fontes e navegador do Playwright.
 *   uso: npm run check
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { checkFfmpeg } from '../server/ffmpeg.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { failed = true; console.log(`  ✗ ${msg}`); };

console.log('\nBlinkFrame — verificação do ambiente\n');

const major = Number(process.versions.node.split('.')[0]);
major >= 18 ? ok(`Node.js ${process.version}`) : bad(`Node.js ${process.version} — é preciso 18 ou superior`);

const ff = checkFfmpeg();
if (ff.version) ok(ff.version);
for (const problem of ff.problems) bad(problem);
if (!ff.version) console.log('      Instale no Windows:  winget install Gyan.FFmpeg   (depois feche e reabra o terminal)');

existsSync(path.join(ROOT, 'node_modules', '@fontsource', 'inter'))
    ? ok('Fontes offline (@fontsource) instaladas')
    : bad('Fontes não encontradas — rode "npm install"');

const launch = { headless: true };
if (process.env.BF_BROWSER_CHANNEL) launch.channel = process.env.BF_BROWSER_CHANNEL;
if (process.env.BF_BROWSER_PATH) launch.executablePath = process.env.BF_BROWSER_PATH;
try {
    const browser = await chromium.launch(launch);
    ok(`Navegador headless OK (${launch.channel ?? launch.executablePath ?? 'Chromium do Playwright'}, v${browser.version()})`);
    await browser.close();
} catch (error) {
    bad(`Não foi possível abrir o navegador: ${error.message.split('\n')[0]}`);
    console.log('      Opção A: npm run browser            (baixa o Chromium, ~150 MB, uma vez)');
    console.log('      Opção B: set BF_BROWSER_CHANNEL=msedge   (usa o Edge já instalado no Windows)');
}

console.log(failed ? '\nExistem pendências acima.\n' : '\nTudo certo! Rode: npm start\n');
process.exit(failed ? 1 : 0);

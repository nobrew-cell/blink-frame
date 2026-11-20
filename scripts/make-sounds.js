/**
 * Gera os efeitos sonoros padrão (WAV 16-bit mono 44,1 kHz) em public/sounds — sem direitos autorais, 100% sintético.
 * Para usar sons próprios, coloque arquivos .wav com o mesmo nome em public/sounds
 * (ou em templates/<slug>/sounds/ para valer só para um template).
 *   uso: npm run sounds
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds');

function prng(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

function wav(samples) {
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
    header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
}

/** Whoosh: ruído filtrado com varredura de frequência e envelope em sino. `up` = brilho sobe (entrada) ou desce (saída). */
function whoosh(duration, up, seed) {
    const n = Math.floor(duration * RATE);
    const noise = prng(seed);
    const out = new Float32Array(n);
    let low = 0;
    let band = 0;
    for (let i = 0; i < n; i++) {
        const x = i / n;
        const env = Math.pow(Math.sin(Math.PI * Math.pow(x, up ? 0.7 : 1.4)), 1.6);
        const cutoff = (up ? 300 + 5200 * x * x : 5500 - 5000 * x) / RATE;
        const f = 2 * Math.sin(Math.PI * Math.min(cutoff, 0.2));
        const input = noise();
        low += f * band;
        const high = input - low - 0.6 * band;
        band += f * high;
        out[i] = band * env * 0.7;
    }
    return out;
}

/** Tecla: estalo curto de ruído + corpo senoidal que decai. */
function key(pitch, seed) {
    const n = Math.floor(0.07 * RATE);
    const noise = prng(seed);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / RATE;
        out[i] = (noise() * Math.exp(-t * 300) * 0.7 + Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 90) * 0.5) * 0.8;
    }
    return out;
}

/** Pop: seno com queda de frequência. */
function pop() {
    const n = Math.floor(0.16 * RATE);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / RATE;
        phase += (2 * Math.PI * (180 + 700 * Math.exp(-t * 28))) / RATE;
        out[i] = Math.sin(phase) * Math.exp(-t * 26) * 0.85;
    }
    return out;
}

const sounds = {
    'whoosh-in': whoosh(0.55, true, 11),
    'whoosh-out': whoosh(0.5, false, 23),
    'key-1': key(1500, 31),
    'key-2': key(1850, 37),
    'key-3': key(1250, 41),
    pop: pop(),
};

await mkdir(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
    await writeFile(path.join(OUT, `${name}.wav`), wav(samples));
    console.log(`  ✓ ${name}.wav`);
}

import { startServer } from './app.js';
import { checkFfmpeg } from './ffmpeg.js';

const port = Number(process.env.PORT) || 3000;

const ff = checkFfmpeg();
console.log(ff.version ? `FFmpeg: ${ff.version}` : '');
if (!ff.ok) {
    console.warn('\n⚠  Problemas com o FFmpeg (a exportação não vai funcionar até resolver):');
    for (const problem of ff.problems) console.warn(`   - ${problem}`);
    console.warn('   Rode "npm run check" para um diagnóstico completo.\n');
}

startServer({ port })
    .then(({ url }) => console.log(`\n  BlinkFrame rodando em ${url}\n  (Ctrl+C para encerrar)\n`))
    .catch((error) => {
        console.error(error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Use: set PORT=3001 && npm start` : error);
        process.exit(1);
    });

# BlinkFrame

Editor **local e offline-first** de motion graphics (começando por lower thirds).
Edite no navegador, exporte **.mov com alfa real** e **.mp4 com fundo verde (chroma key)** — sem cota, sem marca d'água, sem abrir o After Effects.

> "Precisa de uma lower? Tenha ela num piscar de olhos — um piscar para entrar e outro para sair."

## Instalação (Windows)

Pré-requisitos: **Node.js 18+** (https://nodejs.org) e **FFmpeg** no PATH.

```powershell
# 1) FFmpeg (se ainda não tiver) — depois feche e reabra o terminal
winget install Gyan.FFmpeg
ffmpeg -version

# 2) Dependências do projeto
cd blinkframe
npm install

# 3) Navegador headless para exportar — escolha UMA opção:
npm run browser                      # A) baixa o Chromium do Playwright (~150 MB, uma vez)
$env:BF_BROWSER_CHANNEL="msedge"     # B) usa o Microsoft Edge já instalado (sem download)

# 4) Diagnóstico (Node, FFmpeg, fontes, navegador)
npm run check

# 5) Rodar
npm start                            # abre em http://127.0.0.1:3000
```

No CMD use `set BF_BROWSER_CHANNEL=msedge` em vez de `$env:...`. Outra porta: `$env:PORT=3001; npm start`.
FFmpeg fora do PATH: `$env:FFMPEG_PATH="C:\ffmpeg\bin\ffmpeg.exe"` (e `FFPROBE_PATH` para o teste).

Teste ponta a ponta (renderiza os 3 templates e valida alfa, chroma e áudio com ffprobe): `npm run test:render`

## Como usar
1. Escolha um modelo na vitrine (passe o mouse para ver ao vivo).
2. No editor, altere texto, cores, fonte, posição, tamanho, velocidade e logo. Espaço = play/pause, ←/→ = quadro a quadro (Shift = 10).
3. **Exportar vídeo** → baixe o `.mov` (ProRes 4444 ou PNG com alfa) e/ou o `.mp4` verde (use "Chroma Key"/"Ultra Key" cor #00FF00).

## Logo interativa
`public/js/brand.js` carrega o SVG da logo inline e move só a íris: ao passar o mouse sobre cards, botões, abas e controles ela desliza de leve na direção do elemento e volta ao centro ao sair; sobre a própria marca ela acompanha o cursor (íris azul, como no arquivo "Procurando o Mouse"). Sem hover, fica parada. `prefers-reduced-motion` desliga o movimento. Os três SVGs originais ficam em `public/brand/` (o favicon é o "Aberto Normal" sobre ladrilho arredondado).

## Estrutura
```
blinkframe/
├─ package.json
├─ server/                 # Node + Express (127.0.0.1)
│  ├─ index.js             # entrada (verifica FFmpeg, sobe o servidor)
│  ├─ app.js               # rotas: /api/templates, /api/render, SSE, download
│  ├─ templates.js         # registro dinâmico (varre /templates)
│  ├─ jobs.js              # fila (1 por vez), progresso, cancelamento
│  ├─ renderer.js          # Playwright: quadro a quadro → PNG com alfa → FFmpeg
│  └─ ffmpeg.js            # verificação do ambiente e montagem do comando
├─ public/
│  ├─ index.html           # vitrine
│  ├─ editor.html          # editor
│  ├─ runner.html          # palco do template (iframe do editor e do exportador)
│  ├─ engine/              # motor determinístico: kit.js, parts.js, fonts.js, runner.js
│  ├─ css/ js/             # interface
│  ├─ brand/               # logos SVG + favicon
│  └─ sounds/              # efeitos .wav padrão
├─ templates/              # um modelo = uma pasta (meta.json + template.js)
│  ├─ entrevista-classica/
│  ├─ lower-minimalista/
│  └─ destaque-noticia/
├─ scripts/                # check-env, make-sounds, smoke-test
└─ output/                 # renders (limpos após 24 h)
```

## Criando um novo template
1. Crie `templates/meu-modelo/meta.json` (`name`, `description`, `tags`, `order`).
2. Crie `templates/meu-modelo/template.js` com `export default { fields, sizes, duration, thumbAt, sounds, setup, render }`
   — copie um existente. `render(t, state, ctx)` deve depender **só de `t`** (nada de timers, transitions ou `Math.random`; use `rand(seed)`).
3. Recarregue a vitrine: o modelo aparece sozinho. Os controles do editor nascem do array `fields`.

**Transparência por elemento:** declare os elementos com `...opacityControls([['plate','Fundo'],['name','Nome']])` em `fields` e registre cada nó no `setup` com `ctx.layer('plate', node)`. O editor ganha a seção "Transparência dos elementos" (um slider 0–100% por item). Para o fundo de um contêiner ter opacidade própria sem apagar o conteúdo, use `backdrop(contêiner, cor)` de `parts.js` e registre o retorno.

Sons próprios: coloque `nome.wav` em `public/sounds/` (global) ou em `templates/<slug>/sounds/` (só daquele modelo) e use `{ at, sound: 'nome', gain }` em `sounds`.
Fontes novas: `npm i @fontsource/<fonte>` e uma linha em `public/engine/fonts.js`.

## Notas técnicas
- **Determinismo:** cada quadro é pedido por `window.renderFrame(t)`, `t = frame / fps`; o export também injeta CSS que desativa transitions/animations.
- **Alfa:** `page.screenshot({ omitBackground: true })` → PNG RGBA → FFmpeg `prores_ks -profile:v 4444 -pix_fmt yuva444p10le` (ou `png` em MOV).
- **Chroma:** o mesmo fluxo é composto sobre `#00FF00` → `libx264 yuv420p` BT.709. Os templates evitam verde para não serem removidos pelo key.
- Tudo escuta apenas em `127.0.0.1`; nenhuma chamada externa (fontes e sons são locais).

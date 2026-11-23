# BlinkFrame

Editor **local e offline-first** de motion graphics (começando por lower thirds).
Edite no navegador, exporte **.mov com alfa real** e **.mp4 com fundo verde (chroma key)** — sem cota, sem marca d'água, sem abrir o After Effects.

> "Precisa de uma lower? Tenha ela num piscar de olhos — um piscar para entrar e outro para sair."

## Instalação (Windows) — jeito fácil
Dê **duplo clique em `iniciar-blinkframe.bat`**. Ele abre o CMD, chama o PowerShell e:
1. **Na primeira vez** verifica Node.js 18+, FFmpeg (oferece `winget install Gyan.FFmpeg`), faz `npm install`, usa o Microsoft Edge já instalado (ou baixa o Chromium) e roda o diagnóstico. Depois grava `.blinkframe-ok.json`.
2. **Nas próximas vezes** pula a verificação e vai direto ao servidor, abrindo o navegador em http://127.0.0.1:3000.
3. **Mantenha a janela aberta** enquanto usar: fechar a janela (ou Ctrl+C) encerra o programa.

Refazer a verificação: `iniciar-blinkframe.bat verificar`. Se a porta 3000 estiver ocupada, ele usa a próxima livre.

## Instalação manual
Pré-requisitos: **Node.js 18+** e **FFmpeg** no PATH.

```powershell
winget install Gyan.FFmpeg          # depois feche e reabra o terminal
npm install
npm run browser                     # A) Chromium do Playwright (~150 MB, uma vez)
$env:BF_BROWSER_CHANNEL="msedge"    # B) ou o Edge já instalado
npm run check                       # diagnóstico
npm start                           # http://127.0.0.1:3000
```
No CMD use `set` em vez de `$env:`. Outra porta: `$env:PORT=3001`. FFmpeg fora do PATH: `$env:FFMPEG_PATH` / `FFPROBE_PATH`.

Teste ponta a ponta (renderiza os 4 templates e valida alfa, chroma e áudio): `npm run test:render`

## Como usar
1. Escolha um modelo na vitrine (passe o mouse para ver ao vivo).
2. No editor o painel é dividido em seções dobráveis (como no Photoshop; o que está aberto fica lembrado): **Formato e posição** (16:9 · YouTube, 9:16, 1:1; esquerda/centro/direita), **Tempo e animação** (velocidade e **Tempo em tela**: quantos segundos o conteúdo fica parado entre a entrada e a saída), **Conteúdo**, **Ícone e mídia** (biblioteca ou seu SVG/PNG; lado esquerdo/direito), **Aparência** (cores, fonte com prévia), **Paletas e estilos salvos**, **Transparência**, **Áudio e efeitos** e **Ajustes avançados**. Espaço = play/pause, ←/→ = quadro a quadro (Shift = 10).
3. **Paletas e estilos:** salve as cores (ou cores + fonte + posição) e aplique em qualquer outro template; exporte/importe em `.json`.
4. **Exportar vídeo** → baixe o `.mov` (ProRes 4444 ou PNG com alfa) e/ou o `.mp4` verde (use "Chroma Key"/"Ultra Key" cor #00FF00).

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
│  ├─ css/ js/             # interface (js/editor/: state, panel, controls, presets, output, transport, export)
│  ├─ presets/             # paletas embutidas (palettes.json)
│  ├─ brand/               # logos SVG + favicon
│  └─ sounds/              # efeitos .wav padrão
├─ templates/              # um modelo = uma pasta (meta.json + template.js)
│  ├─ entrevista-classica/
│  ├─ lower-minimalista/
│  ├─ destaque-noticia/
│  ├─ entrevista-microfone/  # selo superior + ícone trocável/lado
│  ├─ cartao-citacao/  cartao-inscreva-se/  chamada-shorts/  like-inscreva-sininho/
│  └─ lower-corporativo/  tela-final-minimalista/  cartao-comentario/
├─ docs/GUIA-TEMPLATES.md  # como estender (templates, paletas, fontes, ícones, IA)
├─ iniciar-blinkframe.bat  # inicializador Windows (+ scripts/iniciar.ps1)
├─ scripts/                # check-env, make-sounds, smoke-test, iniciar.ps1
└─ output/                 # renders (limpos após 24 h)
```

## Criando um novo template
Guia completo (campos, seções, paletas, fontes, ícones, instruções para IA): **docs/GUIA-TEMPLATES.md**. Resumo:
1. Crie `templates/meu-modelo/meta.json` (`name`, `description`, `tags`, `order`).
2. Crie `templates/meu-modelo/template.js` com `export default { fields, sizes, duration, thumbAt, sounds, setup, render }`
   — copie um existente. `render(t, state, ctx)` deve depender **só de `t`** (nada de timers, transitions ou `Math.random`; use `rand(seed)`).
3. Recarregue a vitrine: o modelo aparece sozinho. Os controles do editor nascem do array `fields`.

**Transparência por elemento:** declare os elementos com `...opacityControls([['plate','Fundo'],['name','Nome']])` em `fields` e registre cada nó no `setup` com `ctx.layer('plate', node)`. O editor ganha a seção "Transparência dos elementos" (um slider 0–100% por item). Para o fundo de um contêiner ter opacidade própria sem apagar o conteúdo, use `backdrop(contêiner, cor)` de `parts.js` e registre o retorno.

Sons próprios: coloque `nome.wav` em `public/sounds/` (global) ou em `templates/<slug>/sounds/` (só daquele modelo) e use `{ at, sound: 'nome', gain }` em `sounds`.
Fontes novas: `npm i @fontsource/<fonte>` e uma linha em `public/engine/fonts.js`.

## Modo ao vivo (gancho para OBS)
O estado (campos) é independente de como é exibido. `/runner.html?template=<slug>&mode=live&channel=<id>` mostra o template com fundo transparente e sem interface, comandado por mensagens `in`/`out`/`toggle` (BroadcastChannel, ver `public/engine/protocol.js` e `public/js/editor/output.js`). A tela de controle ao vivo ainda não existe; a base está pronta.

## Notas técnicas
- **Determinismo:** cada quadro é pedido por `window.renderFrame(t)`, `t = frame / fps`; o export também injeta CSS que desativa transitions/animations.
- **Alfa:** `page.screenshot({ omitBackground: true })` → PNG RGBA → FFmpeg `prores_ks -profile:v 4444 -pix_fmt yuva444p10le` (ou `png` em MOV).
- **Chroma:** o mesmo fluxo é composto sobre `#00FF00` → `libx264 yuv420p` BT.709. Os templates evitam verde para não serem removidos pelo key.
- Tudo escuta apenas em `127.0.0.1`; nenhuma chamada externa (fontes e sons são locais).

## Telas de crédito
- **Créditos em Cartões**: os principais, um cartão por vez (entra de qualquer lado ou de cima/baixo), com logo no final.
- **Créditos Rolantes**: rolagem contínua com grupos, logos de apoiadores, direitos e logo final. A duração segue o tamanho do texto.
Detalhes da sintaxe em `docs/GUIA-TEMPLATES.md`.

## Meu espaço
Página `/perfil.html`: favoritos (coração nos modelos), paletas e estilos salvos, preferências e backup. Pode ser a página inicial (Preferências).

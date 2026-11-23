# Guia de extensão do BlinkFrame

Para quem for acrescentar coisas (você, ou uma IA trabalhando por você). Leia a seção 0 inteira: ela é o contrato.

## 0. Regras que não se quebram
1. **Determinismo.** `render(t, state, ctx)` depende só de `t` (segundos) e dos valores dos campos. Nada de `setTimeout`, CSS `transition`/`animation`, `Math.random` (use `rand(seed)`) ou `Date.now`. É isso que faz o quadro N ser idêntico no preview, na vitrine, no modo ao vivo e na exportação.
2. **Estado separado de exibição.** Os campos (`fields`) descrevem *o que* aparece; os modos (`public/engine/modes.js`: driven, loop, live) decidem *quando*. Um template nunca sabe em que modo está.
3. **Tudo local.** Nenhuma chamada externa: fontes, sons e ícones vêm de `public/`.
4. **Sem verde puro (#00FF00)** nos templates: o .mp4 usa esse fundo para chroma key.
5. **Nada específico de template no editor.** O painel é gerado do schema. Se precisar de um controle novo, crie um *tipo de campo* (seção 6), não um `if (template === ...)`.

## 1. Anatomia de um template
```
templates/meu-modelo/
├─ meta.json      { id, name, description, category, tags, order }
├─ template.js    export default { fields, sizes, duration, thumbAt, pause, sounds, setup, render }
└─ sounds/        (opcional) .wav só deste modelo
```
Modelos de referência: `entrevista-microfone` (ícone/lado/posição/transparência), `cartao-inscreva-se` e `like-inscreva-sininho` (cursor clicando, troca de estado do botão), `cartao-citacao` (palavras, logo no rodapé), `tela-final-minimalista` (pausa longa, tela inteira). Use `templates/entrevista-microfone/` como ponto de partida: ele usa ícone trocável, lado do ícone, posição, transparência por elemento e barras animadas.

Ciclo: o runner carrega `template.js` → lê `fields` → o editor monta o painel → cada mudança chama `setup(root, ctx)` de novo (reconstrói o DOM) → `render(t, state, ctx)` pinta cada instante.

## 2. Campos e seções
Cada campo declara sua seção; o editor distribui nos acordeões (Formato e posição · Conteúdo · Ícone e mídia · Aparência · Paletas e estilos · Transparência · Áudio e efeitos · Avançado).

| Construtor (`field.*`) | Tipo | Observação |
|---|---|---|
| `field.text(key, label, default, { maxLength, allowEmpty })` | texto | seção Conteúdo |
| `field.color(key, label, default)` | cor | Aparência |
| `field.font(key, label, default)` | fonte | com prévia de cada fonte |
| `field.align(key, label, default)` | Esquerda/Centro/Direita | Formato e posição |
| `field.select`, `field.range`, `field.toggle` | opções, número, liga/desliga | passe `{ section: '...' }` para escolher o acordeão |
| `field.image(key, label)` | imagem (PNG/JPG/WebP/SVG → PNG) | Ícone e mídia |

Atalhos prontos (use sempre que couber, é isso que padroniza os templates):
- `controls({ accent, text, plate, font, position, scale, speed })` → cores, fonte, posição, tamanho e velocidade padrão.
- `iconControls({ icon, side, choices })` → ícone da biblioteca **ou** arquivo do usuário + lado esquerdo/direito.
- `logoControls({ side })` → logo opcional.
- `opacityControls([['plate','Fundo'], ['name','Nome']])` → um slider 0–100% por elemento.

**Chaves padronizadas** (`pause`, `accent`, `textColor`, `plate`, `font`, `position`, `scale`, `speed`, `icon`, `iconSide`): paletas e estilos salvos só funcionam entre templates que compartilham as mesmas chaves. Reaproveite-as; invente chave nova só para o que é realmente novo.

## 2b. Tempo em tela (pausa) — vale para TODOS os templates
Todo template segue **entrada → pausa → saída**. O usuário controla a pausa no acordeão *Tempo e animação* ("Tempo em tela", em segundos) e a *Velocidade* da animação. Para o template participar, declare:
```js
pause: { at: 3.0, length: 3.0, min: 1 }   // tempo do template em segundos
//        at = instante em que a entrada TERMINOU (um cartão, por exemplo, está todo desenhado)
//        length = duração padrão da pausa (a saída começa em at + length)
//        min / max = limites do controle (padrão 0,5 e 30 s)
```
O motor reescreve o tempo: antes de `at` o `t` corre normal; durante a pausa o `t` avança até `at + length` e **fica parado** (tudo o que é de entrada termina e pára); depois a saída roda. A duração total, os sons e o quadro de capa são recalculados sozinhos. **Movimentos contínuos DURANTE a pausa** (barras de áudio, cursor piscando, anel girando, seta pulando) devem usar `ctx.time` — um relógio que nunca para — em vez de `t`: `render(t, s, ctx)`. Regra: tudo que é "evento" (entrar, clicar, digitar) usa `t`; tudo que é "ambiente" usa `ctx.time`. Escolha `at` depois do último evento de entrada.

## 3. Escrevendo `setup` e `render`
- `setup(root, ctx)`: cria o DOM uma vez com `el(tag, styles, parent, text)`. Valores em `ctx.values`; largura útil em `layoutWidth(ctx)`; `anchor(root, ctx)` posiciona conforme formato e posição.
- Para ícone: `iconNode(parent, values.icon, tamanho, { color })` — já aceita o ícone enviado pelo usuário. Para o lado: `order: values.iconSide === 'right' ? 1 : -1` num flex.
- Para transparência por elemento: `ctx.layer('plate', node)`; fundo de um contêiner sem apagar o conteúdo: `ctx.layer('plate', backdrop(box, 'var(--plate)'))`.
- `render(t, state, ctx)`: só estilos calculados com `prog(t, ini, fim, ease.x)` e `inOut(...)`. Entrada na primeira metade, saída na segunda; `holdAt` é o instante em que o modo ao vivo congela até receber "out".
- **Peças prontas para animações de clique** (`parts.js`): `cursorNode(parent)` desenha a seta do mouse (a ponta fica na origem do nó); `track(t, [{t, x, y, ease}, …])` interpola o caminho; `layoutPos(node, ancestral)` dá a posição de um botão para o cursor mirar; `iconBurst(parent, {name:'heart', start})` solta corações/polegares/sininhos; `pressAt` (veja `like-inscreva-sininho`) faz o botão afundar no clique.
- Texto que entra palavra por palavra: `words(parent, texto)` e anime a opacidade de cada `<span>` (veja `cartao-citacao`).
- Sons: `sounds: [{ at: 0.25, sound: 'whoosh', gain: 0.8 }]`. Arquivos `.wav` em `public/sounds/` (globais) ou `templates/<slug>/sounds/`.

## 4. Passo a passo: novo template
1. Copie `templates/entrevista-microfone/` para `templates/meu-modelo/`.
2. Edite `meta.json` (`id` = nome da pasta; `order` define a posição na vitrine).
3. Ajuste `fields` (mantenha as chaves padronizadas), `setup` e `render`.
4. Abra a vitrine: o card aparece sozinho. Teste no editor: formatos 16:9/9:16/1:1, as 3 posições, os 2 lados do ícone, ícone enviado e textos longos.
5. `npm run test:render` renderiza todos os templates e valida alfa/chroma com o ffprobe.

## 5. Paletas, estilos, fontes e ícones
- **Paletas embutidas:** `public/presets/palettes.json`. Copie um bloco de `palettes`, mude `id`, `name` e as cores (`accent`, `textColor`, `plate`). Aparece em todos os templates que têm essas chaves.
- **Paletas e estilos do usuário:** botões "Salvar paleta atual" / "Salvar estilo atual" (localStorage `blinkframe:presets:v1`). *Paleta* = cores; *estilo* = cores + fonte + posição + tamanho/velocidade. Exportar/Importar `.json` para backup ou para levar a outro computador. Tipos de preset novos: `PRESET_KINDS` em `public/engine/schema.js`.
- **Fonte principal:** o campo de fonte com a chave `font` define `--font` (as outras fontes, ex.: `authorFont`, você aplica com `fontFamily(id)`).
- **Fontes:** `npm i @fontsource/<fonte>`, copie o `.woff2` para `public/fonts/` e acrescente uma linha em `public/engine/fonts.js` (id, nome, categoria, arquivo).
- **Ícones da biblioteca:** acrescente o desenho (viewBox 24×24, traço/preenchimento `currentColor`) em `public/engine/icons.js` e cite a chave em `choices`.
- **Ícone do usuário:** nenhum código: o campo `icon` do painel aceita SVG/PNG/JPG/WebP (vira PNG ≤512px no navegador; o servidor só aceita `data:image/png|jpeg|webp`).

## 6. Tipos novos de campo e de elemento (futuro)
Hoje os elementos são lower thirds. Para vídeo, gráficos ou transições:
1. Crie a pasta em `templates/` e, em `meta.json`, use `"category": "grafico"` (ou `video`, `transicao`...). A vitrine já lê a categoria.
2. Para um **campo novo** (ex.: seletor de vídeo): acrescente o tipo em `FIELD_TYPES` e na tratativa de `sanitize` (`schema.js`), e o controle correspondente em `public/js/editor/controls.js`. Seções novas: `SECTIONS` em `schema.js`.
3. Vídeo de entrada precisa de um *frame provider* determinístico (decodificar o quadro de `t`, nunca tocar `<video>` em tempo real) — siga a regra 1.

## 7. Gancho para o modo ao vivo / OBS
Já existe a separação necessária:
- **Estado** (valores, formato, tempo) em `public/js/editor/state.js`, com eventos.
- **Saída** em `public/js/editor/output.js`: `createRunnerOutput` (iframe do preview) e `createLiveOutput` (envia campos e *cues* por `BroadcastChannel`).
- **Runner em modo live:** `/runner.html?template=<slug>&mode=live&channel=<id>` — fundo transparente, sem interface. Mensagens em `public/engine/protocol.js` (`bf:fields`, `bf:cue` com `in`/`out`/`toggle`). Em OBS: *Fonte de navegador* com essa URL (servidor rodando).
- A tela de controle ao vivo ainda não existe: ela só precisa criar um `createLiveOutput`, reaproveitar `panel.js` para os campos e acrescentar botões que enviem `in`/`out`.

## 8. Instruções curtas para uma IA
> Leia `docs/GUIA-TEMPLATES.md` e `templates/entrevista-microfone/`. Crie o template pedido em `templates/<slug>/` reaproveitando `controls`, `iconControls` e `opacityControls`; mantenha as chaves padronizadas; `render` só pode depender de `t`. Não altere `public/js/editor/` para um template específico. Ao final rode `npm run test:render` e abra o editor nos três formatos.

## Créditos (Créditos em Cartões e Créditos Rolantes)

Os dois templates usam o mesmo módulo (`public/engine/credits.js`) e o mesmo campo `credits`.

### Como o usuário edita
No editor, a seção **Conteúdo** mostra os créditos por **grupos**: cada grupo tem título, subtítulo opcional, linhas *função / nome* e uma observação pequena. Botões de **+** e **−** adicionam ou removem linhas e grupos; as setas movem o grupo. **Enter** no nome cria outra linha; **Shift+Enter** repete a função (vários nomes na mesma função). "Carregar um modelo" preenche tudo com um exemplo.

### Para quem cria templates
- `field.credits(key, label, textoPadrão, { examples })` cria o editor visual. O valor é `[{ title, sub, rows:[{role,name}], note }]` (`engine/credits-data.js`).
- O motor de layout ainda lê o texto interno (`# GRUPO | sub`, `Função | Nome`, `| outro nome`, `~ nota`, linha em branco = página). Converta com `groupsToText(values.credits)` antes de `parseCredits()`. `textToGroups()` faz o inverso (modelos prontos e projetos antigos).
- `duration`, `thumbAt` e `holdAt` podem ser **funções** `(state, ctx) => segundos`; `sounds` pode ser função `(ctx, state)`.
- `field.paragraph(...)` (texto de várias linhas) e `field.images(...)` (lista de imagens) também existem.
- `creditBlock()` e `endCard()` desenham um grupo e a logo final; novos modelos entram em `EXAMPLES_CARDS` / `EXAMPLES_ROLL` (em texto).

## Meu espaço, favoritos e vitrine
- `/perfil.html` ("Meu espaço"): favoritos, paletas e estilos salvos (excluir, importar/exportar), preferências (página inicial, prévias ao vivo) e backup completo. Tudo em localStorage (`js/shared/store.js`).
- O coração aparece nos cartões da vitrine e no editor. A vitrine tem busca, filtro por categoria e "Favoritos".
- Cartões leves (`js/cards.js`): o iframe só é criado quando o cartão aparece, em fila de 2, e é destruído quando sai da tela. A animação só toca com o mouse em cima e dá para desligar em Preferências.
- Ícones das seções do editor: `SECTION_ICONS` em `js/editor/panel.js`.

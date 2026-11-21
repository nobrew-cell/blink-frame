<#
  BlinkFrame - inicializador (chamado por iniciar-blinkframe.bat)

  Primeira execucao: verifica Node.js, FFmpeg, dependencias (npm install) e o navegador usado na exportacao,
  oferecendo instalar o que faltar. Depois grava .blinkframe-ok.json e, nas proximas vezes, vai direto ao servidor.
  A verificacao e refeita sozinha se o package-lock.json mudar, ou manualmente:  iniciar-blinkframe.bat verificar
#>
param([switch]$verificar)
if ($args -contains 'verificar') { $verificar = $true }

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$Raiz = (Get-Location).Path
$Marca = Join-Path $Raiz '.blinkframe-ok.json'
$Host.UI.RawUI.WindowTitle = 'BlinkFrame (mantenha esta janela aberta)'

function Ok($t)    { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Falha($t) { Write-Host "  [XX] $t" -ForegroundColor Red }
function Passo($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }

function Atualizar-Path {
    # Depois de um "winget install" o PATH da sessao fica velho: recarrega Maquina + Usuario.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Tem($comando) { return [bool](Get-Command $comando -ErrorAction SilentlyContinue) }
function Perguntar($texto) {
    $r = Read-Host "$texto [S/n]"
    return ($r -eq '' -or $r -match '^[sSyY]')
}
function Instalar-Com-Winget($id, $nome) {
    if (-not (Tem 'winget')) {
        Falha "O winget nao esta disponivel. Instale $nome manualmente (veja o README.md) e rode este arquivo de novo."
        return $false
    }
    if (-not (Perguntar "Instalar $nome agora com o winget?")) { return $false }
    winget install -e --id $id --accept-source-agreements --accept-package-agreements
    Atualizar-Path
    return $true
}
function Hash-Lock {
    $arq = Join-Path $Raiz 'package-lock.json'
    if (Test-Path $arq) { return (Get-FileHash $arq -Algorithm SHA256).Hash }
    return (Get-FileHash (Join-Path $Raiz 'package.json') -Algorithm SHA256).Hash
}
function Navegador-Edge {
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($base -and (Test-Path (Join-Path $base 'Microsoft\Edge\Application\msedge.exe'))) { return $true }
    }
    return $false
}
function Porta-Livre($porta) {
    try {
        $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $porta)
        $l.Start(); $l.Stop(); return $true
    } catch { return $false }
}

Write-Host ""
Write-Host "  ==============================================" -ForegroundColor Magenta
Write-Host "    BlinkFrame - lower thirds num piscar de olhos" -ForegroundColor Magenta
Write-Host "  ==============================================" -ForegroundColor Magenta

# ---------------------------------------------------------------------------
# Verificacao (primeira vez, ou quando o projeto mudou, ou com o argumento "verificar")
# ---------------------------------------------------------------------------
$estado = $null
if ((Test-Path $Marca) -and -not $verificar) {
    try { $estado = Get-Content $Marca -Raw | ConvertFrom-Json } catch { $estado = $null }
}
$precisaVerificar = $verificar -or -not $estado -or ($estado.lock -ne (Hash-Lock)) -or -not (Test-Path (Join-Path $Raiz 'node_modules'))
$navegador = if ($estado) { $estado.navegador } else { $null }

if ($precisaVerificar) {
    Passo 'Primeira verificacao (so acontece uma vez)'

    # 1) Node.js
    if (-not (Tem 'node')) {
        Aviso 'Node.js nao encontrado.'
        if (-not (Instalar-Com-Winget 'OpenJS.NodeJS.LTS' 'Node.js (LTS)')) {
            Falha 'Instale o Node.js 18+ em https://nodejs.org e rode este arquivo de novo.'
            exit 1
        }
    }
    if (-not (Tem 'node')) { Falha 'Node.js instalado, mas esta janela ainda nao o enxerga. Feche e abra o arquivo de novo.'; exit 1 }
    $major = [int](node -p "process.versions.node.split('.')[0]")
    if ($major -lt 18) { Falha "Node.js $(node -v) e antigo: e preciso 18 ou superior (https://nodejs.org)."; exit 1 }
    Ok "Node.js $(node -v)"

    # 2) FFmpeg e FFprobe
    if (-not ((Tem 'ffmpeg') -and (Tem 'ffprobe'))) {
        Aviso 'FFmpeg nao encontrado (e ele que gera o .mov e o .mp4).'
        Instalar-Com-Winget 'Gyan.FFmpeg' 'FFmpeg' | Out-Null
    }
    if (-not (Tem 'ffmpeg')) {
        Falha 'FFmpeg continua indisponivel. Instale (winget install Gyan.FFmpeg), feche e reabra este arquivo.'
        exit 1
    }
    Ok ((ffmpeg -version | Select-Object -First 1))

    # 3) Dependencias do projeto
    Passo 'Instalando dependencias (npm install)'
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Falha 'npm install falhou. Verifique a internet e tente de novo.'; exit 1 }
    Ok 'Dependencias instaladas'

    # 4) Navegador da exportacao: usa o Edge ja instalado (sem download); se nao houver, baixa o Chromium (~150 MB, uma vez)
    Passo 'Navegador usado na exportacao'
    $verificou = $false
    if (Navegador-Edge) {
        $env:BF_BROWSER_CHANNEL = 'msedge'
        node scripts/check-env.js | Out-Null
        if ($LASTEXITCODE -eq 0) { $navegador = 'msedge'; $verificou = $true; Ok 'Usando o Microsoft Edge ja instalado (nenhum download necessario)' }
        else { Remove-Item Env:BF_BROWSER_CHANNEL -ErrorAction SilentlyContinue }
    }
    if (-not $verificou) {
        Aviso 'Baixando o Chromium do Playwright (so desta vez, pode demorar)...'
        npx playwright install chromium
        if ($LASTEXITCODE -ne 0) { Falha 'Nao foi possivel baixar o Chromium. Verifique a internet.'; exit 1 }
        $navegador = 'chromium'
    }

    # 5) Diagnostico final
    Passo 'Diagnostico final'
    if ($navegador -eq 'msedge') { $env:BF_BROWSER_CHANNEL = 'msedge' }
    node scripts/check-env.js
    if ($LASTEXITCODE -ne 0) { Falha 'Ainda existem pendencias acima. Resolva-as e rode este arquivo de novo.'; exit 1 }

    @{ lock = (Hash-Lock); navegador = $navegador; verificadoEm = (Get-Date).ToString('s') } | ConvertTo-Json | Set-Content -Path $Marca -Encoding UTF8
    Ok 'Tudo pronto! Nas proximas vezes a verificacao sera pulada.'
} else {
    Write-Host ""
    Ok 'Ambiente ja verificado (use "iniciar-blinkframe.bat verificar" para refazer)'
    Atualizar-Path
    if (-not (Tem 'node')) { Falha 'Node.js nao encontrado. Rode: iniciar-blinkframe.bat verificar'; exit 1 }
}

if ($navegador -eq 'msedge') { $env:BF_BROWSER_CHANNEL = 'msedge' }

# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------
$porta = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$tentativas = 0
while (-not (Porta-Livre $porta) -and $tentativas -lt 10) { $porta++; $tentativas++ }
if ($tentativas -ge 10) { Falha 'Nenhuma porta livre entre 3000 e 3010.'; exit 1 }
$env:PORT = "$porta"
$url = "http://127.0.0.1:$porta"

# Abre o navegador assim que o servidor responder (processo separado e oculto)
$abridor = "for (`$i = 0; `$i -lt 60; `$i++) { try { Invoke-WebRequest -UseBasicParsing '$url/api/health' -TimeoutSec 1 | Out-Null; Start-Process '$url'; break } catch { Start-Sleep -Milliseconds 500 } }"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $abridor | Out-Null

Write-Host ""
Write-Host "  ------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "   MANTENHA ESTA JANELA ABERTA enquanto estiver usando o BlinkFrame." -ForegroundColor Yellow
Write-Host "   Fechar esta janela (ou Ctrl+C) encerra o programa." -ForegroundColor Yellow
Write-Host "   Endereco: $url   (o navegador abre sozinho)" -ForegroundColor Yellow
Write-Host "  ------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

node server/index.js
exit $LASTEXITCODE

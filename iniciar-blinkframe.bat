@echo off
rem ============================================================================
rem  BlinkFrame - inicializador para Windows
rem  Duplo clique: abre esta janela (CMD), que chama o PowerShell para
rem    1) verificar o ambiente (so na primeira vez), 2) iniciar o servidor,
rem    3) abrir o navegador. Mantenha esta janela aberta enquanto usar o app.
rem  Para refazer a verificacao:  iniciar-blinkframe.bat verificar
rem ============================================================================
chcp 65001 >nul
title BlinkFrame
cd /d "%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
    echo.
    echo [!!] O PowerShell nao foi encontrado neste computador.
    echo      Instale o PowerShell ou siga o passo a passo do README.md.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1" %*
set "CODIGO=%errorlevel%"

echo.
if not "%CODIGO%"=="0" (
    echo [!!] O BlinkFrame parou com erro ^(codigo %CODIGO%^). Leia as mensagens acima.
) else (
    echo O BlinkFrame foi encerrado.
)
echo.
pause
exit /b %CODIGO%

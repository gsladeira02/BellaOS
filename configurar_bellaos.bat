@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BellaOS - Configurador

echo.
echo ==========================================
echo  BellaOS - Configurador
echo ==========================================
echo.
echo Execute este arquivo dentro da pasta do BellaOS, onde ficam index.html, app.js e vercel.json.
echo.

set "APPJS=app.js"
if not exist "%APPJS%" (
  echo ERRO: app.js nao encontrado.
  echo Entre na pasta correta antes de executar este .bat.
  pause
  exit /b 1
)

set /p PUBLIC_BASE_URL=Dominio publico [https://bella-os.vercel.app]: 
if "%PUBLIC_BASE_URL%"=="" set "PUBLIC_BASE_URL=https://bella-os.vercel.app"

set /p SUPABASE_PROJECT_URL=URL do projeto Supabase [https://omhrigszheellguyyihz.supabase.co]: 
if "%SUPABASE_PROJECT_URL%"=="" set "SUPABASE_PROJECT_URL=https://omhrigszheellguyyihz.supabase.co"

set /p SUPABASE_PUBLISHABLE_KEY=Supabase publishable/anon key [manter atual]: 
if "%SUPABASE_PUBLISHABLE_KEY%"=="" set "SUPABASE_PUBLISHABLE_KEY=sb_publishable_Urza4wG2be2xxgMzxJrCEQ_ya_uV0z-"

set /p INFINITE_TAG=InfiniteTag da InfinitePay sem $: 
if "%INFINITE_TAG%"=="" (
  echo ERRO: InfiniteTag obrigatoria para liberar o checkout da tela inicial.
  pause
  exit /b 1
)

echo.
echo Aplicando configuracoes no app.js...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='app.js';" ^
  "$c=Get-Content $p -Raw;" ^
  "$c=$c -replace \"const PUBLIC_BASE_URL = '[^']*';\", \"const PUBLIC_BASE_URL = '%PUBLIC_BASE_URL%';\";" ^
  "$c=$c -replace \"const SUPABASE_PROJECT_URL = '[^']*';\", \"const SUPABASE_PROJECT_URL = '%SUPABASE_PROJECT_URL%';\";" ^
  "$c=$c -replace \"const SUPABASE_PUBLISHABLE_KEY = '[^']*';\", \"const SUPABASE_PUBLISHABLE_KEY = '%SUPABASE_PUBLISHABLE_KEY%';\";" ^
  "$c=$c -replace \"const DEFAULT_INFINITEPAY_HANDLE = '[^']*';\", \"const DEFAULT_INFINITEPAY_HANDLE = '%INFINITE_TAG%';\";" ^
  "Set-Content $p $c -Encoding UTF8;"

if errorlevel 1 (
  echo ERRO: nao consegui atualizar o app.js.
  pause
  exit /b 1
)

echo.
echo Configuracao concluida.
echo.
echo IMPORTANTE:
echo 1. Execute o arquivo supabase_schema.sql no SQL Editor do Supabase.
echo 2. Suba estes arquivos para o GitHub limpo.
echo 3. Na Vercel, mantenha o projeto bella-os.
echo 4. Se usar a CLI, rode primeiro: vercel link
echo 5. Depois rode: vercel --prod
echo.
echo Nunca coloque service_role key no frontend. Use apenas publishable/anon key.
echo.

set /p DEPLOY=Quer publicar agora pela Vercel CLI? [S/N]: 
if /I not "%DEPLOY%"=="S" goto END

where vercel >nul 2>nul
if errorlevel 1 (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo ERRO: Node.js/npm nao encontrado. Instale o Node.js antes de publicar pela CLI.
    pause
    exit /b 1
  )
  echo Instalando Vercel CLI...
  npm install -g vercel
)

echo.
echo Vincule a pasta ao projeto EXISTENTE para evitar duplicar projetos.
vercel link
if errorlevel 1 (
  echo ERRO ao vincular projeto.
  pause
  exit /b 1
)

vercel --prod

:END
echo.
echo Pronto.
pause

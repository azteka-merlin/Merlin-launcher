# Architecture - Merlin Launcher

Merlin Launcher e um app Electron para Windows. Ele concentra UI, integracao com Steam, chamadas para Merlin API, instalacao de manifestos/Lua, Premium, Corrections, Polls, Updates e o componente nativo OpenSteamTool.

## Camadas

### Electron Main

Arquivo principal: `main.js`.

Responsabilidades:

- Inicializar Electron.
- Montar servicos de dominio.
- Configurar paths de dados do app.
- Registrar IPC.
- Criar clientes HTTP.
- Conectar Auth, Games, Library, Corrections, Premium, Polls e Updates.

### Preload

Arquivo principal: `preload.js`.

Responsabilidades:

- Expor uma API controlada em `window.electronAPI`.
- Encapsular chamadas `ipcRenderer.invoke`.
- Expor listeners de progresso.
- Evitar acesso direto do renderer ao Node/Electron.

Quando adicionar IPC:

- Adicionar handler no main.
- Expor metodo no preload.
- Atualizar testes de contrato quando existirem.
- Ajustar renderer sem mudar nomes de canais existentes.

### Renderer

Arquivos principais:

- `renderer.js`: fluxo historico principal.
- `src/renderer/add-games/add-games.js`
- `src/renderer/auth/license-gate.js`
- `src/renderer/corrections/corrections.js`
- `src/renderer/library/library.js`
- `src/renderer/premium/premium.js`
- `src/renderer/shared/*`

Responsabilidades:

- UI e estado visual.
- Chamadas via `window.electronAPI`.
- Progresso, modais, traducao e feedback ao usuario.

### Services

`src/main/*` contem servicos por dominio:

- `auth`: sessao de licenca e token.
- `config`: config persistida.
- `games`: busca, fila, instalacao de manifestos/Lua e policy de manifest override.
- `library`: leitura/remocao da biblioteca local do Merlin.
- `steam`: deteccao, readiness, restart e leitura de bibliotecas Steam.
- `lumacore`: instalacao de DLLs no Steam.
- `corrections`: catalogo, votos, download e instalacao de fixes.
- `premium`: catalogo, ativacao, download, aplicacao e validacao.
- `polls`: polls autenticados.
- `updates`: update checker e download do instalador.
- `network`: download manager, API agent e archive client.
- `security`: machine identity/HWID.

## Fluxo De API Atual

Parte do launcher ja usa `MERLIN_API_BASE_URL`.

Atualmente confirmado:

- Auth: `${MERLIN_API_BASE_URL}/auth/login` e `${MERLIN_API_BASE_URL}/auth/reset-hwid`
- Game search: `${MERLIN_API_BASE_URL}/games/search`
- Manifests: `MERLIN_API_URL` ou `${MERLIN_API_BASE_URL}/manifests`
- Manifest status: `${manifestApiUrl}/status`

Ainda exige cuidado porque possui default proprio ou URL hardcoded:

- Updates: `https://api-merlin.com/api/updates/latest` e `/updates/download`
- Premium catalog: `https://api-merlin.com/api/premium/catalog`
- Polls: `https://api-merlin.com/api/polls/active`
- Corrections catalog: `https://api-merlin.com/api/fixes/catalog`

Antes de plugar staging, centralizar endpoints sem mudar producao por default.

## Build

`build.js`:

- Compila `OpenSteamTool`.
- Copia DLLs para `assets/dlls`.
- Ofusca arquivos do main process durante packaging.
- Restaura arquivos originais depois do build.
- Executa `electron-builder`.
- Gera `dist/integrity.json`.

DLLs esperadas:

- `OpenSteamTool.dll`
- `dwmapi.dll`
- `xinput1_4.dll`
- `merlin-helper.dll`

## Installer

`scripts/installer.nsh`:

- Exige admin no instalador per-machine.
- Fecha Merlin em update/install se necessario.
- Pode fechar Steam para copiar DLLs no Steam default.
- Copia DLLs para `C:\Program Files (x86)\Steam` quando encontrado.
- Se falhar, orienta usar Repair dentro do Merlin.

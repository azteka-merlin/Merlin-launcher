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
- `steam-plugin`: integracao opcional da loja Steam via CDP local; veja `features/steam-plugin.md`.
- `lumacore`: instalacao de DLLs no Steam.
- `corrections`: catalogo, votos, download e instalacao de fixes.
- `premium`: catalogo, ativacao, download, aplicacao e validacao.
- `polls`: polls autenticados.
- `updates`: update checker e download do instalador.
- `network`: download manager, API agent e archive client.
- `security`: machine identity/HWID.

## Fluxo De API Atual

`main.js` deriva de `MERLIN_API_BASE_URL` as URLs de Auth, busca, manifests, Corrections, Premium, Polls, Announcements, Home, novidades e Updates. O default continua `https://api-merlin.com/api`; `npm run start:stage` define a base de staging. `MERLIN_API_URL` continua sendo uma excecao que altera somente o endpoint de manifests.

Alguns clients mantem defaults de producao para uso isolado, mas `main.js` injeta neles as URLs derivadas da base. Ao adicionar um fluxo, preserve essa injecao para que staging nao consulte a API de producao por engano. O catalogo de metadados da Biblioteca vem do Ryuu, um provedor externo, e nao da API Merlin.

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

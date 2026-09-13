# Jogos e Steam

## Readiness e DLLs

- Steam valido: diretorio existente com `steam.exe` na raiz.
- Para instalar/ativar, tambem exige `OpenSteamTool.dll`, `dwmapi.dll`, `xinput1_4.dll` e `merlin-helper.dll` na raiz do Steam.
- Deteccao procura caminhos Windows comuns; usuario tambem pode escolher pasta.
- Repair/deteccao copia as DLLs empacotadas e pode pedir o fechamento da Steam. O legado `LumaCore.dll` e removido quando aplicavel.
- `steam_path_missing`, `steam_path_invalid` e `required_files_missing` devem direcionar para configurar/reparar, nunca iniciar instalacao.
- Restart fecha Steam, espera tres segundos e a abre novamente; exige readiness completo.

## Descoberta do jogo

- Entrada aceita link Steam/SteamDB suportado, App ID do catalogo ou sugestao selecionada.
- O catalogo fornece nome/capa quando possivel; fallback usa resolvedor de nome. Busca retorna ate quatro itens e vazio retorna lista vazia.
- Erros de entrada: `selection_required`, `catalog_not_found`, `resolve_failed`, `search_failed`.
- Webview e apenas para hosts Steam permitidos; popup e URL externa arbitraria sao bloqueados no main.

## Fila e auto-update

- Fila e em memoria, maximo 30, sem App ID duplicado.
- Durante instalacao, fila fica bloqueada (`queue_locked`). `installNow` falha com `install_busy` ou `queue_not_empty` quando aplicavel.
- `installAll` processa snapshot em sequencia: sucessos saem da fila; falhas ficam para tentativa posterior. Fila vazia retorna `empty_queue`.
- Toggle de auto-update inicia ligado. O endpoint autenticado `/manifests/status` devolve `requiresVersionPin`; ele e verdadeiro tanto para override por jogo quanto quando o Admin desabilita globalmente auto-update para novos jogos. Em ambos os casos o toggle fica desligado/bloqueado.
- A configuracao global do Admin so afeta jogos adicionados depois da mudanca; instalacoes existentes nao sao reescritas.
- O header `x-merlin-manifest-source: r2-override` tambem forca desligado na instalacao, mesmo que o status anterior estivesse em cache.
- Auto-update ligado comenta linhas ativas `setmanifestid(` no Lua; desligado preserva o arquivo.

## Instalacao

1. Validar App ID e readiness.
2. Buscar manifest autenticado em `/manifests`.
3. Se vier JSON `success: false`, tratar como resultado de negocio antes de validar ZIP.
4. Validar ZIP, extrair em temporario e copiar `.manifest` para `depotcache` e `.lua` para `config/stplug-in`.
5. Exigir ao menos um arquivo reconhecido copiado e invalidar Biblioteca.

Nao gravar arquivos em outros destinos. Temporarios devem ser limpos tambem em falha.

| Codigo | Mensagem/intencao |
| --- | --- |
| `manifest_unavailable` | jogo nao esta no catalogo; orientar suporte caso ja tenha sido lancado |
| `manifest_sources_unavailable` | arquivos nao puderam ser baixados; se ja lancado, orientar suporte |
| `rate_limited`, `test_limit_normal` | limite de licenca |
| `download_unavailable` | download indisponivel |
| `archive_invalid` | ZIP invalido/vazio/sem arquivos Steam |
| `generic` | erro nao classificado |

## IPC e eventos

Metodos: `games.resolveLink`, `games.search`, `games.listQueue`, `games.addToQueue`, `games.removeFromQueue`, `games.clearQueue`, `games.installNow`, `games.installAll`, `games.restartSteam`.

Eventos: `games:queue-updated`, `games:install-progress`, `games:install-complete`. O fluxo legado tambem expoe `downloadGame` e `download-progress`.

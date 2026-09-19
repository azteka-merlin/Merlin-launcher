# Business Rules - Merlin Launcher

Este arquivo registra regras de negocio observadas no launcher. Ele nao deve ser tratado como contrato final da API/admin ate os outros repos serem analisados.

## Licenca E Auth

- A chave deve seguir o formato `MERLIN-XXXX-XXXX-XXXX`.
- Letras ambiguas sao evitadas pelo regex atual.
- Login envia `licenseKey` e `hwid` para `/auth/login`.
- O reset de dispositivo usa `POST /auth/reset-hwid` somente depois de uma chave completa ser informada no portao. Ele desvincula o HWID anterior, apaga a sessao local e exige um novo login explicito para vincular o computador atual.
- Cada licenca possui uma cota de um reset por 30 dias. Quando indisponivel, a API devolve `retryAt`, que a interface apresenta em horario de Brasilia. O Admin pode liberar uma nova cota sem remover o HWID atual.
- Sessao local e criptografada com `safeStorage`.
- Token e renovado quando esta perto de expirar.
- Erros importantes mapeados:
  - `hwid_mismatch`
  - `expired`
  - `revoked`
  - `invalid_key`
  - `rate_limited`
  - `unavailable`
  - `server_error`
- Em erro definitivo de auth, cache local pode ser limpo.

## Steam Readiness

Para ativacao/instalacao estar pronta:

- `steamPath` precisa existir.
- Pasta precisa conter `steam.exe`.
- DLLs requeridas precisam estar no root do Steam:
  - `OpenSteamTool.dll`
  - `dwmapi.dll`
  - `xinput1_4.dll`
  - `merlin-helper.dll`

Codigos esperados:

- `steam_path_missing`
- `steam_path_invalid`
- `required_files_missing`

## Instalacao De Jogos

- App ID precisa ser numerico.
- So um download por App ID pode rodar ao mesmo tempo.
- Arquivo baixado precisa ser ZIP valido.
- Arquivos `.manifest` vao para `Steam\depotcache`.
- Arquivos `.lua` vao para `Steam\config\stplug-in`.
- Linhas ativas com `setmanifestid(` sao comentadas no Lua quando auto-update esta ativo conforme regra atual do transformer.
- Se a API indicar manifest override por header `x-merlin-manifest-source: r2-override`, o auto-update e forcado para `false`.
- Ao finalizar instalacao com sucesso, a Library e invalidada/atualizada.
- A consulta de manifest pode terminar com HTTP `200` e `success: false`. Isso representa um resultado de negocio, nao uma falha de transporte:
  - `manifest_unavailable`: todas as fontes confirmaram que o jogo nao esta disponivel. A UI orienta o usuario a confirmar se o jogo ja foi lancado e, se necessario, falar com o suporte.
  - `manifest_sources_unavailable`: pelo menos uma fonte falhou, expirou ou devolveu arquivo invalido. A UI informa que os arquivos nao puderam ser baixados e pede para contatar o suporte caso o jogo ja tenha sido lancado, sem prometer que uma nova tentativa resolvera o caso.
- O launcher deve ler esse JSON antes de validar o ZIP. Respostas de manifest bem-sucedidas continuam sendo ZIPs.

## Add Games E Fila

- Input pode ser URL Steam/SteamDB, App ID/catalog item ou item selecionado.
- URL e parseada para App ID.
- Nome pode vir do catalogo ou resolver remoto.
- `requiresVersionPin` desliga auto-update.
- A fila trava durante instalacao.
- `installNow` nao roda se houver fila pendente.
- `installAll` instala em sequencia e registra sucesso/falha por item.
- Restart Steam exige readiness antes de fechar/reabrir Steam.

## Library

- Usa o `steamPath` configurado.
- Le bibliotecas Steam via `libraryfolders.vdf`.
- Remove dados do Merlin com estrategia de staging/rollback antes de apagar.
- Preserva manifests compartilhados quando detecta referencias ainda usadas.
- Mudanca de `steamPath` invalida a library.

## Corrections

- Catalogo vem de `/fixes/catalog`.
- Quando logado, pode enviar token; se o catalogo falhar com 401, pode tentar sem token.
- Filtra entradas com badge `Hypervisor`.
- Usa apenas a primeira correction elegivel.
- Voto exige auth.
- Instalacao exige jogo ja instalado.
- Download e install usam uma operacao por vez.
- Suporta ZIP e RAR.
- Bloqueia path traversal em arquivos extraidos.
- Pode extrair ZIPs aninhados, com limite de 100 arquivos ZIP aninhados.
- Copia correction para a pasta do jogo instalado.

## Premium

- Catalogo exige auth.
- Se API falhar, pode usar cache local como stale.
- Uma operacao Premium por vez.
- Ativacao exige Steam configurado e jogo instalado.
- API reserva/ativa antes do download/aplicacao local.
- Tipos observados:
  - `steam_ticket`
  - `third_party`
- `steam_ticket` exige `configIni`.
- `third_party` exige `reservationId` e executavel de validacao.
- Archive e baixado, validado, extraido e aplicado no destino do jogo.
- `installSubpath` nao pode escapar da pasta do jogo.
- `launchExecutablePath` precisa ser relativo, terminar em `.exe` e ficar dentro da pasta do jogo.
- Falhas locais podem ser reportadas para a API como activation events.
- Cancelamento limpa temporarios.

## Updates

- Update compara versao atual com latest da API.
- Em dev, update pode ser simulado com `MERLIN_SIMULATE_UPDATE=1`.
- Download URL precisa ser permitido explicitamente.
- Atualmente URLs permitidas:
  - `https://api-merlin.com/api/updates/download`
  - GitHub releases em `/azteka-merlin/Merlin-launcher/releases/download/`
- Arquivo baixado precisa ser `.exe` para abrir como update.

## Compatibilidade E FAQ

Regras comunicadas na UI/FAQ:

- Merlin nao substitui Steam.
- Funciona melhor com jogos offline/single-player.
- Jogos online-only ou com autenticacao constante tendem a ter compatibilidade limitada.
- Premium ocupa slot por 24 horas.
- Atualizacoes de jogo, antivirus, BIOS, Windows, hardware ou driver podem quebrar ativacao.
- Usuario deve evitar atualizar jogo se ja esta funcionando.

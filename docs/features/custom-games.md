# Baixe e Jogue: integridade e atualizações

O catálogo de `/custom-games` usa o header `x-merlin-custom-games-protocol: 2`. Uma instalação mantém a chave imutável do pacote em `.merlin-install.json`. Quando a chave do catálogo muda, o cartão mostra **Atualizar jogo**. Versões nativas são publicadas manualmente; os campos `origin`, `versionLabel` e `protectedPaths` vêm do Admin/API.

Cada publicação contém o pacote completo do jogo; nos ports, inclui a pasta `game`. Novas instalações recebem esse pacote inteiro. Quem já instalou baixa somente os arquivos necessários, preservando a pasta `game` que já existe.

## Integridade

`customGames.verify(id)` / IPC `custom-games:verify` verifica os arquivos declarados com SHA-256 em streaming, tamanho e existência. O resultado distingue arquivos ausentes, alterados e sem acesso, sem modificar a instalação. Há progresso, cancelamento e uma amostra de até 100 caminhos problemáticos no contrato; a interface mostra até cinco caminhos com texto seguro e limitado.

Manifestos de integridade ficam em `userData/custom-games-integrity-<host>/<hash>.json`, separados por ambiente, jogo e chave exata. Uploads por pasta com hashes completos salvam o manifesto na instalação. Pacotes ZIP e pastas legadas podem buscar `/custom-games/:id/integrity?archiveKey=...`; o índice deve conter `{version:1,gameId,archiveKey,totalSizeBytes,files:[{path,sizeBytes,sha256,zip?}]}`. Um ZIP indexado também informa `zip.compressedSize` e `zip.method` (`0`, `8` ou `9`) por membro, na ordem do índice.

ZIPs Deflate64 (método `9`, usados por alguns pacotes criados no Windows) são aceitos na instalação inicial e nos downloads seletivos. O codec WASM `zlib-streams` 1.4.0 é carregado apenas quando necessário e usa um adaptador próprio com buffers de 64 KiB e uma saída por leitura, respeitando backpressure, cancelamento e os limites de tamanho/SHA/CRC já existentes. Streams truncados, corrompidos ou com dados extras são rejeitados. As licenças BSD, zlib e Chromium acompanham o app em `THIRD_PARTY_NOTICES.txt`.

A verificação reutiliza o índice instalado mesmo offline ou após publicar outra versão. Nunca cria hashes de referência a partir dos arquivos locais. Índice pendente/ausente e pacote indisponível mostram erro específico, sem declarar arquivos íntegros usando outro pacote.

Quando encontra problemas, o resultado oferece **Reparar arquivos**, por ação explícita (`customGames.repair(id)` / IPC `custom-games:repair`). O main guarda internamente todos os caminhos detectados e fixa a chave da instalação verificada. O reparo usa a mesma transferência segura, com hash forçado para arquivos danificados mesmo que tenham o tamanho correto; baixa apenas os arquivos necessários da versão instalada, preserva caminhos protegidos e extras, sem remover arquivos. O resultado informa arquivos restaurados e protegidos preservados. Não há reparo automático. Se a versão antiga já foi eliminada do armazenamento, a interface orienta usar **Atualizar jogo**.

## Atualização por arquivo

`customGames.update(id)` / IPC `custom-games:update` compara o manifesto instalado com o novo, sem calcular novamente hashes de todos os arquivos. Arquivos com hash e tamanho iguais são reaproveitados se existem com o tamanho correto. Arquivos novos, alterados ou ausentes entram no download. A opção **Verificar integridade** cobre corrupção local que mantém o mesmo tamanho.

- Em pacotes por pasta, baixa somente arquivos diretos necessários e bundles ZIP que contêm algum arquivo necessário. O hash de referência de pastas legadas pode vir do índice separado, mesmo se o manifesto de transporte não tiver hashes.
- Em ZIPs indexados, baixa somente o payload comprimido dos membros necessários usando `/custom-games/:id/entries/:fileIndex`, com ranges relativos ao payload. Arquivos stored são copiados, deflate é descomprimido em streaming, e o SHA-256 final é conferido. ZIPs sem índice ainda podem ser instalados pelo fluxo anterior; a atualização aguarda a indexação.
- Remove somente arquivos declarados no manifesto instalado que desapareceram na nova versão. Sem índice anterior confiável, não infere remoções.
- Preserva arquivos extras. `protectedPaths` é respeitado; `game` é sempre protegido para ports. Configurações existentes `.ini`, `.cfg`, `.sav`, `settings.json` e arquivos dentro de pastas `save`, `saves`, `savegames`, `savedata`, `user` e `userdata` também são preservados. Arquivos novos ainda ausentes nesses caminhos podem ser instalados.

Todo download termina e valida antes de alterar a instalação. Substituições e remoções têm backup e journal de operações em formato append-only, com custo linear, para rollback em erro/cancelamento e recuperação após interrupção. A chave instalada só muda ao concluir. Antes de atualizar e aplicar, o launcher verifica processos executáveis dentro da instalação; o botão Jogar daquele jogo fica bloqueado durante a atualização. A atualização suporta transições de arquivos para pastas e de pastas para arquivos; conteúdo local desconhecido que conflita com a nova estrutura bloqueia a troca e é preservado.

Cancelar ou fechar durante atualização/reparo conserva ou restaura a versão instalada. O staging dessa operação é limpo; a próxima tentativa baixa novamente somente o conjunto de arquivos necessário. O checkpoint de ranges permanece disponível no fluxo de instalação inicial, descrito abaixo.

## Sessões e versões durante downloads

Instalações e atualizações abrem `POST /custom-games/:id/download-session` com `{archiveKey}`. O retorno inclui `leaseId`, a chave fixada e o snapshot do pacote (`packageType`, `archiveSize`, `executablePath`, `versionLabel`, `origin`, `protectedPaths`). Todas as transferências enviam `archiveKey` e `downloadSessionId` como query e o header de protocolo. O heartbeat autenticado renova a sessão a cada 60 segundos; `complete` ou `cancel` encerra a sessão.

O estado de download guarda a chave e o snapshot do pacote. Após reiniciar o launcher, ZIPs preservam ranges concluídos e pastas reaproveitam arquivos já validados da versão retida, mesmo que o Admin tenha publicado uma versão nova. Novas publicações não mudam a fonte no meio de uma transferência.

A instalação existente continua em um utility process descartável. O mesmo runner executa atualizações com `mode: update` e reparos com `mode: repair`; tokens são obtidos pelo main via mensagens e não entram em argumentos de processo. O progresso compartilha `custom-games:progress`, distinguindo `kind: integrity`, `kind: update` e `kind: repair` dos downloads iniciais.

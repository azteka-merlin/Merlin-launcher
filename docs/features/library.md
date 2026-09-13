# Biblioteca Gerenciada

## Fonte e listagem

- A Biblioteca representa arquivos `Steam/config/stplug-in/<appid>.lua`, nao todos os jogos instalados na Steam.
- Le `libraryfolders.vdf` para localizar bibliotecas Steam e catalogos/caches para nome e capa.
- Falha em metadados remotos nao deve ocultar App IDs locais. Atualizacao forcada tenta enriquecer novamente.
- Busca, pagina e estados vazios sao responsabilidade visual do renderer sobre os itens retornados.

## Abrir pasta

- Valida App ID e procura `appmanifest_<appid>.acf` em cada biblioteca Steam.
- So abre pasta validada de jogo instalado. Erros: `invalid_app_id`, readiness Steam, `game_not_installed`, `open_folder_failed`.

## Remover da gestao Merlin

- Nao desinstala jogo Steam e nao apaga arquivos do jogo.
- Remove o Lua do App ID e manifests referenciados por ele em `depotcache`.
- Se outro Lua referencia o mesmo manifest, ele e preservado.
- Se a varredura dos outros Luas falhar, todos os manifests sao preservados por seguranca.
- Usa rename para staging e rollback antes de apagar, evitando remocao parcial.

Erros: `invalid_app_id`, readiness Steam, `not_found`, `remove_failed`; restart pode retornar `restart_failed`.

## Estado e IPC

- Cache em memoria e invalidado depois de instalar jogo, reparar DLLs ou mudar `steamPath`.
- `library:list` usa cache; `library:refresh` forca leitura/metadata e envia `library:updated` em sucesso.
- `library:remove` tambem envia a lista atualizada em sucesso e `library:operation-progress` ao iniciar/finalizar refresh/remocao.
- Metodos: `library.list`, `library.refresh`, `library.remove`, `library.openGameFolder`, `library.restartSteam`.

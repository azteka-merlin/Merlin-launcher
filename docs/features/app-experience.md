# Experiencia Geral, Avisos e Update

## Navegacao e idioma

- Areas principais: Adicionar jogo, Biblioteca, Corrections e Premium.
- O menu nativo oferece Tutorial e FAQ e muda junto com o idioma.
- Ao desmontar/trocar tela, remover listeners de progresso para evitar duplicidade de renderizacao.

## Polls e anuncios

- Polls sao autenticados, podem ter contribuicao opcional e atualizam cache apos voto. Codigos: `auth_required`, `polls_failed`, `invalid_poll`, `already_voted`, `vote_failed`.
- Anuncios autenticados: buscar elegivel, registrar visualizacao e dismiss. Em falha pode manter o ultimo anuncio em cache. Codigos: `auth_required`, `announcements_failed`, `invalid_announcement`, `view_failed`, `dismiss_failed`.
- Tutorial, Discord e disclaimer de Corrections usam flags locais para evitar repeticao; isso nao e controle de permissao.

## Status de servico

- O launcher consulta a saude do Ryuu a cada dois minutos, com timeout de cinco segundos. O servico e saudavel somente quando retorna `status: ok` e `downloads_available: true`.
- Uma falha mostra badge/modal de instabilidade sem bloquear as telas. O estado tambem agrega falhas de busca de jogos, Biblioteca, Corrections e catalogo Premium.
- Cada fonte de problema e removida quando volta a responder; o modal fecha somente quando nao restam problemas. O novo front deve preservar esse comportamento agregado, e nao usar a badge como erro definitivo de uma operacao.

## Updates

- Compara versoes numericas, ignorando prefixo `v` e sufixo pre-release. So oferece update quando a versao remota e maior.
- Dev pode simular update com `MERLIN_SIMULATE_UPDATE=1`, mas apenas em URL permitida.
- Download so aceita HTTPS no endpoint `/updates/download` configurado ou release GitHub autorizado. Arquivo aberto deve terminar em `.exe`.
- Usa `operationId`, progresso, cancelamento e salva em Downloads.
- Erros: `invalid_download_url`, `invalid_file`, `invalid_folder`, `open_failed` e falhas do download manager.

## Links externos

Discord, WhatsApp, Instagram, signup, planos e download de update sao validados no main. O renderer nunca deve abrir URL arbitraria de entrada/API.

Eventos: `app:update-download-progress`, `tutorial:open`, `faq:open` e `auth:required`.

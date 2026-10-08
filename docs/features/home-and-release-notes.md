# Home e novidades

Home e changelog sao conteudo autenticado servido pela API. O launcher usa apenas IPCs `home:*` e `release-notes:*`; o renderer nao chama a rede diretamente.

## Home

- Quando a atualizacao falha, a Home pode exibir o ultimo conteudo salvo com um aviso e opcao de tentar novamente.
- Depois que o login termina, a Home tenta atualizar novamente se estava exibindo cache/erro. Se o login termina durante a primeira carga, a tentativa ocorre logo apos ela; uma carga saudavel nao e repetida.

## Novidades

- A primeira busca espera o idioma persistido carregar.
- A modal abre so para a release publicada cuja versao corresponde ao launcher e ainda nao foi vista.
- Fechar, Escape ou CTA registra `lastSeenChangelogVersion`.
- O item **Minha conta > Novidades** e a bolinha roxa so aparecem apos resposta remota valida com releases. Cache stale e falha de rede permanecem silenciosos e ocultam o item.
- Atualiza no login, na navegacao (respeitando intervalo minimo) e na troca de idioma.

As rotas e a publicacao sao documentadas na API; o painel controla textos, ordem, tipo e arte.

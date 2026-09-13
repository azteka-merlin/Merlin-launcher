# Efeitos do Admin no Launcher

Inventario cruzado do painel Admin, pagina publica e API. Esta pagina nao documenta a UI administrativa; registra somente o que muda permissao, conteudo ou experiencia do launcher.

## Efeito direto

| Area do Admin | Alteracao | Efeito no launcher |
| --- | --- | --- |
| Licencas | criar, editar, renovar, revogar, reativar | proximo login/refresh passa a aceitar, expirar ou negar a sessao conforme status e vencimento |
| Licencas | resetar HWID | permite novo vinculo de maquina no proximo login; nao altera a chave |
| Licencas de teste | editar limites normal/Premium e resetar uso | altera imediatamente as cotas que `/manifests` e `/premium/activate` aplicam |
| Overrides | criar/alterar/excluir manifest ou Lua por App ID | manifest pode vir do R2 override; auto-update e forcado desligado e o arquivo entregue muda |
| Premium | cadastrar/editar/habilitar/remover jogo, archive, tipo e caminhos | muda os itens, botoes e o fluxo de ativacao disponivel no catalogo Premium |
| Premium | slots, cooldown do plano, cooldown personalizado por jogo, janela por tier e arquivo disponivel | API muda `availability` e `viewer`; launcher deve distinguir o cooldown individual configurado para o jogo da vaga global de 24 h para outras pessoas |
| Premium | conceder/remover acesso antecipado por jogo+licenca | libera/bloqueia somente futuras ativacoes daquela pessoa, preservando demais regras |
| Polls | criar, editar, abrir, fechar, excluir | muda badge/modal e opcoes que o launcher carrega para a pessoa autenticada |
| Announcements | criar, editar, publicar/ocultar, excluir | muda o anuncio elegivel mostrado no launcher e os registros de view/dismiss |
| Settings | politica global de auto-update | `/manifests/status` devolve version pin para novos jogos; toggle fica desligado/bloqueado |
| Settings | fonte primaria Depotbox/Ryuu | muda a prioridade de busca de manifest no backend; launcher continua usando a mesma rota |
| Settings | publicar update do Merlin | `/updates/latest` passa a oferecer nova versao e o launcher exibe/download o instalador permitido |

## Licencas, planos e pagina publica

Estas configuracoes nao sao chamadas pelo launcher diretamente, mas definem a licenca que ele recebe e, por isso, sao contrato indireto:

- Cadastro publico cria licenca gratuita; novos cadastros ficam Bronze com `premiumCatalogRestricted` marcado.
- Configuracao de tiers, preco, checkout, Pix, renovacao, cancelamento e sincronizacao Stripe altera tier, billing, vencimento e tipo de acesso da mesma licenca. O launcher obtem isso no login e no catalogo Premium.
- A data global de corte do catalogo Premium determina se uma licenca gratuita ve jogos futuros travados (`free_catalog_cutoff`) ou segue liberacoes normais. Converter para assinatura paga remove a restricao.
- Licenca gratuita antiga sem restricao continua recebendo novos Premium pela regra normal de tier. Nao existe classificacao automatica retroativa; qualquer mudanca e administrativa.
- Alteracao de plano, sincronizacao de pagamento, reembolso/disputa e revogacao podem refletir em login, billing, catalogo e ativacao; o front nao deve guardar permissao local como fonte de verdade.

## Operacional, sem alterar a funcionalidade do launcher

| Area | Motivo |
| --- | --- |
| Overview, Activity e Audit | apenas visualizam metricas e logs, inclusive os eventos enviados pelo launcher |
| Pagamentos (quando so consulta) | observabilidade; apenas sincronizacoes que alterem a licenca tem efeito indireto |
| Seguranca de administradores/IPs | protege o painel, nao e controle de acesso do launcher |
| Feedbacks publicos e Partners | alimentam a pagina publica, sem consumo pelo launcher |

## Invariantes para a troca de front

- Nao duplicar no cliente nenhuma decisao de Admin/API: status de licenca, tier, restricao gratuita, cooldown, slot, release, teste e override sao avaliados no servidor.
- Recarregar catalogo ou usar a proxima chamada autenticada depois de uma alteracao administrativa; cache stale nunca deve conceder ativacao.
- Preservar os campos de UI retornados pela API Premium: `viewer.status`, `canActivate`, `lockedReason`, `releaseAvailableAt`, `nearestAvailableTier`, `tierAvailability`, cooldown/reserva e slots.
- Tratar update, auto-update, polls e anuncios como dados remotos dinamicos; nao congelar esses valores no bundle do novo front.

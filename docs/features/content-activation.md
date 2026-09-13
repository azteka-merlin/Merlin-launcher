# Corrections e Premium

## Corrections

- Catalogo de `/fixes/catalog`; tenta token quando disponivel e usa cache local stale se refresh falhar.
- Itens com badge `Hypervisor` sao filtrados. Quando ha mais de um fix, apenas o primeiro elegivel vale.
- Votos aceitam apenas `up`/`down`, exigem auth e atualizam placar em cache. Voto duplicado vira `already_voted`.
- Exige Steam pronto e jogo instalado; o renderer nao escolhe pasta de destino.
- Uma operacao global por vez, com `operationId` obrigatorio e cancelavel.
- Aceita ZIP/RAR, bloqueia path traversal e ZIP aninhado acima de 100. Conteudo e copiado apenas para a pasta do jogo.
- Disclaimer comunitario e mostrado uma vez; notas administrativas/instrucoes fazem parte da jornada.
- Limpa temporarios no fim/cancelamento.

Erros relevantes: `invalid_operation`, `busy`, `not_found`, `auth_required`, `vote_failed`, `refresh_failed`, readiness Steam, `game_not_installed`, `cancelled`, `invalid_path`, `archive_invalid`, `apply_failed`, `open_failed`.

IPC: `corrections.list`, `refresh`, `prepareInstall`, `vote`, `download`, `install`, `cancel`, `openFolder`. Evento: `corrections:progress` com jogo, arquivo, operacao, estagio e percentual.

## Premium

- Catalogo autenticado; cache local stale permanece utilizavel se a API falhar.
- Tier efetivo, janela de disponibilidade, cooldown, slots, limite mensal Bronze, restricao de catalogo futuro para acesso gratuito e acesso antecipado individual sao calculados e impostos pela API tanto no catalogo quanto na ativacao. O launcher apenas apresenta o resultado; nunca tenta contornar bloqueio com download direto.
- Acesso antecipado individual nao altera tier nem torna jogo oculto publico; ainda respeita arquivo de ativacao, slot, cooldown e limite da licenca.

### Regras de planos, liberacao e cooldown

| Plano | Liberacao de novo jogo Premium | Cooldown do plano da pessoa | Limite Premium |
| --- | --- | --- | --- |
| Bronze | 7 dias apos o cadastro do jogo | global de 24 h | 3 ativacoes por ciclo mensal da licenca |
| Prata | 5 dias apos o cadastro do jogo | global de 24 h | sem limite mensal |
| Ouro | 48 h apos o cadastro do jogo | por jogo, 24 h | sem limite mensal |

- Cooldown global (Bronze/Prata) bloqueia a pessoa de ativar qualquer Premium durante a janela; nao deve ser mostrado como slot ocupado de um jogo especifico.
- Cooldown por jogo (Ouro) bloqueia apenas nova ativacao daquele titulo. A UI recebe `cooldownEntries` por jogo, `cooldownUntil`/`reservedUntil` do viewer e disponibilidade de slots separadamente.
- Cada jogo Premium tambem pode ter um **cooldown de ativacao personalizado**, configurado no Admin em dias inteiros (minimo um; vazio = 24 h). Depois que uma pessoa ativa esse jogo, ela nao pode ativa-lo novamente ate `activatedAt + activationCooldownHours`, independentemente do seu tier. Exemplo: jogo configurado com 7 dias: quem ativou fica impedido por 7 dias.
- Esse cooldown personalizado e individual e **nao estende a vaga global**. Para os demais usuarios, uma ativacao ativa ocupa uma vaga do jogo somente por 24 h; reservas/processamentos tambem a ocupam apenas ate seu timeout. Assim, um jogo pode ter vaga novamente para outra pessoa em 24 h, enquanto o usuario que o ativou continua em cooldown de 7 dias.
- O novo front deve apresentar separadamente o cooldown individual do viewer e a proxima vaga global do jogo; nunca inferir que ambos terminam na mesma data.
- `tierAvailability` informa ao front quando cada tier podera ativar. `lockedReason` pode ser `tier_release_pending`, `tier_disabled`, `bronze_limit` ou `free_catalog_cutoff`; o front deve exibir o motivo/CTA, sem fabricar datas.

### Pessoas gratuitas e catalogo futuro

- A data global `premium_catalog_cutoff_at`, configurada no Admin, separa os jogos Premium futuros.
- Licenca gratuita com `premiumCatalogRestricted = true` continua vendo esses jogos, mas fica travada para ativar os criados depois do corte (`free_catalog_cutoff`). A API informa o menor tier que ja pode liberar o titulo para o launcher orientar upgrade.
- Licenca gratuita com `premiumCatalogRestricted = false` continua recebendo jogos conforme a regra normal do seu tier efetivo; ela nao sofre a trava do corte.
- Novos cadastros gratuitos nascem em Bronze com a restricao marcada. Ao comprar Bronze, Prata ou Ouro, a mesma licenca vira paga e a restricao e removida. Licencas gratuitas antigas so mudam de classificacao por acao administrativa aprovada.
- Uma operacao Premium global por vez; `operationId` e cancelavel.
- Ativacao exige Steam pronto e jogo instalado, reserva/ativa na API antes de baixar e reporta falhas locais apos reserva quando aplicavel.
- Archive e validado e extraido antes de aplicar dentro da pasta do jogo.
- `installSubpath` nao pode escapar da pasta do jogo.
- `steam_ticket` exige `configIni`.
- `third_party` exige `reservationId` e executavel relativo `.exe` dentro do jogo; aguarda token, confirma autorizacao e grava token local.

Codigos remotos: `auth_required`, `not_found`, `cooldown`, `no_slots`, `archive_unavailable`, `processing`, `plan_locked`, `test_limit_premium`, `activate_failed`. Codigos locais incluem readiness Steam, `game_not_installed`, `busy`, `cancelled`, `download_failed`, `apply_failed`, `open_failed`.

IPC: `premium.list`, `refresh`, `activate`, `cancel`, `openGameFolder`. Evento: `premium:progress`; preservar estagios de reserva, download, validacao, extracao, escrita de config/token, aplicacao, validacao de terceiros, limpeza e conclusao.

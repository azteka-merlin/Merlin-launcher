# Contrato para o Novo Front-end

## Limites de arquitetura

- Manter main, preload, servicos e contratos IPC na primeira fase. A troca inicial deve ser somente do renderer.
- Todo acesso ao sistema vem de `window.electronAPI`; Node integration permanece desligado e context isolation ligado.
- Preferir um adaptador unico no novo front para normalizar retornos `{ success, code, message }` e eventos, em vez de IPC espalhado por componentes.

## API exposta pelo preload

| Grupo | Metodos |
| --- | --- |
| Config/app | `getConfig`, `saveConfig`, `setMenuLanguage`, `getVersion`, update e links sociais |
| Auth | `hasSession`, `status`, `login`, `logout`, assinatura, signup, planos |
| Steam | detectar/selecionar, status, fechar/iniciar, readiness e repair |
| Games | resolver/buscar, fila, instalar e restart |
| Library | listar, refresh, remover, abrir pasta e restart |
| Corrections/Premium | catalogos, acoes, cancelamento e abrir pasta |
| Polls/announcements | carregar, votar, registrar visualizacao e dismiss |

Os nomes completos estao em `preload.js`; ao altera-los, atualize testes `*-ipc-contract.test.js`.

## Estados transversais obrigatorios

1. Inicializando/sessao valida/sessao exigida.
2. Steam ausente, caminho invalido, DLLs ausentes e pronto.
3. Carregando, vazio, dados stale, sucesso, erro conhecido e erro generico para cada catalogo.
4. Operacao ativa, progresso, cancelamento e limpeza para jogos, Corrections, Premium e update.
5. Fila bloqueada e botoes concorrentes desabilitados.

## Compatibilidade com staging

- `npm run start:stage` deve operar o novo front completo contra `MERLIN_API_BASE_URL=https://staging.api-merlin.com/api`; producao continua sendo o default de `npm start`.
- Auth, busca, manifest/status, Corrections, Premium, Polls, Announcements, updates e o catalogo da Biblioteca devem receber a base por configuracao. Nenhum client novo pode criar URL de producao hardcoded.
- O catalogo de metadados da Biblioteca atual ainda tem default proprio de producao; a migracao deve injetar a base de staging nele antes de declarar paridade.
- O health do Ryuu e uma integracao externa fixa hoje. Em staging ele deve ser identificado como health de provedor, nao como health da API staging; nao pode levar o usuario a concluir que staging esta indisponivel.
- Catalogos/cache no renderer devem ser identificados pela base da API, ou invalidados ao trocar prod/staging. Dados stale de um ambiente jamais podem aparecer como dados do outro.
- Criterio de aceite: executar login, busca, manifest, Biblioteca, Corrections, Premium, Polls, Announcements e update em staging sem trafego funcional para producao.

## Roteiro de migracao

1. Criar shell de UI e i18n sem mexer em IPC.
2. Migrar Auth e configuracao Steam.
3. Migrar Jogos/fila, depois Biblioteca.
4. Migrar Corrections e Premium com seus progressos/cancelamentos.
5. Migrar modais, polls, anuncios e update.
6. Comparar cada area nos estados normal, vazio, stale, erro, cancelamento e bloqueio.

## Checklist de nao regressao

- [ ] Portao de licenca e refresh seguro continuam bloqueando acesso indevido.
- [ ] Readiness Steam e repair continuam antes de qualquer escrita.
- [ ] Auto-update, policy global do Admin, version pin e `r2-override` preservam a policy Lua.
- [ ] Fila limita 30 e instala em sequencia sem perder falhas.
- [ ] JSON de negocio de manifests nao e tratado como ZIP.
- [ ] Biblioteca preserva manifests compartilhados e nunca desinstala jogo Steam.
- [ ] Corrections/Premium mantem validacao de paths, uma operacao por vez e limpeza.
- [ ] Caches stale continuam renderizaveis.
- [ ] Tier/early access/restricoes Premium recebidos da API continuam apenas apresentados, nunca contornados pelo cliente.
- [ ] Limites separados de licenca de teste, ciclos e mensagens `test_limit_normal`/`test_limit_premium` continuam distintos.
- [ ] Cooldown global Bronze/Prata, cooldown por jogo Ouro, slots e janelas de liberacao por tier continuam visualmente distintos.
- [ ] Gratuitos restritos no corte e gratuitos legados sem restricao recebem a experiencia devolvida pela API, sem liberar jogos no cliente.
- [ ] Badge de status de servico continua agregando saude Ryuu e falhas de catalogo sem bloquear o aplicativo.
- [ ] Allowlists de update/links externos continuam no main.
- [ ] Listeners sao removidos no unmount e `npm test` passa.

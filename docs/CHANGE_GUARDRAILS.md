# Change Guardrails - Merlin

Este arquivo existe para evitar regressao enquanto configuramos ambientes de API, cadastro publico e painel admin.

## Regra Principal

Nao alterar comportamento atual sem aprovacao previa.

Isso inclui:

- Fluxo de login/licenca.
- Endpoints de producao.
- Regras de ativacao Premium.
- Instalacao de manifestos e arquivos Lua.
- Instalacao das DLLs no Steam.
- Fluxo de Corrections/fixes.
- Atualizacao do launcher.
- IPC entre renderer, preload e main.
- Build, installer e empacotamento.

Documentacao e diagnosticos podem ser criados quando forem explicitamente pedidos. Alteracoes funcionais em codigo, deploy, env, banco ou API precisam ser explicadas antes e aprovadas.

## Antes De Mudar Codigo

Checklist obrigatorio:

- Identificar qual comportamento atual sera afetado.
- Conferir se ja existe teste cobrindo o contrato.
- Conferir se renderer, preload e main continuam alinhados quando houver IPC.
- Conferir se a mudanca afeta producao por default.
- Separar staging/local de producao de forma explicita.
- Perguntar antes quando houver duvida de regra de negocio.

## Ambientes

Producao deve continuar sendo o comportamento padrao ate aprovarmos uma migracao explicita.

Staging deve ser opt-in, por comando ou variavel de ambiente, por exemplo:

- `npm run start:stage`
- `MERLIN_API_BASE_URL=https://staging.api-merlin.com/api`

Local pode existir para UI e desenvolvimento rapido, mas nao deve ser assumido como valido para ativacao real.

## Deploy

Scripts atuais da API: `deploy` e `deploy-stage` publicam o Worker com o dist Admin existente; `deploy:panel` e `deploy-stage:panel` compilam o Admin irmao antes de publicar. O site Public tem build e deploy proprios no repositorio `Merlin-public`. Nenhum desses scripts pertence ao Launcher. Consulte `ENVIRONMENTS.md` antes de uma atualizacao.

## Protecoes Importantes

- O projeto e open source: nao vazar credenciais, tokens, secrets, emails privados, paths pessoais, dumps reais ou dados de cliente em codigo, docs, logs ou exemplos.
- Nao remover validacoes de path que impedem escrita fora do destino esperado.
- Nao relaxar regras de URL de update sem discutir seguranca.
- Nao trocar endpoints hardcoded para staging/prod de forma silenciosa.
- Nao alterar formato de payload da API sem coordenar API, admin e launcher.
- Nao mexer em arquivos do Steam sem preservar os checks atuais.
- Nao commitar `node_modules`, `dist`, `.deps` ou `package-lock.json` neste projeto.

## Regressao Do Instalador NSIS

- O Electron Builder carrega includes customizados antes de registrar os plugins.
  Funcoes que chamam nsProcess devem ser emitidas no hook `customHeader`, depois
  desse registro. Nao mover a funcao para o corpo imediato do include.
- Ao alterar instalacao, fechamento da Steam, includes ou plugins NSIS, executar
  `npm run test:installer` no Windows depois do build. Essa validacao exige o
  compilador e plugin reais; teste ignorado nao aprova a entrega.
- Preservar a validacao obrigatoria depois do build e antes da tag/release no
  workflow. Nao substituir compilacao real por mocks de consulta de processos.
- Historico, causa e cenarios: `docs/INSTALLER_STEAM_SHUTDOWN_2026-11-03.md`.

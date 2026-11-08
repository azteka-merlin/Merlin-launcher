# Ambientes - Ecossistema Merlin

Staging e producao ja estao em uso. Consulte os scripts e as configuracoes atuais de cada repositorio antes de publicar; este documento registra somente a divisao entre projetos.

## Objetivo

Permitir testar API, cadastro publico, painel admin e launcher sem publicar alteracoes em producao.

## Projetos

- Merlin Launcher: este repositorio Electron.
- Merlin API: Worker com regras e rotas publicas e administrativas; serve os assets compilados do Admin.
- Merlin Admin: painel React em repositorio irmao, publicado junto com a API.
- Merlin Public: site de compra e Meu acesso em Worker separado, com build e deploy proprios.

## Ambientes em uso

### Production

Ambiente real.

- API: `https://api-merlin.com/api`
- Public: site/Worker separado, com chamadas relativas para as rotas da API.
- Painel admin: assets servidos pelo Worker da API.
- Banco, storage, secrets e email reais.

### Staging

Ambiente de teste real com HTTPS.

Configuracao atual:

- API: `https://staging.api-merlin.com/api`
- Public: Worker de staging separado, apontando para as rotas da API de staging.
- Painel admin: assets servidos pelo Worker da API de staging.

Staging utiliza:

- Banco separado.
- Secrets podem ser iguais se o dono aceitar esse comportamento.
- R2 pode ser compartilhado com producao para fixes, manifests e arquivos premium.
- Admins de teste.
- Licencas de teste.
- Pagamentos/webhooks em sandbox quando existir.
- Email pode usar o mesmo provedor, mas idealmente com credenciais/remetente ou modo sandbox separado.

Nao duplicar R2 apenas por staging quando os arquivos sao artefatos compartilhados. Possivel excecao futura: usar um caminho separado para updates, como `_updates-staging/`, caso seja necessario testar a modal de nova versao sem tocar no metadata de producao.

### Local

Ambiente para desenvolvimento rapido.

Uso recomendado:

- UI.
- Fluxos sem ativacao real.
- Mocks.
- Validacoes e estados de erro.

Nao assumir local HTTP como suficiente para ativacao real. Para ativacao/download real, usar staging HTTPS.

## Launcher

Comandos:

- `npm start`: comportamento atual.
- `npm run start:stage`: abre Electron apontando para staging com Merlin Status V1.
- `npm start` e builds publicados usam Merlin Status V1 na API de producao; `MERLIN_STATUS_V1=0` desativa o monitor novo localmente.
- `npm run start:prod`: abre Electron apontando explicitamente para producao.

Variavel principal:

- `MERLIN_API_BASE_URL=https://staging.api-merlin.com/api`

O launcher centraliza os endpoints derivados de API base para `start:stage`.

Comportamento de cache:

- Build instalado e dev usam pastas Electron diferentes.
- `npm start` e `npm run start:stage` sao ambos modo dev e podem compartilhar cache local.
- Depois de alternar entre prod e staging no dev, atualize os catalogos na UI para evitar itens antigos.

Endpoints que devem seguir a base:

- `/auth/login`
- `/games/search`
- `/manifests`
- `/manifests/status`
- `/fixes/catalog`
- `/fixes/vote`
- `/fixes/license-token` (somente para a correcao especial compativel)
- `/premium/catalog`
- `/premium/activate`
- `/premium/activate-third-party`
- `/premium/activation-events`
- `/polls/active`
- `/polls/:id/vote`
- `/updates/latest`
- `/updates/download`

## API, Admin e Public

As rotas de cadastro, licencas e pagamento pertencem a API. A experiencia visual de compra e Meu acesso pertence ao Public, publicado em Worker separado.

- Na API, `npm run deploy` e `npm run deploy-stage` publicam o Worker com os assets Admin ja presentes em `../merlin-admin/dist`.
- Na API, `npm run deploy:panel` e `npm run deploy-stage:panel` primeiro compilam o Admin irmao e depois publicam o Worker correspondente. Nao executam migrations D1.
- No Public, `npm run build` gera `dist/`; depois `npm run deploy` ou `npm run deploy-stage` publica o Worker Public. O deploy nao gera o build automaticamente.

Overrides nao sao migrados: eles ficam no R2 compartilhado (`MERLIN_FILES` / `overrides.json`) e stage/prod leem a mesma configuracao atual.

As variaveis podem ter os mesmos nomes entre ambientes, mas valores sensiveis nunca devem entrar em codigo/docs. Para os nomes reais e bindings, consulte `Merlin-api/docs/ENVIRONMENT.md`, `Merlin-api/wrangler.jsonc` local e `Merlin-public/wrangler.jsonc`.

## Painel Admin

O painel admin nao e deployado sozinho nesse setup. Ele e buildado pelo Vite e servido como assets pelo Worker da API.

Use no repo da API:

- `npm run deploy:panel`
- `npm run deploy-stage:panel`

O frontend usa rotas relativas `/panel-api/*`; nao precisa hardcodar base URL de producao/staging no admin.

## Conferencia antes de uma atualizacao

1. Comparar o estado local e os assets realmente servidos de API/Admin e Public em cada ambiente.
2. Conferir bindings, secrets por nome e migrations pendentes sem copiar valores para o Git.
3. Validar o fluxo Public -> API -> Launcher em staging, preservando a base de producao como default do Launcher.

## Regra De Seguranca

Nao usar banco de producao em staging. Nao testar cadastro/admin real em producao. Secrets podem ser compartilhados quando aprovado, mas valores reais nunca entram em codigo/docs.

Como o projeto e open source, nunca registrar valores reais em codigo/docs:

- credenciais, tokens, secrets ou API keys;
- emails privados ou dados de cliente;
- paths pessoais de maquina;
- URLs privadas de storage, banco ou painel interno;
- dumps de payload com dados reais.

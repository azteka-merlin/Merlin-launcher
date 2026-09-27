# Environments Plan - Merlin Ecosystem

Este plano ainda e conceitual. Ele deve ser implementado somente depois de analisar os repos da API e do painel admin.

## Objetivo

Permitir testar API, cadastro publico, painel admin e launcher sem publicar alteracoes em producao.

## Projetos

Confirmado neste repo:

- Merlin Launcher: este repositorio.

Ainda pendente de analise:

- Merlin API, que tambem contem o cadastro publico.
- Merlin Admin/Panel.

## Ambientes Recomendados

### Production

Ambiente real.

- API: `https://api-merlin.com/api`
- Cadastro publico: dominio publico real.
- Painel admin: dominio real do admin.
- Banco, storage, secrets e email reais.

### Staging

Ambiente de teste real com HTTPS.

Sugestao:

- API: `https://staging.api-merlin.com/api`
- Cadastro publico: staging do cadastro, servido pelo projeto da API.
- Painel admin: staging do admin.

Staging deve ter:

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
- `npm run start:stage`: abre Electron apontando para staging.
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

## API E Cadastro Publico

Como o cadastro publico esta na API, os scripts ficam no repo da API:

- `npm run deploy`: API + cadastro publico em producao.
- `npm run deploy-stage`: API + cadastro publico em staging.
- `npm run deploy:panel`: build do painel + deploy de producao pelo Worker da API.
- `npm run deploy-stage:panel`: build do painel + deploy de staging pelo Worker da API.

Overrides nao sao migrados: eles ficam no R2 compartilhado (`MERLIN_FILES` / `overrides.json`) e stage/prod leem a mesma configuracao atual.

As variaveis podem ter os mesmos nomes entre ambientes, mas valores sensiveis nunca devem entrar em codigo/docs.

Exemplos de nomes, sem valores reais:

- `DATABASE_URL`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `STORAGE_BUCKET`
- `PAYMENT_SECRET_KEY`
- `WEBHOOK_SECRET`
- `PUBLIC_BASE_URL`
- `API_BASE_URL`

## Painel Admin

O painel admin nao e deployado sozinho nesse setup. Ele e buildado pelo Vite e servido como assets pelo Worker da API.

Use no repo da API:

- `npm run deploy:panel`
- `npm run deploy-stage:panel`

O frontend usa rotas relativas `/panel-api/*`; nao precisa hardcodar base URL de producao/staging no admin.

## Ordem De Implementacao Recomendada

1. Analisar repo da API/cadastro publico.
2. Analisar repo do painel admin.
3. Documentar variaveis reais de cada um.
4. Criar env examples para staging.
5. Criar scripts de deploy staging nos repos certos.
6. Centralizar endpoints do launcher sem mudar comportamento default.
7. Adicionar `start:stage` no launcher.
8. Testar fluxo: cadastro staging -> admin staging -> launcher staging.

## Regra De Seguranca

Nao usar banco de producao em staging. Nao testar cadastro/admin real em producao. Secrets podem ser compartilhados quando aprovado, mas valores reais nunca entram em codigo/docs.

Como o projeto e open source, nunca registrar valores reais em codigo/docs:

- credenciais, tokens, secrets ou API keys;
- emails privados ou dados de cliente;
- paths pessoais de maquina;
- URLs privadas de storage, banco ou painel interno;
- dumps de payload com dados reais.

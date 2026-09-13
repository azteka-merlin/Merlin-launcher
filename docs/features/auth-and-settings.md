# Sessao, Licenca e Configuracao

## Fluxo de licenca

- O portao de licenca bloqueia a interface ate `auth:status` concluir com sessao valida.
- A chave aceita `MERLIN-XXXX-XXXX-XXXX`, sem caracteres ambiguos, e e normalizada em maiusculas.
- Login envia chave e HWID para `/auth/login`; HWID e calculado somente no main process.
- A sessao contem token, expiracao e dados publicos da licenca. E persistida em `userData/auth-session.json`, criptografada por `safeStorage`.
- Token e renovado quando faltam menos de 60 segundos. Uma sessao corrompida/indescriptografavel e removida.
- `invalid_key`, `expired`, `revoked` e `hwid_mismatch` apagam a sessao; falha temporaria a preserva para nova tentativa.
- Logout apaga sessao e cache Premium, mas preserva configuracao Steam e biblioteca local.

## Codigos de erro

| Codigo | Tratativa |
| --- | --- |
| `missing` | pedir chave |
| `invalid_key`, `expired`, `revoked`, `hwid_mismatch` | explicar acesso invalido e manter portao aberto |
| `rate_limited` | informar limite temporario |
| `unavailable`, `server_error`, `invalid_response` | mensagem generica de conectividade/validacao |
| `device_error` | informar que o computador nao pode ser identificado |

Recursos autenticados podem renovar token uma vez em 401. Se a renovacao falhar, recebem `auth:required` e o front deve voltar ao portao, sem expor resposta HTTP.

## Assinatura e links de conta

- O botao de assinatura aparece somente com `license.billing.canManageSubscription`.
- `auth:manage-subscription` abre portal externo. `billing_unavailable` e `billing_portal_failed` devem ser tratados sem quebrar a sessao.
- Cadastro e planos sao abertos externamente no origin da API configurada; o front nao monta URLs de conta por conta propria.

## Licencas de teste

- Licenca `test` nao tem tier, contato ou PIN de recuperacao e recebe vencimento administrativo permanente (`9999-12-31`). Ela nao e uma licenca gratuita/normal.
- O Admin configura separadamente limites de ativacoes normais e Premium, ambos entre 0 e 9999, e pode editar ou resetar a contagem.
- Limite normal conta App IDs distintos com ativacao bem-sucedida desde `activationUsageResetAt`; instalar novamente o mesmo App ID nao consome outra vaga.
- Limite Premium conta reservas, ativacoes ativas e expiradas desde o mesmo marco de reset. Portanto uma reserva Premium ja entra na cota.
- Ao esgotar, a API devolve `TEST_LICENSE_NORMAL_ACTIVATION_LIMIT_REACHED` ou `TEST_LICENSE_PREMIUM_ACTIVATION_LIMIT_REACHED`; o launcher mapeia para `test_limit_normal` e `test_limit_premium`, sem confundir com rate limit de rede.

## Configuracao persistida

`config.json` possui `steamPath`, `language` e flags de onboarding, como `tutorialPromptSeen`, `correctionsDisclaimerSeen` e `discordAnnouncementSeen`. Flags novas devem ter default no main.

- Alterar `steamPath` invalida a Biblioteca.
- Alterar idioma atualiza renderer e menu nativo via `setMenuLanguage`.
- Em build de desenvolvimento a configuracao fica no repositorio; em build empacotado fica em `userData`.

## IPC

`auth.hasSession`, `auth.status`, `auth.login`, `auth.logout`, `auth.manageSubscription`, `auth.openSignup`, `auth.openPlans`, `auth.onRequired`; `getConfig`, `saveConfig`, `setMenuLanguage`.

# Contratos da API e impacto no Launcher

Auditoria da API completa: `src/index.ts`, rotas OpenAPI, endpoints e bibliotecas de dominio. A tabela distingue consumo real do Electron atual de fluxos da pagina publica/Admin que afetam a mesma licenca indiretamente.

## Rotas consumidas diretamente pelo launcher

| Rota | Consumidor no launcher | Contrato que o front deve preservar |
| --- | --- | --- |
| `POST /api/auth/login` | Auth | chave + HWID; token, expiracao, licenca e billing; erros de sessao normalizados |
| `POST /api/auth/reset-hwid` | portao de ativacao | chave + HWID; desvincula apenas o dispositivo anterior, apaga a sessao local apos sucesso e pode devolver `409` com `code: hwid_reset_unavailable` e `retryAt` |
| `POST /api/games/search` | busca de jogos/Biblioteca | autenticada; ate quatro sugestoes no fluxo visual, nome/capa/App ID validos |
| `GET /api/public/catalog` | catalogo local de metadados | bootstrap e refresh de nomes/capas; nao e permissao de ativacao |
| `GET /api/manifests/status` | policy de auto-update | autenticada; `requiresVersionPin` e `automaticUpdatesEnabled` |
| `GET /api/manifests` | instalador de jogos | autenticada; ZIP ou JSON `success:false` de negocio; rate limit e limites de teste |
| `GET /api/fixes/catalog` | Corrections | catalogo, voto do viewer e metadados do fix; pode usar token ou fallback permitido |
| `GET /api/fixes/download` | Corrections | download autenticado/proxy quando necessario; nunca expoe segredo Ryuu ao launcher |
| `POST /api/fixes/vote` | Corrections | voto autenticado `up`/`down`, retorno de totais e voto do viewer |
| `GET /api/premium/catalog` | Premium | autenticada; disponibilidade, slots, cooldown, locks, tier e janelas por pessoa |
| `POST /api/premium/activate` | Premium Steam ticket | reserva/ativacao, token temporario, arquivo e cooldown; API e a autoridade |
| `POST /api/premium/activate-third-party` | Premium de terceiro | confirma reserva/token de terceiro; mantem validacao do executavel local |
| `POST /api/premium/activation-events` | Premium | telemetria de falha local e liberacao de reserva quando cabivel |
| `GET /api/premium/download` | Premium | download autorizado somente para reserva/ativacao valida |
| `GET /api/polls/active`, `POST /api/polls/:id/vote` | Polls | autenticada; elegibilidade e voto sao decididos no servidor |
| `GET /api/announcements/eligible`, `POST /api/announcements/:id/view`, `POST /api/announcements/:id/dismiss` | Comunicados | autenticada; elegibilidade e historico por licenca |
| `GET /api/announcements/:id/image` | imagem de comunicado | imagem vinculada ao comunicado elegivel, nao URL arbitraria |
| `GET /api/updates/latest`, `GET /api/updates/download` | Update | metadata de release e instalador; o launcher mantem allowlist HTTPS/arquivo `.exe` |
| `POST /api/launcher/billing-portal` | assinatura | portal para a licenca autenticada; 409 significa indisponivel, nao logout |

Todos os recursos autenticados usam bearer JWT do login. Uma resposta 401 pode renovar uma vez; erro definitivo volta ao portao de licenca.

## Regras de servidor que o front apenas exibe

- Login, rate limit de login/manifests, validade/revogacao/HWID e limites de teste sao executados na API.
- Manifesto: fontes, fallback, override, resultado `manifest_unavailable`/`manifest_sources_unavailable`, atividade e warnings operacionais sao responsabilidade da API. O front so converte os codigos em mensagem.
- Premium: jogo habilitado, archive, slots, reservas, cooldown, tier, corte para gratuito, acesso antecipado e cota de teste/Bronze sao validados tanto no catalogo quanto na ativacao. Dados em cache nunca autorizam ativar.
- Corrections: catalogo remoto, primeiro fix elegivel, filtro Hypervisor e votos sao normalizados pela API/servico; renderer mantem a protecao local de extracao e caminho.
- Polls e comunicados verificam licenca e estado no servidor. Uma tela antiga nao pode assumir que ainda pode votar, visualizar ou dispensar.
- Atividade de usuario registra login e ativacoes normais/Premium; Audit e Activity do Admin sao consumidores desses registros, nao chamadas do renderer.

## Fluxos publicos que alteram o launcher indiretamente

| Fluxo da API publica | Reflexo posterior no launcher |
| --- | --- |
| cadastro, verificacao de email e recuperacao de chave | cria/recupera chave que sera usada no portao de licenca |
| checkout Stripe, Pix, webhooks, consulta de pagamento e portal publico | cria, renova, cancela, altera billing/tier/vencimento da licenca; refletira no proximo login/refresh e Premium |
| pagina publica de acesso e troca de plano | muda a mesma licenca, inclusive restricao de catalogo futuro; nao e uma tela do launcher |
| catalogo publico e consult | alimentam experiencia publica/administrativa e enriquecimento; nao concedem manifest ou Premium |
| feedbacks e partners | apenas pagina publica; sem consumo pelo Electron |

## Rotas existentes que o Electron atual nao consome

- Pagina publica (`/`, `/download`, `/checkout`), autenticacao e rotas `/panel-api/*` do Admin.
- Health e version da API, geracao/download legado de activation archive e demais ferramentas operacionais.
- Webhooks Stripe/Mercado Pago, cron de notificacao e sincronizacao de catalogo/Denuvo.

Essas rotas nao precisam ser recriadas no novo front. Elas podem mudar indiretamente dados remotos, portanto o novo renderer deve tratar cada resposta de catalogo/auth como fonte atual de verdade.

## Regras de erro para integrar

1. Basear UX em `code`, `viewer.status`, `lockedReason` e `canActivate`; nunca em HTTP ou texto bruto.
2. `429` e limite de tentativa/solicitacao; codigos de licenca de teste sao limites de produto distintos.
3. Resultado HTTP 200 com `success:false` de manifests e uma resposta de negocio, nao falha de parsing/download.
4. `stale:true` em Corrections/Premium e dado legivel, porem nunca sinal de permissao para ativar.
5. Nunca repassar token, URL assinada, segredo de fonte, detalhe de Worker ou stack trace para a UI.

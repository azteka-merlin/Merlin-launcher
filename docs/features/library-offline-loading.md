# Biblioteca: carregamento local e metadados separados

Correção de 06/11/2026 para a lentidão durante indisponibilidade do Ryuu.

## Causa

A listagem aguardava enriquecimento de nomes e capas antes de responder ao
renderer. Esse caminho podia baixar o catálogo inteiro do Ryuu, com timeout de
20 segundos. O fallback de imagens também usava o Ryuu. Uma falha de metadados
podia produzir `load_failed` para jogos que já estavam no computador.

## Regra atual

- `library:list` e `library:refresh` leem os arquivos Lua gerenciados e os caches
  locais. Não aguardam requisições remotas, nem baixam o catálogo Ryuu.
- Nomes faltantes são completados separadamente das imagens. A falta de capa
  não dispara consultas repetidas de nome. Metadados contendo apenas nome
  preservam uma capa já armazenada. O serviço agrupa
  consultas concorrentes, limita lotes a quatro jogos e usa o evento existente
  `library:updated` quando a lista muda.
- A consulta usa `metadataOnly: true` na API Merlin. Após a autenticação normal,
  ela consulta `games_catalog` por AppID. Não consulta Hubcap nem valida imagens.
- Capas ficam em cache local no processo principal. Uma falha da Ryuu abre um
  circuito de 60 segundos apenas para essa origem. URLs Steam/Merlin já
  conhecidas continuam funcionando, incluindo atualização de cache antigo.
  Fotos locais permanecem disponíveis. Após a pausa,
  uma única solicitação testa a recuperação. Uma falha de capa usa placeholder.
- O launcher não baixa o JSON remoto do Ryuu para montar a biblioteca. Imagens
  passam pela política central, independentemente do health check. Os dados das
  Correções e as fontes dos downloads permanecem nos fluxos anteriores.
- Falha de metadados não marca o jogo como inexistente, não apaga a lista e não
  impede remover um jogo ou abrir sua pasta.
- Uma resposta atrasada não restaura jogos removidos nem substitui um nome
  lembrado mais recentemente. O renderer preserva uma atualização recebida por
  IPC caso a resposta inicial da listagem chegue depois dela.

## Compatibilidade e publicação

O JSON das consultas normais permanece compatível: `metadataOnly` é opcional e
desativado por padrão. Não há binding novo ou mudança de regra de licença.
O modo novo ainda exige autenticação. Os canais IPC existentes foram reutilizados.

A API deve ser publicada antes de distribuir o launcher atualizado. A correção
da espera direta pelo Ryuu requer o código novo do launcher; um deploy isolado
da API não modifica os executáveis já instalados.

Os indicadores de instabilidade por área permanecem um planejamento separado.

## Regressões

- Listagem disponível enquanto a consulta de metadados nunca responde.
- Renderer sem solicitações diretas Ryuu, inclusive com capas antigas.
- Circuito aberto preservando fotos locais, inclusive após reiniciar o app.
- Queda do banco preservando os dados locais, sem consultas à Hubcap.
- Resposta antiga de imagem não reabre um circuito já aberto por outra falha.
- Atualização dos nomes por IPC e proteção contra respostas atrasadas.
- Remoção durante enriquecimento e preservação de nomes recém-gravados.
- Autenticação obrigatória e busca convencional compatível na API.

```powershell
# Launcher
node --test test/library-service.test.js test/library-catalog-service.test.js test/library-ipc-contract.test.js test/library-search-client.test.js test/library-renderer.test.js

# API
npx vitest run tests/library-metadata.test.ts
npm run validate:premium
```

Para testar o launcher e as fotos em staging:

```powershell
npm run start:stage
```

Os nomes seguem a API configurada para o launcher. As imagens passam pelo
cache local do processo principal. Para produção, use `npm start`.

## Estabilidade visual das capas

Premium, lista de desejos e Correções preservam os elementos de imagem já
exibidos quando seus cards são redesenhados. A disponibilidade e os botões
continuam recebendo o estado novo; preservar a foto não preserva dados antigos
da ativação. A foto ainda visível não é uma consulta nova à origem.

O carregamento inicial dessas listas renderiza uma vez, ao encerrar a consulta.
Imagens aguardando o cache local ficam transparentes, mantendo o espaço
do card e um fundo neutro; não há moldura nativa de imagem sem src, animação
ou reaparição deliberada das fotos durante atualização da lista.

Regressões em `game-covers.test.js` e `premium-status-renderer.test.js` conferem
a imagem oculta até carregar e a preservação do mesmo elemento enquanto a
disponibilidade muda. Em 06/11/2026, 31 testes relacionados passaram e a tela
Premium foi inspecionada antes, durante e após Atualizar lista.

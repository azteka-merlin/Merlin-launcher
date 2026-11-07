# Proposta: avisos de disponibilidade por área

Status: planejamento para aprovação. Apenas a correção da área clicável do X
foi implementada nesta etapa. Não alterar monitoramento, textos ou fontes antes
da aprovação deste plano.

## Objetivo

A pessoa deve entender qual função foi afetada, se pode continuar e o que fazer
agora. Uma falha em Correções não deve ser apresentada como queda do Merlin.

## Referências de UI e UX consultadas

- [NN/g: Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/):
  linguagem compreensível, mensagem perto da tarefa afetada e orientação útil.
- [GOV.UK: Notification banner](https://design-system.service.gov.uk/components/notification-banner/):
  usar avisos globais com moderação; problemas diretamente ligados à tarefa
  devem aparecer no conteúdo dessa tarefa. Consolidar avisos concorrentes.
- [W3C: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum):
  alvos de interação acessíveis. Para o X, foi adotado um botão de 44 × 44 px.

As cores e a escolha de gravidade abaixo são propostas para o Merlin. Cor deve
acompanhar texto e ícone, sem ser o único indicador.

## Dependências identificadas no código

- A checagem atual do launcher consulta somente o health do Ryuu, mas apresenta
  um aviso global. Requisições bem-sucedidas de funções diferentes podem apagá-lo.
- Adicionar jogos passa pela API Merlin. A fonte padrão é Hubcap; o código ainda
  permite Ryuu, DepotBox, Steam API e outras alternativas, além dos overrides.
  Portanto, Ryuu não é exclusivamente uma dependência de Correções no código.
- Correções carrega o catálogo Ryuu e oferece arquivos Ryuu, DepotBox e uploads
  próprios. Uma falha Ryuu pode afetar parte da função, sem invalidar todos os
  arquivos próprios ou os jogos já instalados.
- O health da API Merlin atualmente retorna `status: online`. Ele prova que a
  rota respondeu, sem validar sozinho login, banco, armazenamento e provedores.
- A Biblioteca também depende do Ryuu para completar nomes e capas. O cliente
  baixa `files/games.json` com timeout de 20 segundos, e a listagem espera o
  enriquecimento de metadados antes de responder. Uma exceção nesse caminho
  pode resultar em `load_failed` mesmo com arquivos de jogos disponíveis no PC.
  Capas também possuem fallback para `files/images/{appid}.jpg`.

### Complemento: Biblioteca

Diagnóstico acrescentado após o relato de lentidão: o levantamento inicial de
impactos estava incompleto. Ryuu pode afetar carregamento de metadados da
Biblioteca, além de Correções e do fallback para adicionar jogos.

Proposta, ainda sem implementação: exibir a biblioteca a partir dos arquivos
locais e do cache, completar nomes/capas depois e preservar a listagem quando
uma fonte de metadados ou imagem falhar. O aviso deve dizer **“Algumas capas e
informações podem demorar para aparecer”**, se houver impacto observado. Não
apresentar isso como indisponibilidade dos jogos ou da biblioteca inteira.

## Apresentação proposta

### Na área afetada

Um aviso compacto acima do conteúdo, próximo da ação afetada. A mensagem informa
o efeito e a próxima ação. Evitar a modal grande com ilustração para falhas de
um fornecedor que não impeçam a pessoa de continuar.

### No cabeçalho

- Sem problema confirmado: sem badge de alerta.
- Uma área afetada: `Correções com instabilidade` ou `Adicionar jogos com instabilidade`.
- Várias áreas afetadas: `2 áreas com instabilidade`; ao clicar, listar as áreas.
- Falha de comunicação com a API Merlin: `Sem conexão com o Merlin`.

Ao clicar, abrir um único painel com os impactos e as ações disponíveis. Nomes
de fornecedores ficam em detalhes opcionais. Não mostrar códigos HTTP, número
de verificações, tokens, credenciais ou termos de implementação na mensagem
principal.

### Gravidade

- Informativo: fonte alternativa atendendo; a pessoa pode continuar.
- Atenção: uma função está limitada ou indisponível; outras funções continuam acessíveis.
- Crítico: não é possível conectar ao serviço central ou concluir a tarefa
  porque todas as alternativas utilizáveis falharam. Uma falha de download
  continua sendo um problema dessa tarefa se a API e o restante do app respondem.

## Cenários e mensagens sugeridas

| Situação confirmada | Local e tom | Texto sugerido |
| --- | --- | --- |
| Ryuu afeta Correções | Atenção em Correções | **Algumas correções estão indisponíveis.** Não foi possível carregar ou baixar algumas correções agora. Tente novamente em instantes. |
| Hubcap falha ou atinge limite, mas outra fonte atende | Informativo em Adicionar jogos | **Estamos usando uma fonte alternativa.** Adicionar jogos pode demorar um pouco mais. Você pode continuar. |
| Ryuu e Hubcap falham, mas outras fontes ainda atendem | Informativo se a operação termina normalmente; atenção se há limitações observadas | **Alguns jogos podem não ser adicionados agora.** Estamos tentando outras fontes. Se o jogo não for adicionado, tente novamente em instantes. A área Correções recebe seu próprio aviso quando afetada. |
| Nenhuma alternativa consegue atender ao jogo solicitado | Erro junto da ação | **Não foi possível adicionar este jogo agora.** Tente novamente em instantes. A falha de um jogo não confirma uma queda geral do catálogo. |
| Launcher não consegue alcançar a API Merlin | Crítico no cabeçalho e junto do login/ação afetada | **Não foi possível conectar ao Merlin.** Entrar na conta, adicionar jogos e usar recursos online pode ficar indisponível. Tente novamente em instantes. |
| Sem conectividade local identificável | Aviso de conexão | **Sem conexão com a internet.** Confira sua conexão e tente novamente. Usar esta afirmação apenas quando houver evidência; nos demais casos, usar “Não foi possível conectar ao Merlin”. |

Não afirmar que o Merlin inteiro caiu a partir de uma falha observada em um PC.
“Merlin temporariamente indisponível” pode ser usado quando houver confirmação
do serviço central, distinguindo-a de uma falha local de comunicação.

## Ações e comportamento

- `Tentar novamente` consulta a área afetada sem reiniciar o app e sem consumir
  ativação Premium ou baixar arquivos de teste.
- `Ver o que foi afetado` abre o painel consolidado.
- X e `Entendi` fecham o aviso, preservando o indicador enquanto o problema existir.
- Uma falha parcial não abre modal automaticamente. Problemas impeditivos ficam
  visíveis junto da ação; evitar reapresentar uma modal a cada nova tentativa.
- Não bloquear navegação, apagar o formulário de login, deslogar a pessoa ou
  alterar cooldown por causa de um indicador de disponibilidade.
- Quando a área se recuperar, remover o seu aviso. Não usar o sucesso de uma
  função para apagar alertas de dependências diferentes.
- A primeira falha recebe uma confirmação breve e limitada antes de um aviso
  persistente. A falha real da ação pode ser mostrada imediatamente nessa ação.
- Usar texto e ícone além de cor, anúncio acessível discreto e botões com nomes
  claros. Evitar repetição de anúncios por leitores de tela e roubo de foco.

## Como obter evidência sem criar falsos alarmes

1. A API centraliza o estado das fontes e traduz para impacto por função. O
   launcher também identifica quando não consegue alcançar a própria API.
2. Preferir resultados das requisições reais, confirmação leve e estado de cota.
   Não baixar jogos, gerar tokens ou consumir cota só para verificar disponibilidade.
3. Separar `normal`, `limitado`, `indisponível`, `verificando` e `sem dados`.
   Ausência de informação não significa que a fonte funciona ou está fora.
4. Não interpretar jogo ausente, credencial inválida, bloqueio de plano, cooldown,
   limitação de uma licença ou um arquivo inválido isolado como queda global.
5. Estado de fornecedor e funcionamento da área são distintos. Uma fonte pode
   estar indisponível enquanto outra mantém a área utilizável.
6. O sinal de health do Ryuu deve ser validado por capacidade: catálogo de
   Correções e fornecimento de arquivos não são comprovados apenas pelo campo
   `downloads_available`.
7. Usar eventos e atualização no retorno ao app quando o canal em tempo real
   for aprovado. O canal Premium discutido anteriormente ainda é uma proposta;
   este plano não pressupõe que ele esteja implementado.
8. Evidências e detalhes operacionais ficam no Admin/observabilidade. Uma queda
   da API não pode impedir o launcher de mostrar seu aviso local de conexão.

## Critérios para aprovar a implementação futura

- Ryuu indisponível com Adicionar jogos funcionando não produz “Merlin fora”.
- Hubcap indisponível com alternativa bem-sucedida permite continuar e mostra
  informação proporcional ao impacto observado.
- Ryuu e Hubcap indisponíveis consideram também as demais alternativas.
- Falha da API aparece no login e em Adicionar jogos com mensagem compreensível,
  distinguindo falta de conexão local de indisponibilidade confirmada do serviço.
- Sucesso em Premium não limpa uma falha específica em Correções.
- Limites de cota e erro de um jogo não viram alerta geral.
- Avisos combinados não geram modais sobrepostas e fechar não implica recuperação.
- Recuperação remove apenas os estados pertinentes e não perde dados preenchidos.
- Antes de qualquer deploy futuro, executar os gates já exigidos pelo projeto,
  inclusive `validate:premium`; este planejamento não publica código.

## Correção do X executada nesta etapa

A imagem com filtro criava uma camada sobre parte do botão. O botão recebeu
prioridade de empilhamento e 44 × 44 px; a imagem decorativa deixa de interceptar
eventos de ponteiro. O foco por teclado também recebe contorno visível.

Na prévia isolada com os arquivos reais do launcher, apenas 5 de 25 pontos no
botão funcionavam antes da correção. Depois, 25 de 25 funcionam em 980 × 700 e
480 × 640, e um clique perto do canto fecha a modal. Nenhuma regra de detecção,
mensagem de indisponibilidade ou chamada de rede foi alterada nesta etapa.

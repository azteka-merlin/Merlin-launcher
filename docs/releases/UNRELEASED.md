# Próxima versão — alterações ainda não publicadas

## Saves na nuvem e Steam

- Corrigida a identificação de pastas de saves usadas por jogos quando o ID da pasta difere da conta Steam conectada, incluindo o Phantom Blade Zero.
- A lista de saves acompanha a troca de conta Steam e atualiza os jogos sincronizados.
- Melhorada a detecção da conta Steam para evitar mensagens incorretas quando ela já está aberta.
- A Steam é encerrada antes de reparar ou substituir arquivos que possam estar em uso, evitando erros de arquivo ocupado.

## Premium: disponibilidade automática

- Com a aba Premium aberta, o botão atualiza automaticamente após a API confirmar a liberação de uma ativação ou o fim do cooldown.
- Consulta no vencimento dos prazos e a cada 30 segundos para acompanhar outras liberações, sem exigir “Atualizar”. Ao voltar à aba ou ao app, também confere dados antigos.
- Mantém a busca e a página atual. Falhas de conexão preservam os bloqueios existentes e as consultas automáticas não exibem notificações repetidas.
- A contagem local não concede acesso: plano, disponibilidade e cooldown continuam sendo validados pelo servidor.

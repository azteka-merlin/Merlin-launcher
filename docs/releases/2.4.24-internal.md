# Próxima versão — alterações ainda não publicadas

## Premium: aviso após a ativação

- A tela de sucesso orienta a abrir o jogo em até 15 minutos para concluir a ativação.
- O aviso explica que, após esse prazo, a ativação pode expirar e exigir uma nova tentativa pelo suporte.
- As instruções de abertura pela Steam ou pelo executável continuam abaixo do aviso.
- Texto disponível nos cinco idiomas do launcher.

Texto sugerido para o changelog:

> Novo aviso ao concluir uma ativação Premium: abra o jogo em até 15 minutos para evitar que a ativação expire.

## Clareza no catálogo Premium

- O contador passa a mostrar “ativações disponíveis” em vez de “vagas disponíveis”, com singular e plural nos cinco idiomas.

## Aviso de ativação Premium ao adicionar jogos

- Ao adicionar pelo launcher um jogo presente no catálogo Premium, um aviso orienta a conferir a ativação na aba Premium.
- Oferece “Ver na aba Premium” e “Fazer depois”, sem iniciar ativação ou consumir cota.
- Na fila, reúne os jogos correspondentes em um único aviso e informa que a ativação depende do plano e da disponibilidade.
- Disponível nos cinco idiomas. Este item está no código local e deve entrar na próxima versão.

## Publicação

- Controle: comandos deixam de acionar o launcher quando ele está sem foco ou em segundo plano. Ao voltar, é necessário soltar os botões antes de navegar. Links da comunidade também bloqueiam aberturas repetidas e pedidos com a janela inativa.

- Correções: fixes classificados como “Online” deixam de aparecer na lista e nos avisos ao adicionar jogos. Se houver outra correção elegível para o mesmo jogo, ela continua disponível. O filtro central depende da publicação da API e da atualização da lista no launcher.

Esta alteração foi aprovada e enviada ao repositório sem gerar release, tag ou alterar a versão 2.4.23.
Incluir o item no changelog do Admin e nas notas do GitHub quando a próxima versão for preparada.
A prévia foi conferida no Merlin Test com uma ativação simulada.

## API e administração: fontes e cotas de e-mail

- A Hubcap passa a ser a primeira fonte de manifests, seguida por Ryuu, DepotBox e Steam API; overrides continuam prioritários. O admin permite mudar a fonte principal.
- O pacote Hubcap contém os manifests e o Lua. A API verifica o uso e, ao esgotar a cota, pausa a Hubcap e continua automaticamente pela próxima fonte. O admin mostra o estado do circuito; a próxima verificação ocorre após o horário de renovação.
- O painel de cotas de e-mail foi ajustado para celulares; a consulta da cota Resend usa credencial separada com acesso à Usage API.
- A lista de correções filtra itens classificados como Online, mantendo outras correções elegíveis.

Registrar esses itens no changelog quando a próxima versão for preparada.

## Correções: abertura da lista

- Corrigida a exibição da aba quando o catálogo de correções já foi carregado em segundo plano após adicionar um jogo. A lista passa a aparecer ao abrir a aba, sem precisar atualizar manualmente.

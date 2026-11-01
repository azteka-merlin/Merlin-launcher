# Iniciadores MWII e MWIII

| Jogo | Campanha (single player) | Multiplayer (bots) |
| --- | --- | --- |
| MW2 | `start_mw2_campanha.exe` | `start_mw2_multiplayer.exe` |
| MW3 | `start_mw3_campanha.exe` | `start_mw3_multiplayer.exe` |

Cada executável fica na raiz da instalação do jogo, ao lado de
`Randgrid.sys` e `bootstrapper.exe`. O iniciador usa o serviço do driver
existente ou cria um temporário, inicia o bootstrapper com um console oculto,
monitora a janela de console criada pelo fix e a oculta assim que aparece,
aguarda o jogo fechar e remove apenas o serviço que criou. Ele não usa os
arquivos `!start_*.bat` nem abre `cmd.exe`. A janela do fix pode piscar por
alguns milissegundos antes de ser ocultada.

O Windows solicitará permissão de administrador. Se faltar algum arquivo
do jogo ou do fix, o iniciador mostra uma mensagem. O console externo do fix
fica oculto, portanto a tecla de comando que depende dele não fica acessível.

Para compilar e copiar os quatro EXEs para as pastas dos fixes, execute
`build.ps1 -Deploy` em PowerShell. O script também coloca os iniciadores nas
instalações locais do MWII e MWIII, quando as encontrar. O caminho curto do
Windows é usado para o driver e o bootstrapper quando disponível, como nos
BATs originais.

`test_hidden.ps1` compila um bootstrapper de teste que cria uma janela de
console com o título do fix, mede quanto tempo o iniciador leva para ocultá-la
e confirma que as APIs de console continuam funcionando. O MWII usa o ícone extraído
do jogo instalado; o MWIII usa um ícone provisório até haver um EXE do jogo
para extrair o ícone original.

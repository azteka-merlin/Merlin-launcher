# Plugin da Loja Steam

## Objetivo e escopo

O Plugin da Loja Steam e uma integracao **opcional** do Merlin. Ele adiciona o icone do Merlin no cabecalho da loja Steam e, nas paginas de jogos, o botao `Adicionar com Merlin`.

Ele nao substitui a tela nativa de Biblioteca, Premium, busca ou instalacao do launcher. O botao da loja encaminha a solicitacao para o mesmo `addGamesService.installNow` usado pelo fluxo nativo. Por isso, regras de licenca, fila, manifestos, auto-update, biblioteca e tratamento de erros continuam centralizados no Merlin.

O escopo deliberadamente nao inclui remocao de DRM, Steamless, fontes de download externas, escolha de mirrors ou funcionalidades de terceiros.

## Componentes

| Parte | Arquivo | Responsabilidade |
| --- | --- | --- |
| Configuracao e ciclo Electron | `main.js` | bandeja, inicializacao em segundo plano, restaurar a janela e supervisao do bridge |
| Servico do plugin | `src/main/steam-plugin/steam-plugin-service.js` | CDP, fila de comandos, operacoes de adicao e estado por aba |
| Script da loja | `src/main/steam-plugin/merlin-store-script.js` | botoes, modal Denuvo, menu e atualizacao visual na pagina Steam |
| IPC isolado | `src/main/ipc/register-steam-plugin-ipc.js` e `preload.js` | status, instalar e desinstalar sem expor Node ao renderer |
| Tela de configuracoes | `index.html`, `renderer.js`, `styles.css` | controle opt-in, loading e confirmacao de reinicio |
| Testes | `test/steam-plugin-service.test.js` | ownership, contrato do script, IPC e bridge com duas acoes consecutivas |

## Como a integracao funciona

1. Ao instalar, o Merlin cria a junction `.cef-enable-remote-debugging` na pasta da Steam. A Steam passa a publicar o Chrome DevTools Protocol (CDP) localmente em `127.0.0.1:8080` depois do reinicio.
2. O Merlin reinicia a Steam pelo servico nativo ja existente. Com o plugin habilitado, o launcher fica disponivel em segundo plano pela bandeja e tambem pode iniciar com o Windows.
3. A cada ciclo, o servico encontra somente abas `store.steampowered.com`, mantem um WebSocket CDP por aba e verifica a versao do script injetado.
4. O script injeta o icone do Merlin, o menu `Abrir Merlin` e o botao por jogo. A imagem do menu e embutida em `data:image/png`, portanto a pagina Steam nao precisa acessar um arquivo local.
5. A pagina coloca comandos pequenos em `window.__merlinSteamPluginRequests`. O processo principal consome `open`, `add`, `status` ou `remove`, publica a resposta em `window.__merlinSteamPluginReplies` e remove o comando **na mesma array** com `splice`.
6. `open` restaura a janela da bandeja depois da resposta CDP; `add` chama o instalador nativo; `status` atualiza texto, progresso e o resultado. Quando o jogo ja esta no Merlin, o menu mostra `Remover do Merlin`; a acao pede confirmacao e chama o mesmo `libraryService.remove` da Biblioteca nativa. Ela remove o registro do Merlin (Lua e manifests exclusivos), nunca os arquivos instalados pela Steam.

A remocao in-place da fila e importante: o script conserva uma referencia para essa array. Trocar a array faria a primeira acao funcionar e as seguintes, na mesma pagina, sumirem — regressao coberta por teste.

## Instalacao, desinstalacao e ownership

- A integracao e desligada por padrao em uma instalacao limpa (`steamPlugin.enabled: false`).
- O estado persistido e `steamPlugin.enabled` e `steamPlugin.markerOwned`.
- O Merlin remove a junction somente se ele a criou. Se ela ja existia, nao apaga algo que pode pertencer a outra ferramenta.
- Instalar ou remover reinicia a Steam. Nao ha abertura automatica da Steam pelo mero inicio do Merlin.
- Fechar a janela com o plugin ativo a esconde na bandeja; `Sair` no menu da bandeja encerra o processo e o bridge.
- O launcher precisa permanecer em execucao (normalmente na bandeja) para que os botoes da Steam conversem com o backend. A Steam pode continuar aberta sem o Merlin, mas o botao nao conseguira executar a acao enquanto o processo estiver encerrado.

## Contrato da pagina Steam

### Comandos enviados

```text
open   { view: 'launcher' }
add    { appId: '<somente digitos>', name: '<titulo da pagina>' }
status { appId: '<somente digitos>' }
remove { appId: '<somente digitos>' }
```

`add` nao baixa nada na pagina Steam. O App ID e validado no processo principal antes de chegar ao instalador. Se o jogo usa Denuvo, o usuario confirma antes da adicao e recebe a orientacao para verificar a aba Premium depois da instalacao.

### Resultado visual

- Pendente: `Verificando disponibilidade…` ou o progresso retornado pelo instalador.
- Sucesso: `Adicionado` e modal de confirmacao.
- Indisponivel: modal especifico para catalogo/manifesto indisponivel.
- Falha: botao volta a ficar utilizavel e mostra erro generico/classificado.

O estado `Adicionado` representa a presenca do arquivo Lua do Merlin para aquele App ID. Ele nao e uma afirmacao de que a Steam ja baixou todos os depots.

## Seguranca e operacao

- CDP fica limitado ao loopback, mas e uma interface poderosa do navegador. A junction e criada somente por escolha explicita do usuario e deve ser removida ao desinstalar se for do Merlin.
- O bridge aceita apenas quatro comandos e valida App IDs numericos. Nenhum endpoint HTTP local fica exposto pelo plugin.
- Erros esperados enquanto a Steam esta fechada (`ECONNREFUSED` e `ECONNRESET`) nao geram repeticao ruidosa no terminal. Outros erros sao registrados uma vez por mensagem; comandos processados geram log de debug pontual.
- Cada chamada CDP possui timeout. Sockets de abas removidas sao terminados no ciclo seguinte.

## Diferenca em relacao ao LuaTools

O Merlin usa a mesma ideia tecnica geral que o LuaTools adotou para conversar com a CEF da Steam: junction de debug, porta CDP fixa `8080`, descoberta de abas, WebSocket persistente e teste de liveness por contexto JavaScript. Tambem segue a mesma necessidade de restaurar uma janela escondida na bandeja apos uma acao vinda da Steam.

Nao e uma copia nem porta do plugin do LuaTools:

- o Merlin nao contem `luatools.js`, a camada de compatibilidade `window.Millennium`, servidor HTTP local na porta `6767`, `LuaLoader`, `winmm.dll` ou qualquer DLL do LuaTools;
- nao baixa um frontend de plugin separado de releases do LuaTools;
- nao compila DLL para a integracao da loja. O plugin e codigo proprio em JavaScript/Node/Electron e usa o CDP que a propria Steam expoe;
- as DLLs `OpenSteamTool`, `dwmapi`, `xinput1_4` e `merlin-helper` continuam sendo o runtime nativo do Merlin para manifests/metadados. As mudancas atuais em `OpenSteamTool` (hook `YldLoadDepotManifest` e cache) pertencem ao release 1.6.7 e nao participam do plugin da loja.

O LuaTools ainda usa uma DLL proxy `winmm.dll` para iniciar seu aplicativo quando a Steam abre, mesmo depois de ter migrado a injecao para CDP. No Merlin, o processo Electron e mantido pela bandeja/inicializacao no login quando o recurso esta habilitado; portanto nao foi necessario trazer esse loader.

### Auditoria da camada nativa do LuaTools

O repositorio local do LuaTools em `9461259` contem o instalador e os contratos dos binarios, mas **nao** o fonte C/C++ do loader. O `PluginInstallerService` baixa assets de um repositorio de releases separado, valida SHA-256 e os copia para a raiz da Steam. Portanto, o comportamento abaixo e auditado pelo codigo de instalacao e pelos comentarios do projeto; nao se deve portar o binario sem fonte, licenca e auditoria propria.

| Artefato do LuaTools | O que faz hoje | Situacao para Merlin |
| --- | --- | --- |
| `winmm.dll` + `winmm_real.dll` | Proxy de `winmm`: Steam carrega o proxy, ele encaminha para a DLL real do Windows e inicia o LuaTools com `--minimized --tray-locked`. O comentario do projeto diz que, depois da migracao, ele nao abre mais CDP nem injeta JavaScript. | Nao portado. O unico beneficio potencial seria iniciar o Merlin exatamente quando a Steam abre, inclusive se o login do Windows estiver desabilitado. Em troca, adiciona mais uma DLL proxy na raiz da Steam, superficie para AV/compatibilidade e manutencao de forwarding. Nao justifica adotar agora. |
| `bcrypt.dll`, `psapi.dll`, `dbghelp.dll` e companions `_real` | Slots legados. O proprio instalador os remove porque builds antigos tinham hook de `CreateProcessInternalW`, podiam iniciar o app duas vezes e ficaram obsoletos com a junction CDP. | Nao portar. Sao explicitamente legado no LuaTools e aumentariam o risco de conflito. |
| `.cef-enable-remote-debugging` | Nao e DLL: junction NTFS que faz a Steam expor o CDP local na porta fixa 8080. | Ja usado pelo Merlin, com ownership proprio para nao apagar marker de outra ferramenta. |
| `plugin.zip` / `luatools.js` | Frontend JavaScript baixado separadamente e atualizado por release proprio. | Nao portar. O Merlin embute e versiona seu script junto com o launcher, conforme a decisao de liberar atualizacao do plugin junto com a do launcher. |
| `OpenSteamTool.dll`, `dwmapi.dll`, `xinput1_4.dll` | Runtime de outro modo do LuaTools para Steam/manifests; nao sao o carregador do plugin da loja. | O Merlin ja compila e empacota o seu proprio runtime OpenSteamTool e helper. Mudancas nele sao independentes da loja. |
| `cloud_redirect.dll` | Recurso opcional de redirecionamento cloud do LuaTools, fora do plugin de loja. | Fora de escopo; nao traz beneficio para o fluxo Merlin definido. |

**Decisao recomendada:** manter o plugin sem DLL propria. Se no futuro houver evidencia de que a inicializacao no login nao e confiavel, criar um carregador **nosso**, pequeno, auditado e opt-in, apenas para iniciar o Merlin — nunca copiar `winmm.dll` do LuaTools. Antes disso, preferir um mecanismo menos invasivo, como tarefa agendada/Run at Login e health check do bridge.

## Melhorias recomendadas antes de ampliar o recurso

1. **Health check visivel de CDP.** Mostrar na tela de configuracoes a diferenca entre "Steam fechada", "porta 8080 ocupada por outro processo" e "Steam aberta, bridge conectado". Hoje `lastError` existe no servico, mas a UI nao o traduz em diagnostico.
2. **Separar cadencias.** O Merlin hoje descobre abas, faz liveness e drena fila a cada 200 ms. Seguir o desenho mais eficiente do LuaTools: descoberta/injecao a cada ~1 s e somente drenagem de comandos a cada 150–200 ms.
3. **Validar a junction de verdade.** O estado atual testa apenas se o caminho existe. Validar `reparse point` e se recuperar de arquivo/pasta comum evita um falso "instalado" quando a marker estiver corrompida.
4. **Limitar estados de operacao.** `addOperations` deve ter TTL/tamanho maximo e remover entradas concluídas depois de um periodo, para nao crescer em uma sessao longa.
5. **Separar o script em modulos fonte.** O script injetado esta em uma string unica; separar UI, bridge e estado em arquivos testaveis e gerar o bundle no build facilita manutencao quando a Steam alterar DOM/seletores.
6. **Teste de compatibilidade de DOM.** Manter fixtures de paginas Steam (normal, discovery queue, jogo com Denuvo) e validar os seletores e a posicao do botao sem depender de teste manual.
7. **Verificacao completa de instalacao.** Para o estado `Adicionado`, conferir Lua e manifests esperados, ou nomear o estado como "Adicionado ao Merlin" para nao sugerir download Steam concluido.
8. **Observabilidade sem poluir usuario.** Manter logs tecnicos sob debug, com um botao de copiar diagnostico na configuracao; nao usar pop-ups recorrentes.

## Checklist manual

1. Ativar plugin e aceitar reinicio da Steam.
2. Confirmar icone Merlin no cabecalho de uma pagina normal e de uma pagina de jogo.
3. Com Merlin na bandeja, clicar `Abrir Merlin` duas vezes na mesma pagina, escondendo a janela entre os cliques.
4. Adicionar jogo normal, jogo indisponivel e jogo com Denuvo.
5. Remover um jogo no launcher, recarregar a pagina Steam e confirmar que o botao deixa de mostrar `Adicionado`.
6. Desinstalar plugin e verificar que o icone/botao somem apos o reinicio da Steam e que o launcher continua funcionando normalmente.

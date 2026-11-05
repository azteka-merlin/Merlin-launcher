# Instalação: falha ao copiar OpenSteamTool.dll

## Evidências

- Clientes relatam falha durante instalação e conseguem copiar a DLL manualmente
  com a Steam fechada. Isso aponta para o fechamento no instalador; o alerta
  anterior sozinho não distinguia arquivo carregado, permissão ou outra falha.
- O teste local retirou temporariamente os cinco arquivos gerenciados do Merlin
  da Steam e executou a macro original. Todas as cópias funcionaram, inclusive
  OpenSteamTool.dll. Os hashes originais foram restaurados ao final.
- O fechamento antigo ocorria em `customInit`, dentro de `.onInit`. Depois disso,
  electron-builder fecha o Merlin, remove a versão anterior e extrai os arquivos.
  `customInstall` não verificava novamente a Steam antes de copiar as DLLs.
- A checagem antiga considerava qualquer retorno diferente de zero como processo
  ausente. No nsProcess, somente 603 significa ausente; falhas de enumeração
  também podiam deixar a instalação continuar.

Esses defeitos foram confirmados no código. Não há prova de que todos os relatos
dos clientes tenham a mesma causa, nem evidência de bloqueio por antivírus.

## Correção

- `scripts/steam-shutdown.nsh` centraliza o encerramento. Primeiro solicita
  `steam.exe -shutdown` e verifica por até três segundos. Se necessário, usa o
  encerramento forçado da Steam e de seus filhos e verifica por mais três segundos.
- Só o resultado explícito de processo ausente autoriza prosseguir. Erro de
  inspeção ou processo ainda presente interrompe antes de escrever nas DLLs.
- O instalador executa esse fechamento tanto no início quanto imediatamente
  antes da cópia, depois da extração e do fechamento do Merlin antigo.
- O include usa o plugin nsProcess diretamente: electron-builder injeta o include
  customizado antes de definir sua macro FIND_PROCESS. Preservar essa ordem na
  verificação de compilação. As funções/variáveis de instalação não entram no
  compilador do desinstalador.
- A função de fechamento é emitida pelo hook `customHeader`, depois do registro
  dos plugins. Declarar a função diretamente no include faz a compilação falhar
  com `Plugin not found, cannot call nsProcess::_FindProcess`, pois o builder
  ainda não adicionou o diretório dos plugins nesse ponto.
- CopyFileW mantém a substituição dos cinco arquivos, mas captura o código real
  do Windows no próprio retorno. Em falha, informa o arquivo e grava
  `merlin-steam-install.log` na pasta do Merlin. Não atribuir erro 5 (acesso negado)
  automaticamente à Steam, pois há outras causas possíveis.

## Verificação

- Harness NSIS executa a função real com consultas/comandos externos simulados:
  ausente, fechamento normal, forçado, erro de enumeração, Steam persistente e
  reabertura entre início e cópia. Não inicia nem encerra a Steam real nesses testes.
- O include de instalação e o de desinstalação compilam na ordem real do builder.
- O hook real de cópia foi compilado e executado em pasta temporária: instalação
  dos cinco arquivos, origem ausente (erro 2) e destino somente leitura (erro 5).
  As falhas preservam os destinos existentes e registram arquivo/código no log.
- Testes existentes de instalação das DLLs e do serviço Steam continuam passando.
- `test/installer-build.test.js` compila o include de produção com o plugin real,
  respeitando a ordem include → registro de plugins → customHeader. Cobre também
  o desinstalador, sem executar o instalador nem encerrar a Steam.
- `node --test test/installer-build.test.js test/installer-shutdown.test.js test/installer-copy.test.js test/dll-installer.test.js test/steam-service.test.js`:
  26 testes aprovados, sem falhas ou testes ignorados.
- Depois de corrigir a ordem, `electron-builder --prepackaged dist/win-unpacked --publish never`
  concluiu a geração do instalador local 2.4.23. Reutilizou o aplicativo e as DLLs
  do build local, sem recompilar os binários nativos. Os cinco recursos DLL foram
  conferidos por hash contra os assets, e `dist/integrity.json` foi gerado no mesmo
  formato usado pelo build. O instalador não foi executado nessa verificação.

## Regressão de compilação identificada em 03/11

O build completo revelou um caso que os 24 testes iniciais não cobriam: os
harnesses de execução substituíam a consulta externa de processos por respostas
simuladas e não verificavam o momento em que nsProcess ficava disponível para o
compilador. A falha foi reproduzida tanto no electron-builder quanto no novo teste
de compilação, antes da correção para `customHeader`. Esse teste deve continuar
usando o plugin real e nunca executar o fixture de instalação.

## Validação obrigatória antes da publicação

```powershell
npm run build
npm run test:installer
```

`test:installer` executa os 26 testes relacionados com
`MERLIN_REQUIRE_NSIS_TESTS=1`. O teste de compilação real falha se o compilador,
os includes ou o plugin não estiverem disponíveis; não pode aprovar a entrega
ignorando essa verificação. O build anterior fornece o cache NSIS usado no teste.

O fluxo de release do GitHub executa essa validação depois do build e antes de
criar a tag ou publicar a release. Os testes de compilação não executam os EXEs
gerados. Os testes de fechamento substituem apenas os comandos externos, e os
testes de cópia usam arquivos temporários.

Ao mudar a ordem dos includes, o hook `customHeader`, a detecção de processos ou
a lista de DLLs, manter os testes de compilação, encerramento e cópia passando.
Não substituir a compilação real por uma simulação do plugin. A correção do
instalador não altera os dados de conta, os arquivos Lua ou os manifestos.

## Como testar a entrega

Esta é uma alteração no instalador NSIS. `npm run start` não exercita esse código.
É necessário testar o instalador novo com Steam aberta, Steam fechada e
atualização do Merlin existente. A versão do pacote permanece a mesma; o workflow
recebeu a validação obrigatória descrita acima. Não houve publicação de release.

## Comparação com o LuaTools

Fonte analisada: `madoiscool/LuaTools`, commit
`946125981a7addb6150e83886443cc8ddb68931b`. O HEAD local foi comparado ao HEAD
remoto em 03/11/2026 e era o mesmo. A análise não executou instaladores nem
encerrou a Steam.

- O aplicativo usa Velopack; a cópia das DLLs da Steam ocorre dentro do app,
  pelo fluxo de instalação/reinstalação de modo, não por um hook NSIS.
- `ModeViewModel.cs:390` chama `StopSteam()` antes de `InstallAsync()`.
  `SteamService.cs:162` enumera processos `steam`, encerra a árvore e aguarda
  `WaitForExit(8000)`. Captura exceções sem propagá-las e não verifica o retorno
  da espera; portanto esse código não prova que sempre consegue fechar a Steam.
- `UnlockerService.cs:293` copia `dwmapi.dll`, `xinput1_4.dll` e
  `OpenSteamTool.dll` para a raiz da Steam. Faz uma tentativa por arquivo,
  acumula os nomes que falharam e retorna erro. Não há retentativa de cópia
  nem nova verificação do processo imediatamente antes de copiar nesse fluxo.
- No fluxo específico do plugin, `PluginInstallerService.cs:373` fecha a Steam
  e espera mais 1.200 ms antes de copiar os loaders. Compara hashes para evitar
  substituir DLLs iguais. Essa pausa pertence ao plugin; não atribuir a todos
  os fluxos de instalação do LuaTools.
- Não foram encontradas exclusões de antivírus nem alterações de ACL para
  instalar DLLs. O `runas` encontrado em `HttpServerService.cs` configura uma
  reserva HTTP local, não a cópia de DLLs.
- O instalador LuaTools disponível localmente (FileVersion 1.3.1) foi conferido
  com `Get-AuthenticodeSignature`: `NotSigned`, assim como o instalador Merlin
  2.4.23 consultado. Isso confirma esses binários, não todas as releases.

A falta de assinatura não foi estabelecida como causa da falha de cópia. O
relato de cópia manual funcionar com Steam fechada e a comparação do código
reforçam testar primeiro o encerramento no instalador corrigido. O mecanismo
de assinatura/reputação do SmartScreen é distinto da espera pelo encerramento
do processo e da informação de erro retornada pela cópia.

Referências: [nsProcess](https://nsis.sourceforge.io/NsProcess_plugin),
[CopyFileW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-copyfilew),
[LuaTools SteamService](https://github.com/madoiscool/LuaTools/blob/946125981a7addb6150e83886443cc8ddb68931b/src/LuaToolsGui/Services/SteamService.cs),
[SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

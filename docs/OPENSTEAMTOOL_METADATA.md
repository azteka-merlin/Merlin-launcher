# OpenSteamTool metadata bootstrap

Ferramenta isolada para gerar arquivos TOML de `pattern` e `ipc` sem mexer no fluxo principal do Merlin.

## Objetivo

- gerar `pattern` automaticamente a partir das signatures conhecidas;
- calcular o `sha256` das DLLs e escrever os TOMLs no layout esperado;
- preparar um fluxo simples para `ipc`, usando dados confirmados no Ghidra/export manual.

## Estrutura

- `scripts/opensteamtool-metadata/pattern-definitions.js`: signatures conhecidas de `steamclient64.dll` e `steamui.dll`.
- `scripts/opensteamtool-metadata/ipc-definitions.js`: interfaces e `argc` fixos das seis chamadas usadas pelo Merlin.
- `scripts/opensteamtool-metadata/ghidra-ipc.example.json`: exemplo do formato de entrada para gerar o TOML IPC.
- `scripts/opensteamtool-metadata/cli.js`: comando principal.

## Comandos

Calcular hashes:

```bash
npm run metadata:opensteamtool -- hash --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --steamui "C:\\Program Files (x86)\\Steam\\steamui.dll"
```

Gerar TOMLs de `pattern`:

```bash
npm run metadata:opensteamtool -- pattern --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --steamui "C:\\Program Files (x86)\\Steam\\steamui.dll"
```

Gerar TOML de `ipc` a partir de um JSON preenchido com valores confirmados:

```bash
npm run metadata:opensteamtool -- ipc --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --input "scripts\\opensteamtool-metadata\\ghidra-ipc.example.json"
```

## Saida

Por padrao, os arquivos sao gerados em `tmp/opensteamtool-metadata/`, com subpastas `pattern/steamclient`, `pattern/steamui` e `ipc/`.

## Observacoes

- `pattern` sai pronto porque as signatures sao conhecidas e o script escaneia a DLL local.
- `ipc` ainda depende de valores confirmados do Ghidra, especialmente `vtable_rva`, `method_index`, `funcHash`, `wrapper_rva` e `fencepost`.
- `interface_id` e `argc` sao preenchidos automaticamente com base no schema atual do OpenSteamTool.

## Diagnosticos em producao

Quando os metadados de compatibilidade da Steam nao existem, sao invalidos ou faltam funcoes, a DLL desativa somente os hooks afetados e grava o motivo em `%LOCALAPPDATA%\Merlin\logs\merlin_steam_integration.log`. Nao ha popup para esses tres tipos de falha. O log funciona no build Release, independentemente do logger de Debug, e inclui horario UTC, build da Steam, hashes das DLLs e o caminho exato do TOML esperado para suporte. Se o hash da DLL nao puder ser calculado, o log diz que o nome do TOML e indeterminado. O arquivo principal gira ao atingir 1 MiB, preservando uma copia `.log.1`.

O aviso do instalador quando os arquivos da integracao nao puderem ser copiados para a Steam continua visivel, pois requer uma acao do usuario.

Na aba Configuracoes > Manutencao, **Copiar e salvar log de erros** exporta somente os avisos desse log das ultimas 24 horas. O launcher le tambem `merlin_steam_integration.log.1` quando a rotacao por tamanho ocorreu dentro desse periodo, copia o texto para a area de transferencia e abre um dialogo para salvar um TXT. Cancelar o dialogo mantem a copia na area de transferencia. Nenhum log e enviado automaticamente; revise o TXT antes de compartilhar com o suporte.

## Geracao local no Launcher

Quando o TOML remoto nao esta disponivel, o `merlin-helper.dll` tenta gerar o metadata a partir das DLLs da Steam instaladas. Assinaturas com varios resultados so sao desambiguadas por RVA conhecido para o SHA-256 exato da DLL; um RVA de outra versao nunca e reaproveitado automaticamente. Para o `steamclient64.dll` com SHA-256 `caba4826aa3501039d095aee1843a6bfb270fb43a3ab4455b2d6733223579fee`, `CUtlMemoryGrow` usa o RVA confirmado `0xE8400`. A geracao foi testada com essa DLL e produziu as 26 entradas do TOML de `pattern/steamclient`.

O `steamui.dll` e gerado separadamente. Para o SHA-256 `cb387adefbbac64a3c1490d4275d00daf3a1e0219b4580726ef7681db7429278`, o TOML local existente confirmou a nova assinatura e o RVA de `GetTopManager` (`0x611D80`) e o RVA de `RepeatedFieldUint32_Add` (`0x6D8340`). Esses valores tambem ficam restritos ao hash exato; outra versao precisa ser resolvida e validada novamente. A geracao com essa DLL foi testada e produziu as 10 entradas de `pattern/steamui`.

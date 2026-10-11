# Correcao especial com token de licenca

Este fluxo existe apenas para o AppID `4407750`. Ele esta separado de Premium: nao usa reserva, vaga, cooldown ou cota Premium.

## Jornada do usuario

1. O catalogo informa `activationType: "license_token"`, versao minima `1.6.8` e, quando configurada no override, `imageUrl`.
2. **Baixar** salva o ZIP original e nao tenta gerar token.
3. **Baixar e instalar** detecta o jogo pela Steam e/ou em `C:\Program Files\EA Games\EA SPORTS FC 27`, baixa/extrai o ZIP em diretorio temporario e le `%ProgramData%\Electronic Arts\EA Services\License\16425884_sc.dlf`.
4. O launcher envia apenas esse `.dlf` autenticado para `/fixes/license-token?appid=4407750` com `X-Merlin-Version`.
5. Antes de copiar qualquer arquivo para o jogo, exige exatamente um `anadius.cfg` com uma ocorrencia de `RETORNO_TOKEN_MERLIN`. `token.ini` nao e necessario.
6. O token substitui somente esse placeholder no `anadius.cfg`; depois os arquivos extraidos sao copiados para todas as instalacoes detectadas (Steam, EA App ou ambas) e os temporarios sao removidos.
7. No EA App, arquivos originais instalados sob `Program Files` podem exigir permissao administrativa para sobrescrita. O Launcher tenta a copia normal primeiro e solicita elevacao somente quando o Windows retorna `EPERM`/`EACCES` nesse destino.

## Regras e protecoes

- A versao real do app precisa ser `1.6.8` ou superior. Nao existe bypass de desenvolvimento para essa regra.
- O `.dlf` deve existir, ser arquivo regular, nao estar vazio e ter no maximo 1 MB.
- O Launcher nunca registra o conteudo do `.dlf` nem o token retornado.
- Cache antigo nao desativa o fluxo: o AppID e a protecao local definitiva para impedir a copia de templates sem preparar.
- `coverUrl` vem do override atraves do catalogo como `imageUrl`; o Launcher nao possui mapeamento de imagem por AppID.

## Falhas apresentadas

`launcher_update_required`, `license_file_missing`, `license_file_invalid`, `license_file_too_large`, `license_token_not_found`, `invalid_license_file`, `token_request_failed` e `token_templates_invalid` devem mostrar mensagens localizadas. Falha acontece antes da copia para o jogo.

## Staging

Use `npm run start:stage` para apontar o Launcher ao Worker staging. Atualize a lista de Correcoes apos alterar um override, pois o catalogo possui cache local. Para testar a instalacao completa, use um build cuja versao em `package.json` ja seja `1.6.8` ou maior.

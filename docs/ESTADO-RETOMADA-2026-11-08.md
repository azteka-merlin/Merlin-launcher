# Retomada do Merlin — 8 de novembro de 2026

Este é um registro de conferência, não uma garantia permanente de paridade. O pacote de migração de 31/10/2026 é histórico: confrontar suas regras com o código, o banco e os assets em uso antes de alterá-los. Não incluir credenciais neste repositório.

## Referências verificadas

- Launcher `97fcf79`, API `b1552aa`, Admin `39282e4`, Public `fddbadc` e worker `8f115cc`: os HEADs locais coincidiam com `master` no GitHub na consulta.
- `/api/updates/latest` anunciava Launcher 2.4.25, a mesma versão do `package.json`. O `integrity.json` da release 2.4.25 registra uma OpenSteamTool.dll com SHA-256 `2b12960aa4c1ae81289310997c6c395459706b64317f3997619252b022be064d`; a DLL modificada localmente tem hash diferente. O build da release recompila o componente nativo, portanto a diferença isolada não demonstra uma mudança funcional.
- O JavaScript do Admin publicado (`index-UIZbsPJd.js`) tinha o mesmo SHA-256 do `dist` local. O asset contém o filtro de migração presente na alteração não commitada de `OverridesPage.jsx`; não reconstruir o painel a partir do commit ignorando essa alteração.
- O JavaScript `app.js` publicado do Public tinha o mesmo SHA-256 do build local feito nesta conferência.
- No D1 de produção, a última migration registrada era `0099_fix_import_source_tags.sql`, também a última do diretório local. A verificação das cinco últimas não comprova, sozinha, a integridade de todas as migrations ou do esquema.
- Wrangler autenticado. A última versão da API listada para produção foi criada em 07/11/2026 às 23:27 UTC; não foi comprovada sua equivalência com o código local. Deploys anteriores podem ter sido feitos a partir de worktrees com alterações não commitadas.

## Alterações locais a preservar

- Launcher: `assets/dlls/OpenSteamTool.dll` e `config.json` modificados. A configuração inclui estado local do aplicativo; não incluí-la automaticamente em release. Rascunhos JSON para preencher o changelog no Admin são locais e não devem ser commitados.
- API: Git sinalizou modificações em `src/lib/premium-d1-runtime.test.ts` e `src/lib/premium-flow.integration.test.ts`, mas os hashes normalizados dos arquivos coincidem com o índice; a diferença observada era de finais de linha CRLF na cópia de trabalho.
- Admin: `src/pages/OverridesPage.jsx` não commitado adiciona filtro para overrides migrados e revisados, já visível no asset publicado.
- Public e worker: status Git limpo na conferência. `Merlin-Test` tem alterações próprias e não deve ser tratado como fonte operacional sem análise.

## Validação executada

- Launcher: `npm test`, 413 testes passaram.
- API: `npm test`, 552 testes Vitest e 23 testes do indexador passaram; `npm run typecheck` passou.
- Public: `npm run verify`, typecheck, 42 testes e build passaram. O build avisou sobre tamanho de chunk acima de 500 kB.

Não houve deploy, migration ou restauração de banco nesta conferência. Antes de uma atualização, comparar novamente o deployment e os assets efetivamente servidos com o conteúdo a publicar; preservar as pendências e executar os gates atuais, em especial o gate Premium obrigatório da API. O resultado dos testes não demonstra paridade do Worker implantado.

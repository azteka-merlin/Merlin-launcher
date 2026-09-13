# Merlin Documentation Index

Documentacao de contexto para manter o trabalho entre launcher, API/cadastro publico e painel admin alinhado.

Use este arquivo como roteador. Nao abra todos os `.md` por padrao; escolha o menor doc que responde a tarefa.

## Hierarquia de leitura

1. `UP.md` — rodar, validar, buildar, publicar e checar release.
2. `ENVIRONMENTS.md` — local/staging/producao para launcher, API/cadastro publico e admin.
3. `ARCHITECTURE.md` — arquitetura, IPC, Steam, downloads, updates e build nativo.
4. `BUSINESS_RULES.md` — regras de negocio observadas no launcher.
5. `CODE_PATTERNS.md` — padroes de codigo e testes.
6. `CHANGE_GUARDRAILS.md` — regras para nao quebrar comportamento atual.
7. `CONTEXT.md` — resumo geral quando voce precisa se localizar no projeto.
8. `OPENSTEAMTOOL_METADATA.md` — geracao de metadados locais do OpenSteamTool.
9. `features/README.md` — mapa modular de funcionalidades, contratos e regras para a futura troca de front-end.

## Regra rapida

- Para setup/build/release, comece e pare em `UP.md` se ele for suficiente.
- Para endpoint, staging ou API base URL, abra `ENVIRONMENTS.md`.
- Para mexer em fluxo do app, Steam, DLLs, IPC ou update, abra `ARCHITECTURE.md` e depois `CHANGE_GUARDRAILS.md`.
- Para regra de produto, abra `BUSINESS_RULES.md`.
- Para trocar ou redesenhar o renderer, comece por `features/README.md` e depois consulte `ARCHITECTURE.md` e `CHANGE_GUARDRAILS.md`.
- Para padrao de teste/codigo, abra `CODE_PATTERNS.md`.

## Politica

Antes de mudar comportamento, consultar `CHANGE_GUARDRAILS.md`.

Projeto open source: exemplos devem usar placeholders. Nunca colocar segredo, token, credencial, email privado, path pessoal ou dado real em MD/codigo.

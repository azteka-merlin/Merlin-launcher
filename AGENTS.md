# Instruções complementares do Merlin Launcher

Consulte primeiro `docs/README.md` e `docs/CHANGE_GUARDRAILS.md`, e preserve as instruções e preferências mais específicas do usuário. O toolkit opcional pode estar na pasta irmã `../agent-toolkit/skills`; se não existir, prossiga com as instruções e ferramentas disponíveis, sem instalar nada automaticamente.

Quando forem pertinentes à tarefa, leia o `SKILL.md` correspondente antes de usar suas orientações:

- `c4-architecture` e `mermaid-diagrams`: documentação e diagramas de arquitetura ou fluxos.
- `database-schema-designer`: planejamento de dados, constraints, índices e migrações; adapte os exemplos à tecnologia efetiva, em especial SQLite/D1.
- `react-dev` e `react-useeffect`: apenas para mudanças React pertinentes no Admin ou Public; não pressupor que o renderer Electron use React.
- `backend-to-frontend-handoff-docs` e `frontend-to-backend-requirements`: contratos e handoff, quando a etapa e o gatilho da própria skill se aplicarem.
- `commit-work`: quando solicitado trabalho de commit, respeitando os pedidos específicos do usuário e as regras do repositório.

`qa-test-planner` declara ativação somente por chamada explícita pelo nome; não acioná-la automaticamente. Não invocar skills apenas por existirem nem executar seus scripts, ferramentas externas ou serviços sem necessidade e autorização pertinente. Skills não substituem as regras de negócio, documentação técnica atual ou confirmação do comportamento pelo código. Não copiar dados de produção para testes, nem publicar, executar migrations ou modificar a operação por causa destas instruções.

## Regras de planejamento e investigação

- Não usar `gepetto` no trabalho do sistema de status sem uma necessidade concreta.
- Não criar diagramas apenas para enfeitar o planejamento; acrescentá-los somente quando ajudarem a esclarecer uma decisão ou um fluxo.
- Priorizar experimentos seguros e medições reais para resolver dúvidas técnicas, respeitando o escopo autorizado e sem testes agressivos em serviços de produção.

# Funcionalidades do Launcher

Mapa de referencia para manter comportamento durante a reconstrucao do front-end. Cada modulo descreve o contrato atual, regras, estados e falhas que a nova interface deve preservar.

| Dominio | Documento | Responsabilidade |
| --- | --- | --- |
| Sessao e configuracao | [auth-and-settings.md](auth-and-settings.md) | licenca, sessao segura, assinatura, idioma e Steam configurado |
| Jogos e Steam | [games-and-steam.md](games-and-steam.md) | busca, fila, manifests, Lua, auto-update, DLLs e readiness |
| Biblioteca | [library.md](library.md) | jogos gerenciados, cache, remocao segura e pastas Steam |
| Corrections e Premium | [content-activation.md](content-activation.md) | catalogos, votos, downloads, ativacoes, cancelamento e seguranca de arquivos |
| Experiencia do app | [app-experience.md](app-experience.md) | navegacao, modais, avisos, enquetes, anuncios, update e links externos |
| Efeitos do Admin | [admin-impact.md](admin-impact.md) | cada configuracao administrativa que altera a experiencia ou permissao do launcher |
| Contratos da API | [api-impact.md](api-impact.md) | rotas da API consumidas, efeitos indiretos e rotas fora do Electron atual |
| Integracao do front | [frontend-contract.md](frontend-contract.md) | IPC, eventos, estados transversais e roteiro de migracao |

## Regra de uso

Antes de mexer numa area, leia seu modulo e `../CHANGE_GUARDRAILS.md`. Mudanca em payload/canal IPC exige atualizar o modulo correspondente, `preload.js`, main e os testes de contrato.

Toda troca de front tambem deve cumprir o bloco **Compatibilidade com staging** em `frontend-contract.md`.

Este material descreve o comportamento existente; nao autoriza alteracao de regra de produto.

# Entrega do frontend desacoplado

Esta branch prepara o launcher para receber um artefato de interface já
compilado. O comportamento legado continua sendo o padrão até que a nova
interface seja explicitamente conectada em uma mudança posterior.

## Artefato imutável

O repositório `Merlin-launcher-frontend` gera um `dist/` e recebe uma tag, como
`v0.1.0`. Um release do launcher registra essa tag como sua versão de frontend.
Nunca use `main`, uma branch ou “latest” em um release.

## Preparação de um pacote

```powershell
$env:MERLIN_FRONTEND_VERSION = 'v0.1.0'
npm run frontend:sync -- C:\caminho\para\Merlin-launcher-frontend\dist
npm run build
```

O comando valida a existência de `index.html`, copia o artefato para a pasta
local `frontend/` e grava a versão incorporada em `.merlin-frontend.json`. Essa
pasta entra no pacote Electron, mas ainda não muda qual interface é carregada.

## Garantias

- A `master` segue adequada para hotfixes do launcher legado.
- O processo principal e o `preload` continuam donos de ambiente, IPC, Steam,
  arquivos e regras de negócio.
- A nova UI só poderá falar com as APIs explicitamente expostas pelo preload.
- Staging é testado pelo Electron com `MERLIN_API_BASE_URL`; o frontend não fixa
  URL de produção.

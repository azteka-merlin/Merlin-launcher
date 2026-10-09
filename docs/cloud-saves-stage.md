# Nuvem de saves (piloto stage)

## Escopo

Este piloto sincroniza apenas jogos adicionados pelo Merlin que possuam suporte a Steam Cloud e um arquivo Lua principal ativo (`addappid` do próprio AppID). Jogos comprados continuam no Steam Cloud oficial. Jogos sem Steam Cloud não ganham suporte automaticamente. A sincronização é opt-in e só pode ser ativada com o Launcher apontando para `https://staging.api-merlin.com/api`.

Os saves remotos são organizados pelo account ID da Steam e pelo AppID, não pela licença Merlin. Uma licença ativa autoriza a conexão temporária ao gateway, mas não faz parte do caminho do save. Nesta fase, o account ID vem da integração com a Steam e não é verificado por Steam OpenID; essa é uma limitação de segurança conhecida do piloto. Não publicar para usuários gerais antes de decidir como validar a identidade Steam.

Quando uma correção ou integração Premium faz o jogo gravar em uma pasta com um SteamID diferente do da conta ativa, o nome dessa pasta **não** é usado como dono do save remoto. A DLL aceita uma pasta alternativa com arquivos correspondentes à regra Steam Cloud quando seu `steam_autocloud.vdf` aponta para a conta Steam ativa. Alguns jogos, como Elliot, não criam esse marcador na pasta alternativa: nesse caso a DLL exige o marcador da conta ativa na pasta canônica, um save alternativo modificado depois desse marcador e uma única pasta candidata. Marcadores de outra conta e múltiplas pastas candidatas bloqueiam a associação automática. Ela registra o caminho por conta real, AppID e regra UFS em `%LOCALAPPDATA%\Merlin\cloud\save-paths\`, para poder restaurar depois que os arquivos do jogo forem removidos. A mesma regra de caminho é aplicada ao scanner de upload e à regra de download em memória da Steam.

## Componentes

- O Launcher solicita uma credencial S3 **temporária** à API stage, renova a autorização a cada cinco minutos enquanto permanece ativo e grava apenas no perfil local de Windows em `%LOCALAPPDATA%\Merlin\cloud\`.
- `OpenSteamTool.dll` carrega `merlin_cloud_redirect.dll` apenas quando a configuração de teste está ativada. O CloudRedirect foi incluído sob licença MIT, a partir do commit `00969da863c8d7b2e2821ebc2c6cb231bbe56ef2` (v2.6.6). Seus caminhos locais foram isolados dos de uma instalação independente do CloudRedirect.
- A DLL fala com o gateway S3 da API stage. Ela **não** recebe chave de R2. O gateway valida a assinatura SigV4 e a licença, e grava no bucket R2 já existente, sob `cloud-sync/stage/steam/<account-id>/<appid>/`.
- A API guarda uma cópia de recuperação fora do namespace S3 antes de sobrescrever ou excluir um objeto. O gateway não expõe as cópias de recuperação ao cliente.
- O Launcher deve continuar aberto, mesmo em segundo plano, para renovar a autorização. A Steam precisa ser reiniciada após ativar/desativar para que a DLL releia a configuração.

## Teste manual seguro

1. Faça uma cópia do save importante em outra pasta antes do teste. O mecanismo upstream é experimental; não use primeiro num progresso insubstituível.
2. Feche o Merlin instalado. No checkout de desenvolvimento, execute `npm run start:stage`, faça login numa licença stage válida e use **Configurações → Saves na nuvem → Ativar sincronização**.
3. Confirme o fechamento da Steam se ela estiver aberta. O Launcher instala ou atualiza os arquivos necessários automaticamente, sem usar **Reparar**. Se a Steam estava aberta, aceite reabri-la ao final; caso contrário, abra-a manualmente. Confirme que o Launcher continua aberto na bandeja.
4. Escolha um jogo **adicionado pelo Merlin** que tenha Steam Cloud. Jogue, salve, encerre o jogo e espere a sincronização terminar antes de mexer no arquivo. Consulte `<pasta da Steam>\merlin_cloud_redirect.log` para diagnosticar upload/listagem/download.
5. Só então mova o save original para uma pasta de backup (em vez de excluí-lo permanentemente) e inicie o jogo outra vez. O save deve voltar. Se não voltar, restaure imediatamente o backup.

Apagar apenas o save do diretório do jogo pode fazer o mecanismo restaurá-lo do cache local da DLL; isso **não prova** que o R2 foi usado. Uma prova completa exige confirmar os objetos em `cloud-sync/stage/steam/...` e, de preferência, repetir em outro PC com a mesma conta Steam, outra licença stage válida e sem o cache local do CloudRedirect.

Para testar uma pasta alternativa, confirme no log `Merlin save path: ... uses an alternate local SteamID folder` e a presença do registro correspondente em `save-paths` antes de mover o save para backup. A detecção inicial usa um save local com marcador da conta ativa ou, se faltar o marcador na pasta alternativa, um save único mais novo que o marcador da pasta canônica; num PC novo, pode usar um caminho único encontrado **no manifesto remoto dessa mesma conta**. Se houver caminhos candidatos conflitantes ou um marcador de outra conta, não escolhe um alias automaticamente. Não apague um save único com base apenas nos testes unitários: a restauração ainda precisa ser confirmada com Steam e R2 reais.

## Limites e falhas

- O gateway aceita até 32 MiB por requisição e multipart em partes de 8 MiB. Há um limite piloto de 2 GiB enviados por credencial/dia.
- Falha de conexão ou credencial expirada não bloqueia a inicialização do jogo; os saves continuam locais e a UI indica que a conexão precisa ser renovada. A DLL mantém um diário local de operações pendentes.
- Desativar ou sair da conta revoga a credencial quando possível. Mesmo se a revogação falhar, a autorização expira em até 20 minutos. O logout suspende a conexão e desativa a configuração nativa, mas preserva a escolha do usuário. No próximo login, o Launcher reconecta automaticamente; se a Steam estiver aberta, oferece reiniciá-la para carregar a configuração. O botão **Desativar** remove a preferência.
- Se o Merlin de produção abrir usando o mesmo perfil Windows após um teste stage, ele desativa a configuração piloto e remove a credencial local de stage. Reinicie a Steam para que a DLL carregada descarte a configuração anterior.
- O stage usa o bucket `merlin-files` compartilhado, isolado pelo prefixo `cloud-sync/stage/`. Não há acesso à rota em produção nesta versão.

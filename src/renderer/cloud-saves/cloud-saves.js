(() => {
    const messages = {
        ptbr: {
            cloud_open_games: 'Ver jogos sincronizados', cloud_description: 'Seus saves dos jogos adicionados pelo Merlin são sincronizados automaticamente entre seus computadores. Seus jogos comprados continuam usando normalmente o Steam Cloud.', cloud_on: 'ATIVADA', cloud_off: 'DESATIVADA', cloud_toggle_label: 'Sincronização automática', cloud_toggle_description: 'Mantém seus saves sincronizados entre computadores.', cloud_saves_title: 'Saves sincronizados', cloud_saves_subtitle: 'Veja os jogos que utilizam a nuvem do Merlin.', cloud_saves_back_settings: 'Configuração', cloud_saves_search_label: 'Buscar jogos sincronizados', cloud_saves_search_placeholder: 'Buscar jogo...', cloud_saves_loading: 'Carregando jogos sincronizados…', cloud_saves_error: 'Não foi possível carregar seus jogos sincronizados.', cloud_saves_retry: 'Tentar novamente', cloud_saves_empty_title: 'Nenhum save sincronizado ainda', cloud_saves_empty_description: 'Quando um jogo adicionado pelo Merlin utilizar Steam Cloud e possuir saves, ele aparecerá aqui.', cloud_saves_no_results_title: 'Nenhum jogo encontrado', cloud_saves_no_results_description: 'Tente buscar por outro nome.', cloud_saves_back: 'Voltar para jogos', cloud_saves_current_title: 'Versão atual', cloud_saves_synced: 'Sincronizada', cloud_saves_backups_title: 'Backups disponíveis', cloud_saves_backups_hint: 'Até 2 backups por jogo', cloud_saves_no_backups: 'Nenhum backup disponível. Seu save atual continua sendo sincronizado normalmente.', cloud_saves_restore_notice: 'A Steam precisa estar fechada para restaurar uma versão anterior.', cloud_saves_backup_item: 'Backup de {date}', cloud_saves_file_one: '{count} arquivo · {size}', cloud_saves_file_many: '{count} arquivos · {size}', cloud_saves_last_sync: 'Sincronizado: {date}', cloud_saves_backup_one: '{count} backup disponível', cloud_saves_backup_many: '{count} backups disponíveis', cloud_saves_restore: 'Restaurar', cloud_saves_restore_title: 'Restaurar este backup?', cloud_saves_restore_message: 'O save atual será substituído pela versão escolhida. A Steam deve permanecer fechada durante a restauração.', cloud_saves_restore_action: 'Restaurar backup', cloud_saves_restoring: 'Restaurando…', cloud_saves_restored: 'Versão restaurada. Abra a Steam para o jogo sincronizar os arquivos.', cloud_saves_error_steam_running: 'Feche a Steam antes de restaurar uma versão anterior.', cloud_saves_error_account: 'Não foi possível identificar sua conta Steam agora.', cloud_saves_error_generic: 'Não foi possível concluir esta operação. Tente novamente.', cloud_saves_synced_files_one: '{count} arquivo sincronizado', cloud_saves_synced_files_many: '{count} arquivos sincronizados'
        },
        en: {
            cloud_open_games: 'View synced games', cloud_description: 'Saves from Merlin-added games are synchronized automatically across your computers. Purchased games continue using Steam Cloud normally.', cloud_on: 'ENABLED', cloud_off: 'DISABLED', cloud_toggle_label: 'Automatic synchronization', cloud_toggle_description: 'Keeps your saves synchronized across computers.', cloud_saves_title: 'Synced saves', cloud_saves_subtitle: 'See which games use the Merlin cloud.', cloud_saves_back_settings: 'Settings', cloud_saves_search_label: 'Search synced games', cloud_saves_search_placeholder: 'Search games...', cloud_saves_loading: 'Loading synced games…', cloud_saves_error: 'Could not load your synced games.', cloud_saves_retry: 'Try again', cloud_saves_empty_title: 'No synced saves yet', cloud_saves_empty_description: 'A Merlin-added game will appear here after it uses Steam Cloud and has saves.', cloud_saves_no_results_title: 'No games found', cloud_saves_no_results_description: 'Try another name.', cloud_saves_back: 'Back to games', cloud_saves_current_title: 'Current version', cloud_saves_synced: 'Synchronized', cloud_saves_backups_title: 'Available backups', cloud_saves_backups_hint: 'Up to 2 backups per game', cloud_saves_no_backups: 'No backup available. Your current save will continue syncing normally.', cloud_saves_restore_notice: 'Steam must be closed to restore an earlier version.', cloud_saves_backup_item: 'Backup from {date}', cloud_saves_file_one: '{count} file · {size}', cloud_saves_file_many: '{count} files · {size}', cloud_saves_last_sync: 'Synced: {date}', cloud_saves_backup_one: '{count} backup available', cloud_saves_backup_many: '{count} backups available', cloud_saves_restore: 'Restore', cloud_saves_restore_title: 'Restore this backup?', cloud_saves_restore_message: 'The current save will be replaced by the selected version. Steam must stay closed during the restore.', cloud_saves_restore_action: 'Restore backup', cloud_saves_restoring: 'Restoring…', cloud_saves_restored: 'Version restored. Open Steam so the game can sync the files.', cloud_saves_error_steam_running: 'Close Steam before restoring an earlier version.', cloud_saves_error_account: 'Could not identify your Steam account right now.', cloud_saves_error_generic: 'Could not complete this operation. Try again.', cloud_saves_synced_files_one: '{count} synced file', cloud_saves_synced_files_many: '{count} synced files'
        },
        es: {
            cloud_open_games: 'Ver juegos sincronizados', cloud_saves_title: 'Sincronización de partidas', cloud_saves_subtitle: 'Consulta tus juegos sincronizados y recupera una versión anterior cuando lo necesites.', cloud_saves_search_label: 'Buscar juegos sincronizados', cloud_saves_search_placeholder: 'Buscar juego...', cloud_saves_loading: 'Cargando juegos sincronizados…', cloud_saves_error: 'No se pudieron cargar tus juegos sincronizados.', cloud_saves_retry: 'Reintentar', cloud_saves_empty_title: 'Aún no hay juegos sincronizados', cloud_saves_empty_description: 'Los juegos compatibles aparecerán aquí después de guardar en la nube.', cloud_saves_no_results_title: 'No se encontraron juegos', cloud_saves_no_results_description: 'Prueba con otro nombre.', cloud_saves_back: 'Volver a juegos', cloud_saves_current_title: 'Versión actual', cloud_saves_backups_title: 'Versiones anteriores', cloud_saves_backups_hint: 'Hasta 2 copias por juego', cloud_saves_no_backups: 'No hay una versión anterior disponible.', cloud_saves_restore_notice: 'Steam debe estar cerrado para restaurar una versión anterior.', cloud_saves_backup_item: 'Copia del {date}', cloud_saves_file_count: '{count} archivo(s) · {size}', cloud_saves_last_sync: 'Última sincronización: {date}', cloud_saves_backup_count: '{count} copia(s)', cloud_saves_restore: 'Restaurar esta versión', cloud_saves_restore_title: '¿Restaurar una versión anterior?', cloud_saves_restore_message: 'Los archivos actuales del juego se sustituirán por la versión elegida. Steam debe permanecer cerrado durante la restauración.', cloud_saves_restore_action: 'Restaurar', cloud_saves_restoring: 'Restaurando…', cloud_saves_restored: 'Versión restaurada. Abre Steam para que el juego sincronice los archivos.', cloud_saves_error_steam_running: 'Cierra Steam antes de restaurar una versión anterior.', cloud_saves_error_account: 'No se pudo identificar tu cuenta de Steam.', cloud_saves_error_generic: 'No se pudo completar la operación. Inténtalo de nuevo.', cloud_saves_synced_files: '{count} archivo(s) sincronizado(s)'
        },
        fr: {
            cloud_open_games: 'Voir les jeux synchronisés', cloud_saves_title: 'Synchronisation des sauvegardes', cloud_saves_subtitle: 'Consultez les jeux synchronisés et restaurez une version précédente si nécessaire.', cloud_saves_search_label: 'Rechercher des jeux synchronisés', cloud_saves_search_placeholder: 'Rechercher un jeu...', cloud_saves_loading: 'Chargement des jeux synchronisés…', cloud_saves_error: 'Impossible de charger vos jeux synchronisés.', cloud_saves_retry: 'Réessayer', cloud_saves_empty_title: 'Aucun jeu synchronisé', cloud_saves_empty_description: 'Les jeux compatibles apparaîtront ici après leur sauvegarde dans le cloud.', cloud_saves_no_results_title: 'Aucun jeu trouvé', cloud_saves_no_results_description: 'Essayez un autre nom.', cloud_saves_back: 'Retour aux jeux', cloud_saves_current_title: 'Version actuelle', cloud_saves_backups_title: 'Versions précédentes', cloud_saves_backups_hint: 'Jusqu’à 2 sauvegardes par jeu', cloud_saves_no_backups: 'Aucune version précédente disponible.', cloud_saves_restore_notice: 'Steam doit être fermé pour restaurer une version précédente.', cloud_saves_backup_item: 'Sauvegarde du {date}', cloud_saves_file_count: '{count} fichier(s) · {size}', cloud_saves_last_sync: 'Dernière synchronisation : {date}', cloud_saves_backup_count: '{count} sauvegarde(s)', cloud_saves_restore: 'Restaurer cette version', cloud_saves_restore_title: 'Restaurer une version précédente ?', cloud_saves_restore_message: 'Les fichiers actuels du jeu seront remplacés par la version choisie. Steam doit rester fermé pendant la restauration.', cloud_saves_restore_action: 'Restaurer', cloud_saves_restoring: 'Restauration…', cloud_saves_restored: 'Version restaurée. Ouvrez Steam pour synchroniser les fichiers du jeu.', cloud_saves_error_steam_running: 'Fermez Steam avant de restaurer une version précédente.', cloud_saves_error_account: 'Impossible d’identifier votre compte Steam.', cloud_saves_error_generic: 'Impossible de terminer cette opération. Réessayez.', cloud_saves_synced_files: '{count} fichier(s) synchronisé(s)'
        },
        de: {
            cloud_open_games: 'Synchronisierte Spiele anzeigen', cloud_saves_title: 'Spielstände synchronisieren', cloud_saves_subtitle: 'Synchronisierte Spiele ansehen und bei Bedarf eine frühere Version wiederherstellen.', cloud_saves_search_label: 'Synchronisierte Spiele suchen', cloud_saves_search_placeholder: 'Spiel suchen...', cloud_saves_loading: 'Synchronisierte Spiele werden geladen…', cloud_saves_error: 'Synchronisierte Spiele konnten nicht geladen werden.', cloud_saves_retry: 'Erneut versuchen', cloud_saves_empty_title: 'Noch keine synchronisierten Spiele', cloud_saves_empty_description: 'Kompatible Spiele erscheinen hier, sobald sie in der Cloud gespeichert wurden.', cloud_saves_no_results_title: 'Keine Spiele gefunden', cloud_saves_no_results_description: 'Versuche einen anderen Namen.', cloud_saves_back: 'Zurück zu den Spielen', cloud_saves_current_title: 'Aktuelle Version', cloud_saves_backups_title: 'Frühere Versionen', cloud_saves_backups_hint: 'Bis zu 2 Backups pro Spiel', cloud_saves_no_backups: 'Keine frühere Version verfügbar.', cloud_saves_restore_notice: 'Steam muss geschlossen sein, um eine frühere Version wiederherzustellen.', cloud_saves_backup_item: 'Backup vom {date}', cloud_saves_file_count: '{count} Datei(en) · {size}', cloud_saves_last_sync: 'Letzte Synchronisierung: {date}', cloud_saves_backup_count: '{count} Backup(s)', cloud_saves_restore: 'Diese Version wiederherstellen', cloud_saves_restore_title: 'Frühere Version wiederherstellen?', cloud_saves_restore_message: 'Die aktuellen Dateien dieses Spiels werden durch die ausgewählte Version ersetzt. Steam muss während der Wiederherstellung geschlossen bleiben.', cloud_saves_restore_action: 'Wiederherstellen', cloud_saves_restoring: 'Wird wiederhergestellt…', cloud_saves_restored: 'Version wiederhergestellt. Öffne Steam, damit das Spiel die Dateien synchronisieren kann.', cloud_saves_error_steam_running: 'Schließe Steam, bevor du eine frühere Version wiederherstellst.', cloud_saves_error_account: 'Dein Steam-Konto konnte nicht ermittelt werden.', cloud_saves_error_generic: 'Dieser Vorgang konnte nicht abgeschlossen werden. Versuche es erneut.', cloud_saves_synced_files: '{count} synchronisierte Datei(en)'
        }
    };

    Object.assign(messages.es, { cloud_description: 'Las partidas de los juegos añadidos por Merlin se sincronizan automáticamente entre tus ordenadores. Los juegos comprados siguen usando Steam Cloud normalmente.', cloud_on: 'ACTIVADA', cloud_off: 'DESACTIVADA', cloud_toggle_label: 'Sincronización automática', cloud_toggle_description: 'Mantiene tus partidas sincronizadas entre ordenadores.', cloud_saves_file_one: '{count} archivo · {size}', cloud_saves_file_many: '{count} archivos · {size}', cloud_saves_backup_one: '{count} copia disponible', cloud_saves_backup_many: '{count} copias disponibles', cloud_saves_synced_files_one: '{count} archivo sincronizado', cloud_saves_synced_files_many: '{count} archivos sincronizados' });
    Object.assign(messages.fr, { cloud_description: 'Les sauvegardes des jeux ajoutés par Merlin sont synchronisées automatiquement entre vos ordinateurs. Les jeux achetés continuent d’utiliser Steam Cloud normalement.', cloud_on: 'ACTIVÉE', cloud_off: 'DÉSACTIVÉE', cloud_toggle_label: 'Synchronisation automatique', cloud_toggle_description: 'Garde vos sauvegardes synchronisées entre ordinateurs.', cloud_saves_file_one: '{count} fichier · {size}', cloud_saves_file_many: '{count} fichiers · {size}', cloud_saves_backup_one: '{count} sauvegarde disponible', cloud_saves_backup_many: '{count} sauvegardes disponibles', cloud_saves_synced_files_one: '{count} fichier synchronisé', cloud_saves_synced_files_many: '{count} fichiers synchronisés' });
    Object.assign(messages.de, { cloud_description: 'Spielstände von Merlin-Spielen werden automatisch zwischen deinen Computern synchronisiert. Gekaufte Spiele verwenden weiterhin die Steam Cloud.', cloud_on: 'AKTIVIERT', cloud_off: 'DEAKTIVIERT', cloud_toggle_label: 'Automatische Synchronisierung', cloud_toggle_description: 'Hält deine Spielstände zwischen Computern synchronisiert.', cloud_saves_file_one: '{count} Datei · {size}', cloud_saves_file_many: '{count} Dateien · {size}', cloud_saves_backup_one: '{count} Backup verfügbar', cloud_saves_backup_many: '{count} Backups verfügbar', cloud_saves_synced_files_one: '{count} synchronisierte Datei', cloud_saves_synced_files_many: '{count} synchronisierte Dateien' });
    Object.assign(messages.ptbr, { cloud_description: 'Mantenha seu progresso sincronizado entre computadores nos jogos adicionados pelo Merlin. Seus jogos comprados continuam usando o Steam Cloud normalmente.', cloud_toggle_aria: 'Ativar ou desativar a sincronização de saves' });
    Object.assign(messages.en, { cloud_description: 'Keep your progress synced across computers for Merlin-added games. Purchased games continue using Steam Cloud normally.', cloud_toggle_aria: 'Enable or disable save synchronization' });
    Object.assign(messages.es, { cloud_description: 'Mantén tu progreso sincronizado entre ordenadores en los juegos añadidos por Merlin. Los juegos comprados siguen usando Steam Cloud normalmente.', cloud_toggle_aria: 'Activar o desactivar la sincronización de partidas' });
    Object.assign(messages.fr, { cloud_description: 'Gardez votre progression synchronisée entre ordinateurs pour les jeux ajoutés par Merlin. Les jeux achetés continuent d’utiliser Steam Cloud normalement.', cloud_toggle_aria: 'Activer ou désactiver la synchronisation des sauvegardes' });
    Object.assign(messages.de, { cloud_description: 'Halte deinen Fortschritt auf Merlin-Spielen zwischen Computern synchron. Gekaufte Spiele verwenden weiterhin Steam Cloud.', cloud_toggle_aria: 'Synchronisierung der Spielstände aktivieren oder deaktivieren' });
    Object.assign(messages.ptbr, { cloud_saves_restore_notice: 'Feche o jogo antes de restaurar. A Steam pode continuar aberta.', cloud_saves_restore_message: 'Feche o jogo antes de restaurar este backup. A Steam pode continuar aberta; ao iniciar o jogo novamente, ele receberá os arquivos restaurados.', cloud_saves_restored: 'Backup restaurado. Abra o jogo para carregar o save recuperado.', cloud_saves_error_game_active: 'Feche o jogo antes de restaurar o backup. Não é preciso fechar a Steam.', cloud_saves_error_recovery_incomplete: 'Este backup está incompleto e não pode ser restaurado com segurança.', cloud_saves_unavailable_steam_closed: 'Abra a Steam e entre na conta desejada para ver seus saves.', cloud_saves_unavailable_account: 'Entre em uma conta Steam para ver seus saves.', cloud_saves_unavailable_disconnected: 'Conecte a sincronização de saves para ver seus jogos.' });
    Object.assign(messages.en, { cloud_saves_restore_notice: 'Close the game before restoring. Steam can stay open.', cloud_saves_restore_message: 'Close the game before restoring this backup. Steam can stay open; the restored files will load when you next start the game.', cloud_saves_restored: 'Backup restored. Start the game to load the recovered save.', cloud_saves_error_game_active: 'Close the game before restoring. Steam can stay open.', cloud_saves_error_recovery_incomplete: 'This backup is incomplete and cannot be restored safely.', cloud_saves_unavailable_steam_closed: 'Open Steam and sign in to the account you want to view.', cloud_saves_unavailable_account: 'Sign in to a Steam account to view your saves.', cloud_saves_unavailable_disconnected: 'Connect save synchronization to view your games.' });
    Object.assign(messages.es, { cloud_saves_restore_notice: 'Cierra el juego antes de restaurar. Steam puede seguir abierto.', cloud_saves_restore_message: 'Cierra el juego antes de restaurar esta copia. Steam puede seguir abierto; los archivos se cargarán al iniciar el juego de nuevo.', cloud_saves_restored: 'Copia restaurada. Inicia el juego para cargar la partida recuperada.', cloud_saves_error_game_active: 'Cierra el juego antes de restaurar. No hace falta cerrar Steam.', cloud_saves_error_recovery_incomplete: 'Esta copia está incompleta y no se puede restaurar de forma segura.', cloud_saves_unavailable_steam_closed: 'Abre Steam e inicia sesión en la cuenta que quieras consultar.', cloud_saves_unavailable_account: 'Inicia sesión en Steam para ver tus partidas.', cloud_saves_unavailable_disconnected: 'Conecta la sincronización para ver tus juegos.' });
    Object.assign(messages.fr, { cloud_saves_restore_notice: 'Fermez le jeu avant la restauration. Steam peut rester ouvert.', cloud_saves_restore_message: 'Fermez le jeu avant de restaurer cette sauvegarde. Steam peut rester ouvert ; les fichiers seront chargés au prochain lancement du jeu.', cloud_saves_restored: 'Sauvegarde restaurée. Lancez le jeu pour charger la progression récupérée.', cloud_saves_error_game_active: 'Fermez le jeu avant la restauration. Steam peut rester ouvert.', cloud_saves_error_recovery_incomplete: 'Cette sauvegarde est incomplète et ne peut pas être restaurée en toute sécurité.', cloud_saves_unavailable_steam_closed: 'Ouvrez Steam et connectez-vous au compte à consulter.', cloud_saves_unavailable_account: 'Connectez-vous à Steam pour voir vos sauvegardes.', cloud_saves_unavailable_disconnected: 'Connectez la synchronisation pour voir vos jeux.' });
    Object.assign(messages.de, { cloud_saves_restore_notice: 'Schließe das Spiel vor der Wiederherstellung. Steam kann geöffnet bleiben.', cloud_saves_restore_message: 'Schließe das Spiel, bevor du dieses Backup wiederherstellst. Steam kann geöffnet bleiben; die Dateien werden beim nächsten Spielstart geladen.', cloud_saves_restored: 'Backup wiederhergestellt. Starte das Spiel, um den Spielstand zu laden.', cloud_saves_error_game_active: 'Schließe das Spiel vor der Wiederherstellung. Steam kann geöffnet bleiben.', cloud_saves_error_recovery_incomplete: 'Dieses Backup ist unvollständig und kann nicht sicher wiederhergestellt werden.', cloud_saves_unavailable_steam_closed: 'Öffne Steam und melde dich mit dem gewünschten Konto an.', cloud_saves_unavailable_account: 'Melde dich bei Steam an, um deine Spielstände zu sehen.', cloud_saves_unavailable_disconnected: 'Verbinde die Synchronisierung, um deine Spiele zu sehen.' });
    Object.assign(messages.ptbr, { cloud_saves_error_recovery_not_found: 'Esse backup mudou desde que a tela foi aberta. A lista foi atualizada; escolha novamente.', cloud_saves_error_recovery_conflict: 'O backup mudou durante a restauração. Atualize a lista e tente novamente.', cloud_saves_error_cloud_timeout: 'A restauração demorou demais para responder. Confira a versão atual antes de tentar novamente.', cloud_saves_error_cloud_server_error: 'O servidor não conseguiu concluir a restauração. Seus saves atuais não foram alterados.', cloud_saves_backup_changed: 'A lista de backups mudou. Confira a versão disponível e escolha novamente.' });
    Object.assign(messages.en, { cloud_saves_error_recovery_not_found: 'This backup changed since the screen was opened. The list has been refreshed; choose again.', cloud_saves_error_recovery_conflict: 'The backup changed during restoration. Refresh the list and try again.', cloud_saves_error_cloud_timeout: 'The restore took too long to respond. Check the current version before trying again.', cloud_saves_error_cloud_server_error: 'The server could not complete the restore. Your current saves were not changed.', cloud_saves_backup_changed: 'The backup list changed. Review the available version and choose again.' });
    Object.assign(messages.es, { cloud_saves_error_recovery_not_found: 'Esta copia cambió desde que abriste la pantalla. La lista se actualizó; elige de nuevo.', cloud_saves_error_recovery_conflict: 'La copia cambió durante la restauración. Actualiza la lista e inténtalo de nuevo.', cloud_saves_error_cloud_timeout: 'La restauración tardó demasiado en responder. Revisa la versión actual antes de repetirla.', cloud_saves_error_cloud_server_error: 'El servidor no pudo completar la restauración. Tus partidas actuales no se modificaron.', cloud_saves_backup_changed: 'La lista de copias cambió. Revisa la versión disponible y elige de nuevo.' });
    Object.assign(messages.fr, { cloud_saves_error_recovery_not_found: 'Cette sauvegarde a changé depuis l’ouverture de l’écran. La liste a été actualisée ; choisissez à nouveau.', cloud_saves_error_recovery_conflict: 'La sauvegarde a changé pendant la restauration. Actualisez la liste et réessayez.', cloud_saves_error_cloud_timeout: 'La restauration a mis trop de temps à répondre. Vérifiez la version actuelle avant de réessayer.', cloud_saves_error_cloud_server_error: 'Le serveur n’a pas pu terminer la restauration. Vos sauvegardes actuelles n’ont pas été modifiées.', cloud_saves_backup_changed: 'La liste des sauvegardes a changé. Vérifiez la version disponible et choisissez à nouveau.' });
    Object.assign(messages.de, { cloud_saves_error_recovery_not_found: 'Dieses Backup hat sich seit dem Öffnen geändert. Die Liste wurde aktualisiert; wähle erneut.', cloud_saves_error_recovery_conflict: 'Das Backup hat sich während der Wiederherstellung geändert. Aktualisiere die Liste und versuche es erneut.', cloud_saves_error_cloud_timeout: 'Die Wiederherstellung hat zu lange gedauert. Prüfe die aktuelle Version vor einem neuen Versuch.', cloud_saves_error_cloud_server_error: 'Der Server konnte die Wiederherstellung nicht abschließen. Deine aktuellen Spielstände wurden nicht geändert.', cloud_saves_backup_changed: 'Die Backup-Liste hat sich geändert. Prüfe die verfügbare Version und wähle erneut.' });
    Object.assign(messages.ptbr, { cloud_saves_restore_message: 'Os arquivos deste backup serão recuperados; os demais arquivos do jogo permanecerão como estão. Feche o jogo antes de continuar. A Steam pode ficar aberta.', cloud_saves_error_cloud_server_error: 'O servidor não conseguiu confirmar a restauração. Confira a versão atual antes de tentar novamente.' });
    Object.assign(messages.en, { cloud_saves_restore_message: 'The files in this backup will be recovered; other game files will stay as they are. Close the game before continuing. Steam can stay open.', cloud_saves_error_cloud_server_error: 'The server could not confirm the restore. Check the current version before trying again.' });
    Object.assign(messages.es, { cloud_saves_restore_message: 'Se recuperarán los archivos de esta copia; los demás archivos del juego permanecerán como están. Cierra el juego antes de continuar. Steam puede seguir abierto.', cloud_saves_error_cloud_server_error: 'El servidor no pudo confirmar la restauración. Revisa la versión actual antes de repetirla.' });
    Object.assign(messages.fr, { cloud_saves_restore_message: 'Les fichiers de cette sauvegarde seront récupérés ; les autres fichiers du jeu resteront inchangés. Fermez le jeu avant de continuer. Steam peut rester ouvert.', cloud_saves_error_cloud_server_error: 'Le serveur n’a pas pu confirmer la restauration. Vérifiez la version actuelle avant de réessayer.' });
    Object.assign(messages.de, { cloud_saves_restore_message: 'Die Dateien dieses Backups werden wiederhergestellt; andere Spieldateien bleiben unverändert. Schließe das Spiel, bevor du fortfährst. Steam kann geöffnet bleiben.', cloud_saves_error_cloud_server_error: 'Der Server konnte die Wiederherstellung nicht bestätigen. Prüfe die aktuelle Version vor einem neuen Versuch.' });
    Object.assign(messages.ptbr, { cloud_saves_checking_backup: 'Conferindo backup…' });
    Object.assign(messages.en, { cloud_saves_checking_backup: 'Checking backup…' });
    Object.assign(messages.es, { cloud_saves_checking_backup: 'Comprobando copia…' });
    Object.assign(messages.fr, { cloud_saves_checking_backup: 'Vérification de la sauvegarde…' });
    Object.assign(messages.de, { cloud_saves_checking_backup: 'Backup wird geprüft…' });
    Object.assign(messages.ptbr, { cloud_saves_loading_details: 'Carregando saves do jogo…' });
    Object.assign(messages.en, { cloud_saves_loading_details: 'Loading game saves…' });
    Object.assign(messages.es, { cloud_saves_loading_details: 'Cargando partidas del juego…' });
    Object.assign(messages.fr, { cloud_saves_loading_details: 'Chargement des sauvegardes du jeu…' });
    Object.assign(messages.de, { cloud_saves_loading_details: 'Spielstände werden geladen…' });
    window.merlinI18n?.register(messages);

    document.addEventListener('DOMContentLoaded', () => {
        const elements = {
            button: document.getElementById('openCloudSavesBtn'),
            view: document.getElementById('cloudSavesView'),
            listState: document.getElementById('cloudSavesListState'),
            detailsState: document.getElementById('cloudSavesDetailsState'),
            search: document.getElementById('cloudSavesSearchInput'),
            loading: document.getElementById('cloudSavesLoadingState'),
            error: document.getElementById('cloudSavesErrorState'),
            retry: document.getElementById('cloudSavesRetryBtn'),
            empty: document.getElementById('cloudSavesEmptyState'),
            noResults: document.getElementById('cloudSavesNoResultsState'),
            list: document.getElementById('cloudSavesGameList'),
            detailsLoading: document.getElementById('cloudSavesDetailsLoadingState'),
            detailsContent: document.getElementById('cloudSavesDetailsContent'),
            listCrumb: document.getElementById('cloudSavesListCrumb'),
            listCurrentCrumb: document.getElementById('cloudSavesListCurrentCrumb'),
            gameCrumb: document.getElementById('cloudSavesGameCrumb'),
            gameCrumbName: document.getElementById('cloudSavesGameCrumbName'),
            cover: document.getElementById('cloudSavesGameCover'),
            coverFallback: document.querySelector('.cloud-saves-game-cover-fallback'),
            name: document.getElementById('cloudSavesGameName'),
            meta: document.getElementById('cloudSavesGameMeta'),
            currentDate: document.getElementById('cloudSavesCurrentDate'),
            currentSummary: document.getElementById('cloudSavesCurrentSummary'),
            backups: document.getElementById('cloudSavesBackups'),
            noBackups: document.getElementById('cloudSavesNoBackups')
        };
        if (!elements.view || !window.electronAPI?.cloudSync) return;

        const tr = (key, values = {}) => Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), window.merlinI18n.t(key));
        const locale = () => ({ ptbr: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }[window.merlinI18n.current()] || 'en-US');
        const date = value => value ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
        const fallbackCoverUrl = appId => /^\d+$/.test(String(appId || '').trim())
            ? `https://generator.ryuu.lol/files/images/${String(appId).trim()}.jpg`
            : null;
        const coverCandidates = game => [...new Set([game?.coverUrl, fallbackCoverUrl(game?.appId)].filter(Boolean))];
        const bytes = value => {
            const size = Number(value) || 0;
            if (size < 1024) return `${size} B`;
            const units = ['B', 'KB', 'MB', 'GB'];
            let amount = size;
            let unit = units[0];
            for (let index = 0; amount >= 1024 && index < units.length - 1; index += 1) {
                amount /= 1024;
                unit = units[index + 1];
            }
            return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${unit}`;
        };
        const notify = (message, type = 'info') => window.showNotification?.(message, type);
        const plural = (count, one, many) => tr(count === 1 ? one : many, { count });
        const fileSummary = (count, size) => tr(count === 1 ? 'cloud_saves_file_one' : 'cloud_saves_file_many', { count, size: bytes(size) });
        const state = { games: [], selected: null, loading: false, error: false, detailRequestId: 0 };

        function errorMessage(code) {
            if (code === 'game_active') return tr('cloud_saves_error_game_active');
            if (code === 'recovery_incomplete') return tr('cloud_saves_error_recovery_incomplete');
            if (['recovery_not_found', 'recovery_conflict', 'cloud_timeout', 'cloud_server_error'].includes(code)) return tr(`cloud_saves_error_${code}`);
            if (code === 'steam_closed') return tr('cloud_saves_unavailable_steam_closed');
            if (code === 'steam_account_unavailable') return tr('cloud_saves_error_account');
            return tr('cloud_saves_error_generic');
        }

        function syncVisibility() {
            const active = window.merlinView?.get?.() === 'cloud-saves';
            elements.view.hidden = !active;
            if (active && !state.games.length && !state.loading) void loadGames();
        }

        function renderBreadcrumb() {
            const inDetails = Boolean(state.selected);
            elements.listCrumb.hidden = !inDetails;
            elements.listCurrentCrumb.hidden = inDetails;
            elements.gameCrumb.hidden = !inDetails;
            const name = inDetails ? state.selected.name || '—' : '';
            elements.gameCrumbName.textContent = name;
            elements.gameCrumbName.title = name;
        }

        function renderList() {
            const query = elements.search.value.trim().toLocaleLowerCase();
            const games = state.games.filter(game => String(game.name || '').toLocaleLowerCase().includes(query));
            // Loading and error are mutually exclusive states. This also
            // protects against a late failed request rendering over a retry.
            elements.loading.hidden = !state.loading || state.error;
            elements.error.hidden = state.loading || !state.error;
            elements.empty.hidden = state.loading || state.error || state.games.length > 0;
            elements.noResults.hidden = state.loading || state.error || state.games.length === 0 || games.length > 0;
            elements.list.hidden = state.loading || state.error || !games.length;
            elements.list.replaceChildren();
            for (const game of games) {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'cloud-saves-game-row';
                row.dataset.appId = game.appId;
                const cover = document.createElement('span');
                cover.className = 'cloud-saves-row-cover';
                const candidates = coverCandidates(game);
                if (candidates.length) {
                    const image = document.createElement('img');
                    image.alt = '';
                    image.loading = 'lazy';
                    const loadNext = () => {
                        const url = candidates.shift();
                        if (url) image.src = url;
                        else { image.remove(); cover.classList.add('is-fallback'); }
                    };
                    image.addEventListener('error', loadNext);
                    loadNext();
                    cover.append(image);
                } else cover.classList.add('is-fallback');
                const info = document.createElement('span');
                info.className = 'cloud-saves-row-info';
                const title = document.createElement('strong');
                title.textContent = game.name || '—';
                const last = document.createElement('span');
                last.textContent = tr('cloud_saves_last_sync', { date: date(game.lastSyncAt) });
                info.append(title, last);
                const stats = document.createElement('span');
                stats.className = 'cloud-saves-row-stats';
                stats.textContent = plural(game.backupCount || 0, 'cloud_saves_backup_one', 'cloud_saves_backup_many');
                const arrow = document.createElement('span');
                arrow.className = 'cloud-saves-row-arrow';
                arrow.textContent = '›';
                row.append(cover, info, stats, arrow);
                row.addEventListener('click', () => void openGame(game.appId));
                elements.list.append(row);
            }
        }

        function renderDetails(game) {
            if (!game) return;
            elements.name.textContent = game.name || '—';
            elements.meta.textContent = plural(game.currentVersion?.fileCount || 0, 'cloud_saves_synced_files_one', 'cloud_saves_synced_files_many');
            elements.currentDate.textContent = date(game.currentVersion?.createdAt);
            elements.currentSummary.textContent = fileSummary(game.currentVersion?.fileCount || 0, game.currentVersion?.totalSize);
            const candidates = coverCandidates(game);
            elements.cover.hidden = candidates.length === 0;
            elements.coverFallback.hidden = candidates.length > 0;
            elements.cover.onerror = null;
            elements.cover.removeAttribute('src');
            const loadNext = () => {
                const url = candidates.shift();
                if (url) {
                    elements.cover.src = url;
                    elements.cover.hidden = false;
                    elements.coverFallback.hidden = true;
                } else {
                    elements.cover.hidden = true;
                    elements.coverFallback.hidden = false;
                }
            };
            elements.cover.onerror = loadNext;
            loadNext();
            elements.backups.replaceChildren();
            const backups = Array.isArray(game.backups) ? game.backups : [];
            elements.noBackups.hidden = backups.length > 0;
            for (const backup of backups) {
                const card = document.createElement('article');
                card.className = 'cloud-saves-backup-card';
                const info = document.createElement('div');
                const title = document.createElement('strong');
                title.textContent = tr('cloud_saves_backup_item', { date: date(backup.createdAt) });
                const detail = document.createElement('span');
                detail.textContent = fileSummary(backup.fileCount || 0, backup.totalSize);
                info.append(title, detail);
                const restore = document.createElement('button');
                restore.type = 'button';
                restore.className = 'btn btn-secondary cloud-saves-restore-btn';
                restore.textContent = tr('cloud_saves_restore');
                restore.addEventListener('click', () => void restoreBackup(game, backup, restore));
                card.append(info, restore);
                elements.backups.append(card);
            }
        }

        async function loadGames() {
            if (state.loading) return;
            state.loading = true;
            state.error = false;
            renderList();
            try {
                const result = await window.electronAPI.cloudSync.listGames();
                if (!result?.success) throw new Error(result?.code || 'cloud_games_failed');
                state.games = Array.isArray(result.games) ? result.games : [];
                state.error = false;
            } catch (error) {
                state.games = [];
                state.error = true;
                notify(errorMessage(error.message), 'error');
            } finally {
                state.loading = false;
                renderList();
            }
        }

        async function openGame(appId) {
            const requestId = ++state.detailRequestId;
            state.selected = state.games.find(game => String(game.appId) === String(appId)) || { appId };
            renderBreadcrumb();
            elements.listState.hidden = true;
            elements.detailsState.hidden = false;
            elements.detailsContent.hidden = true;
            elements.detailsLoading.hidden = false;
            elements.listCrumb.focus();
            try {
                const result = await window.electronAPI.cloudSync.getGame(appId);
                if (requestId !== state.detailRequestId) return;
                if (!result?.success || !result.game) throw new Error(result?.code || 'cloud_game_failed');
                state.selected = result.game;
                renderDetails(state.selected);
                renderBreadcrumb();
                elements.detailsContent.hidden = false;
            } catch (error) {
                if (requestId !== state.detailRequestId) return;
                state.selected = null;
                renderBreadcrumb();
                elements.detailsState.hidden = true;
                elements.listState.hidden = false;
                notify(errorMessage(error.message), 'error');
            } finally {
                if (requestId === state.detailRequestId) elements.detailsLoading.hidden = true;
            }
        }

        async function restoreBackup(game, backup, button) {
            if (button.disabled) return;
            button.disabled = true;
            try {
                const accepted = await window.merlinRestartPrompt?.ask?.({ title: tr('cloud_saves_restore_title'), message: tr('cloud_saves_restore_message'), cancelLabel: window.merlinI18n.t('repair_steam_running_cancel'), actionLabel: tr('cloud_saves_restore_action') });
                if (!accepted) return;

                button.textContent = tr('cloud_saves_checking_backup');
                const latest = await window.electronAPI.cloudSync.getGame(game.appId);
                if (!latest?.success || !latest.game) throw new Error(latest?.code || 'cloud_game_failed');
                if (!latest.game.backups?.some(item => item.id === backup.id)) {
                    state.selected = latest.game;
                    renderDetails(state.selected);
                    notify(tr('cloud_saves_backup_changed'));
                    return;
                }

                button.textContent = tr('cloud_saves_restoring');
                const result = await window.electronAPI.cloudSync.restore(game.appId, backup.id);
                if (!result?.success) throw new Error(result?.code || 'cloud_restore_failed');
                notify(tr('cloud_saves_restored'), 'success');
                await openGame(game.appId);
            } catch (error) {
                if (error.message === 'recovery_not_found') await openGame(game.appId);
                notify(errorMessage(error.message), 'error');
            } finally {
                button.disabled = false;
                button.textContent = tr('cloud_saves_restore');
            }
        }

        document.getElementById('cloudSavesConfigCrumb')?.addEventListener('click', () => window.merlinView?.set?.('settings'));
        elements.search?.addEventListener('input', renderList);
        elements.retry?.addEventListener('click', () => void loadGames());
        elements.listCrumb?.addEventListener('click', () => {
            state.detailRequestId += 1;
            state.selected = null;
            renderBreadcrumb();
            elements.detailsState.hidden = true;
            elements.listState.hidden = false;
            renderList();
            elements.search.focus();
        });
        window.addEventListener('merlin-view-changed', syncVisibility);
        window.addEventListener('merlin-authenticated', () => { state.games = []; if (window.merlinView?.get?.() === 'cloud-saves') void loadGames(); });
        window.addEventListener('merlin-logout', () => { state.detailRequestId += 1; state.games = []; state.selected = null; renderBreadcrumb(); elements.detailsState.hidden = true; elements.listState.hidden = false; });
        window.addEventListener('merlin-language-changed', () => { renderList(); if (state.selected) renderDetails(state.selected); });
        renderBreadcrumb();
        syncVisibility();
    });
})();

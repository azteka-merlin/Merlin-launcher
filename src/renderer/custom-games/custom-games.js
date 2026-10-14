const customGameTranslations = {
    ptbr: {
        custom_games_nav: 'Baixe e Jogue', custom_games_title: 'Baixe e Jogue',
        custom_games_subtitle: 'Escolha um disco, instale e abra seus jogos pelo Merlin.',
        custom_games_refresh: 'Atualizar', custom_games_refreshing: 'Atualizando…', custom_games_search: 'Buscar jogos', custom_games_search_placeholder: 'Buscar por nome',
        custom_games_loading: 'Carregando jogos…', custom_games_empty: 'Nenhum jogo disponível no momento.',
        custom_games_offline: 'Sem conexão. Os jogos já instalados continuam disponíveis.',
        custom_games_error: 'Não foi possível carregar os jogos. Tente novamente.',
        custom_games_install_title: 'Instalar jogo', custom_games_choose_drive: 'Instalar em', custom_games_drive: 'Disco',
        custom_games_zip_size: 'Download: {size}', custom_games_drive_name: 'Disco ({letter}:)',
        custom_games_drive_free: '{size} livres', custom_games_drive_free_unknown: 'Espaço indisponível',
        custom_games_required_space: 'Espaço recomendado: {size} para baixar e instalar.',
        custom_games_insufficient_space: 'Este disco não tem espaço suficiente. Escolha outro para continuar.',
        custom_games_unknown_space: 'Não foi possível verificar o espaço livre deste disco.',
        custom_games_install: 'Baixar e instalar', custom_games_cancel: 'Cancelar',
        custom_games_downloading: 'Baixando jogo', custom_games_extracting: 'Descompactando jogo',
        custom_games_verifying: 'Verificando integridade', custom_games_verify_progress: '{received} de {total} verificados · {percent}%',
        custom_games_progress: '{received} de {total} · {percent}%', custom_games_extract_progress: '{files} arquivos extraídos',
        custom_games_speed_eta: '{speed}/s · Restante: {time}', custom_games_eta_calculating: 'Calculando tempo restante…',
        custom_games_install_files: '{files} de {total} arquivos prontos · {remaining} restantes',
        custom_games_network_eta: 'Download: {speed}/s · Restante do download: {time}',
        custom_games_network_calculating: 'Download: calculando tempo restante…',
        custom_games_extraction_eta: 'Extração: {speed}/s · Restante da extração: {time}',
        custom_games_extraction_calculating: 'Extração: calculando tempo restante…',
        custom_games_reconnecting: 'Conexão interrompida. Reconectando trecho ({attempt}/{max})…',
        custom_games_connection_failed: 'A conexão parou de responder. Clique em Baixar para retomar de onde parou.',
        custom_games_continue: 'Continuar usando Merlin', custom_games_show_progress: 'Ver progresso',
        custom_games_install_failed: 'Não foi possível concluir a instalação', custom_games_cancelled_title: 'Download cancelado',
        custom_games_cancel_download: 'Cancelar download', custom_games_close: 'Fechar',
        custom_games_installed: 'Instalado', custom_games_download: 'Baixar', custom_games_play: 'Jogar',
        custom_games_folder: 'Abrir pasta', custom_games_uninstall: 'Desinstalar',
        custom_games_uninstall_title: 'Desinstalar jogo?',
        custom_games_uninstall_message: 'A pasta do jogo será movida para a Lixeira. Seus saves fora dela não serão removidos.',
        custom_games_info: 'Instruções', custom_games_no_drives: 'Nenhum disco disponível para instalação.',
        custom_games_install_success: 'Jogo instalado. Pronto para jogar!',
        custom_games_uninstall_success: 'Jogo movido para a Lixeira.',
        custom_games_uninstall_failed: 'O Windows recusou mover a pasta para a Lixeira. A instalação foi mantida. Verifique se a Lixeira desse disco está disponível e tente novamente.',
        custom_games_operation_failed: 'Não foi possível concluir a operação.',
        custom_games_busy: 'Aguarde o download do outro jogo terminar.',
        custom_games_disk_space: 'Não há espaço suficiente no disco escolhido.',
        custom_games_permission: 'Sem permissão para gravar na pasta Merlin-games desse disco. Execute o Merlin como administrador e tente novamente.',
        custom_games_folder_exists: 'Já existe uma pasta com esse nome nesse disco. Escolha outro disco ou mova a pasta antes de instalar.',
        custom_games_archive_failed: 'O ZIP está corrompido ou contém arquivos inseguros. Avise o suporte.',
        custom_games_package_failed: 'Os arquivos do jogo estão incompletos ou inválidos. Avise o suporte.',
        custom_games_executable_missing: 'O executável cadastrado não existe no pacote do jogo. Avise o suporte.',
        custom_games_cancelled: 'Download cancelado e arquivos temporários removidos.',
        custom_games_path: 'Destino: {path}', custom_games_size: '{size}',
    },
    en: {
        custom_games_nav: 'Download & Play', custom_games_title: 'Download & Play',
        custom_games_subtitle: 'Choose a drive, install your games, and launch them from Merlin.',
        custom_games_refresh: 'Refresh', custom_games_refreshing: 'Refreshing…', custom_games_search: 'Search games', custom_games_search_placeholder: 'Search by name',
        custom_games_loading: 'Loading games…', custom_games_empty: 'No games available right now.',
        custom_games_offline: 'No connection. Installed games remain available.',
        custom_games_error: 'Could not load games. Try again.',
        custom_games_install_title: 'Install game', custom_games_choose_drive: 'Install to', custom_games_drive: 'Drive',
        custom_games_zip_size: 'Download: {size}', custom_games_drive_name: 'Drive ({letter}:)',
        custom_games_drive_free: '{size} free', custom_games_drive_free_unknown: 'Space unavailable',
        custom_games_required_space: 'Recommended space: {size} to download and install.',
        custom_games_insufficient_space: 'This drive does not have enough free space. Choose another to continue.',
        custom_games_unknown_space: 'Could not check free space on this drive.',
        custom_games_install: 'Download and install', custom_games_cancel: 'Cancel',
        custom_games_downloading: 'Downloading game', custom_games_extracting: 'Extracting game',
        custom_games_verifying: 'Verifying integrity', custom_games_verify_progress: '{received} of {total} verified · {percent}%',
        custom_games_progress: '{received} of {total} · {percent}%', custom_games_extract_progress: '{files} files extracted',
        custom_games_speed_eta: '{speed}/s · Remaining: {time}', custom_games_eta_calculating: 'Calculating time remaining…',
        custom_games_install_files: '{files} of {total} files ready · {remaining} remaining',
        custom_games_network_eta: 'Download: {speed}/s · Download remaining: {time}',
        custom_games_network_calculating: 'Download: calculating time remaining…',
        custom_games_extraction_eta: 'Extraction: {speed}/s · Extraction remaining: {time}',
        custom_games_extraction_calculating: 'Extraction: calculating time remaining…',
        custom_games_reconnecting: 'Connection interrupted. Reconnecting this part ({attempt}/{max})…',
        custom_games_connection_failed: 'The connection stopped responding. Click Download to resume where it stopped.',
        custom_games_continue: 'Continue using Merlin', custom_games_show_progress: 'View progress',
        custom_games_install_failed: 'The installation could not be completed', custom_games_cancelled_title: 'Download canceled',
        custom_games_cancel_download: 'Cancel download', custom_games_close: 'Close',
        custom_games_installed: 'Installed', custom_games_download: 'Download', custom_games_play: 'Play',
        custom_games_folder: 'Open folder', custom_games_uninstall: 'Uninstall',
        custom_games_uninstall_title: 'Uninstall game?',
        custom_games_uninstall_message: 'The game folder will be moved to the Recycle Bin. Saves outside it will not be removed.',
        custom_games_info: 'Instructions', custom_games_no_drives: 'No drive is available for installation.',
        custom_games_install_success: 'Game installed. Ready to play!',
        custom_games_uninstall_success: 'Game moved to the Recycle Bin.',
        custom_games_uninstall_failed: 'Windows refused to move the folder to the Recycle Bin. The installation was kept. Check that the drive’s Recycle Bin is available and try again.',
        custom_games_operation_failed: 'Could not complete this action.',
        custom_games_busy: 'Wait for the other game download to finish.',
        custom_games_disk_space: 'Not enough space on the selected drive.',
        custom_games_permission: 'No permission to write to this drive’s Merlin-games folder. Run Merlin as administrator and try again.',
        custom_games_folder_exists: 'A folder with that name already exists on this drive. Choose another drive or move the folder first.',
        custom_games_archive_failed: 'The ZIP is corrupt or contains unsafe files. Contact support.',
        custom_games_package_failed: 'Game files are incomplete or invalid. Contact support.',
        custom_games_executable_missing: 'The configured executable is missing from the game package. Contact support.',
        custom_games_cancelled: 'Download canceled and temporary files removed.',
        custom_games_path: 'Destination: {path}', custom_games_size: '{size}',
    },
    es: {
        custom_games_nav: 'Descarga y juega', custom_games_title: 'Descarga y juega',
        custom_games_subtitle: 'Elige una unidad, instala tus juegos y ábrelos desde Merlin.',
        custom_games_refresh: 'Actualizar', custom_games_refreshing: 'Actualizando…', custom_games_search: 'Buscar juegos', custom_games_search_placeholder: 'Buscar por nombre',
        custom_games_loading: 'Cargando juegos…', custom_games_empty: 'No hay juegos disponibles por ahora.',
        custom_games_offline: 'Sin conexión. Los juegos instalados siguen disponibles.',
        custom_games_error: 'No se pudieron cargar los juegos. Inténtalo de nuevo.',
        custom_games_install_title: 'Instalar juego', custom_games_choose_drive: 'Instalar en', custom_games_drive: 'Unidad',
        custom_games_zip_size: 'Descarga: {size}', custom_games_drive_name: 'Unidad ({letter}:)',
        custom_games_drive_free: '{size} libres', custom_games_drive_free_unknown: 'Espacio no disponible',
        custom_games_required_space: 'Espacio recomendado: {size} para descargar e instalar.',
        custom_games_insufficient_space: 'Esta unidad no tiene espacio suficiente. Elige otra para continuar.',
        custom_games_unknown_space: 'No se pudo comprobar el espacio libre de esta unidad.',
        custom_games_install: 'Descargar e instalar', custom_games_cancel: 'Cancelar',
        custom_games_downloading: 'Descargando juego', custom_games_extracting: 'Extrayendo juego',
        custom_games_verifying: 'Verificando integridad', custom_games_verify_progress: '{received} de {total} verificados · {percent}%',
        custom_games_progress: '{received} de {total} · {percent}%', custom_games_extract_progress: '{files} archivos extraídos',
        custom_games_speed_eta: '{speed}/s · Restante: {time}', custom_games_eta_calculating: 'Calculando el tiempo restante…',
        custom_games_install_files: '{files} de {total} archivos listos · {remaining} restantes',
        custom_games_network_eta: 'Descarga: {speed}/s · Tiempo restante de descarga: {time}',
        custom_games_network_calculating: 'Descarga: calculando el tiempo restante…',
        custom_games_extraction_eta: 'Extracción: {speed}/s · Tiempo restante de extracción: {time}',
        custom_games_extraction_calculating: 'Extracción: calculando el tiempo restante…',
        custom_games_reconnecting: 'Conexión interrumpida. Reconectando este tramo ({attempt}/{max})…',
        custom_games_connection_failed: 'La conexión dejó de responder. Haz clic en Descargar para reanudar desde donde se detuvo.',
        custom_games_continue: 'Seguir usando Merlin', custom_games_show_progress: 'Ver progreso',
        custom_games_install_failed: 'No se pudo completar la instalación', custom_games_cancelled_title: 'Descarga cancelada',
        custom_games_cancel_download: 'Cancelar descarga', custom_games_close: 'Cerrar',
        custom_games_installed: 'Instalado', custom_games_download: 'Descargar', custom_games_play: 'Jugar',
        custom_games_folder: 'Abrir carpeta', custom_games_uninstall: 'Desinstalar',
        custom_games_uninstall_title: '¿Desinstalar juego?',
        custom_games_uninstall_message: 'La carpeta del juego se moverá a la Papelera. No se borrarán las partidas guardadas fuera de ella.',
        custom_games_info: 'Instrucciones', custom_games_no_drives: 'No hay unidades disponibles para instalar.',
        custom_games_install_success: 'Juego instalado. ¡Listo para jugar!',
        custom_games_uninstall_success: 'Juego movido a la Papelera.',
        custom_games_uninstall_failed: 'Windows rechazó mover la carpeta a la Papelera. La instalación se conservó. Comprueba que la Papelera de esa unidad esté disponible e inténtalo de nuevo.',
        custom_games_operation_failed: 'No se pudo completar la operación.',
        custom_games_busy: 'Espera a que termine la otra descarga.',
        custom_games_disk_space: 'No hay suficiente espacio en la unidad seleccionada.',
        custom_games_permission: 'No hay permiso para escribir en la carpeta Merlin-games. Ejecuta Merlin como administrador e inténtalo de nuevo.',
        custom_games_folder_exists: 'Ya existe una carpeta con ese nombre en la unidad. Elige otra unidad o mueve la carpeta.',
        custom_games_archive_failed: 'El ZIP está dañado o contiene archivos inseguros. Contacta con soporte.',
        custom_games_package_failed: 'Los archivos del juego están incompletos o no son válidos. Contacta con soporte.',
        custom_games_executable_missing: 'Falta el ejecutable configurado en el paquete del juego. Contacta con soporte.',
        custom_games_cancelled: 'Descarga cancelada y archivos temporales eliminados.',
        custom_games_path: 'Destino: {path}', custom_games_size: '{size}',
    },
    fr: {
        custom_games_nav: 'Télécharger et jouer', custom_games_title: 'Télécharger et jouer',
        custom_games_subtitle: 'Choisissez un disque, installez vos jeux et lancez-les depuis Merlin.',
        custom_games_refresh: 'Actualiser', custom_games_refreshing: 'Actualisation…', custom_games_search: 'Rechercher des jeux', custom_games_search_placeholder: 'Rechercher par nom',
        custom_games_loading: 'Chargement des jeux…', custom_games_empty: 'Aucun jeu disponible pour le moment.',
        custom_games_offline: 'Hors ligne. Les jeux installés restent disponibles.',
        custom_games_error: 'Impossible de charger les jeux. Réessayez.',
        custom_games_install_title: 'Installer le jeu', custom_games_choose_drive: 'Installer sur', custom_games_drive: 'Disque',
        custom_games_zip_size: 'Téléchargement : {size}', custom_games_drive_name: 'Disque ({letter}:)',
        custom_games_drive_free: '{size} libres', custom_games_drive_free_unknown: 'Espace indisponible',
        custom_games_required_space: 'Espace recommandé : {size} pour télécharger et installer.',
        custom_games_insufficient_space: 'Espace insuffisant sur ce disque. Choisissez-en un autre pour continuer.',
        custom_games_unknown_space: 'Impossible de vérifier l’espace libre de ce disque.',
        custom_games_install: 'Télécharger et installer', custom_games_cancel: 'Annuler',
        custom_games_downloading: 'Téléchargement du jeu', custom_games_extracting: 'Extraction du jeu',
        custom_games_verifying: 'Vérification de l’intégrité', custom_games_verify_progress: '{received} sur {total} vérifiés · {percent} %',
        custom_games_progress: '{received} sur {total} · {percent} %', custom_games_extract_progress: '{files} fichiers extraits',
        custom_games_speed_eta: '{speed}/s · Restant : {time}', custom_games_eta_calculating: 'Calcul du temps restant…',
        custom_games_install_files: '{files} fichiers prêts sur {total} · {remaining} restants',
        custom_games_network_eta: 'Téléchargement : {speed}/s · Temps restant : {time}',
        custom_games_network_calculating: 'Téléchargement : calcul du temps restant…',
        custom_games_extraction_eta: 'Extraction : {speed}/s · Temps restant : {time}',
        custom_games_extraction_calculating: 'Extraction : calcul du temps restant…',
        custom_games_reconnecting: 'Connexion interrompue. Reconnexion à cette partie ({attempt}/{max})…',
        custom_games_connection_failed: 'La connexion ne répond plus. Cliquez sur Télécharger pour reprendre là où le transfert s’est arrêté.',
        custom_games_continue: 'Continuer à utiliser Merlin', custom_games_show_progress: 'Voir la progression',
        custom_games_install_failed: 'Impossible de terminer l’installation', custom_games_cancelled_title: 'Téléchargement annulé',
        custom_games_cancel_download: 'Annuler le téléchargement', custom_games_close: 'Fermer',
        custom_games_installed: 'Installé', custom_games_download: 'Télécharger', custom_games_play: 'Jouer',
        custom_games_folder: 'Ouvrir le dossier', custom_games_uninstall: 'Désinstaller',
        custom_games_uninstall_title: 'Désinstaller le jeu ?',
        custom_games_uninstall_message: 'Le dossier du jeu sera déplacé dans la Corbeille. Les sauvegardes externes ne seront pas supprimées.',
        custom_games_info: 'Instructions', custom_games_no_drives: 'Aucun disque disponible pour l’installation.',
        custom_games_install_success: 'Jeu installé. Prêt à jouer !',
        custom_games_uninstall_success: 'Jeu déplacé dans la Corbeille.',
        custom_games_uninstall_failed: 'Windows a refusé de déplacer le dossier dans la Corbeille. Le jeu est conservé. Vérifiez que la Corbeille de ce disque est disponible, puis réessayez.',
        custom_games_operation_failed: 'Impossible de terminer cette opération.',
        custom_games_busy: 'Attendez la fin de l’autre téléchargement.',
        custom_games_disk_space: 'Espace insuffisant sur le disque choisi.',
        custom_games_permission: 'Accès refusé au dossier Merlin-games du disque. Lancez Merlin en tant qu’administrateur, puis réessayez.',
        custom_games_folder_exists: 'Un dossier de ce nom existe déjà sur ce disque. Choisissez-en un autre ou déplacez le dossier.',
        custom_games_archive_failed: 'Le ZIP est corrompu ou contient des fichiers dangereux. Contactez le support.',
        custom_games_package_failed: 'Les fichiers du jeu sont incomplets ou invalides. Contactez le support.',
        custom_games_executable_missing: 'L’exécutable configuré est absent du paquet du jeu. Contactez le support.',
        custom_games_cancelled: 'Téléchargement annulé et fichiers temporaires supprimés.',
        custom_games_path: 'Destination : {path}', custom_games_size: '{size}',
    },
    de: {
        custom_games_nav: 'Laden & Spielen', custom_games_title: 'Laden & Spielen',
        custom_games_subtitle: 'Wähle ein Laufwerk, installiere Spiele und starte sie in Merlin.',
        custom_games_refresh: 'Aktualisieren', custom_games_refreshing: 'Wird aktualisiert…', custom_games_search: 'Spiele suchen', custom_games_search_placeholder: 'Nach Namen suchen',
        custom_games_loading: 'Spiele werden geladen…', custom_games_empty: 'Momentan sind keine Spiele verfügbar.',
        custom_games_offline: 'Keine Verbindung. Installierte Spiele bleiben verfügbar.',
        custom_games_error: 'Spiele konnten nicht geladen werden. Versuche es erneut.',
        custom_games_install_title: 'Spiel installieren', custom_games_choose_drive: 'Installieren auf', custom_games_drive: 'Laufwerk',
        custom_games_zip_size: 'Download: {size}', custom_games_drive_name: 'Laufwerk ({letter}:)',
        custom_games_drive_free: '{size} frei', custom_games_drive_free_unknown: 'Speicherplatz nicht verfügbar',
        custom_games_required_space: 'Empfohlener Platz: {size} zum Herunterladen und Installieren.',
        custom_games_insufficient_space: 'Auf diesem Laufwerk ist nicht genug Platz. Wähle ein anderes aus.',
        custom_games_unknown_space: 'Freier Speicherplatz auf diesem Laufwerk konnte nicht geprüft werden.',
        custom_games_install: 'Herunterladen und installieren', custom_games_cancel: 'Abbrechen',
        custom_games_downloading: 'Spiel wird heruntergeladen', custom_games_extracting: 'Spiel wird entpackt',
        custom_games_verifying: 'Integrität wird geprüft', custom_games_verify_progress: '{received} von {total} geprüft · {percent} %',
        custom_games_progress: '{received} von {total} · {percent} %', custom_games_extract_progress: '{files} Dateien entpackt',
        custom_games_speed_eta: '{speed}/s · Verbleibend: {time}', custom_games_eta_calculating: 'Verbleibende Zeit wird berechnet…',
        custom_games_install_files: '{files} von {total} Dateien bereit · {remaining} verbleibend',
        custom_games_network_eta: 'Download: {speed}/s · Verbleibende Downloadzeit: {time}',
        custom_games_network_calculating: 'Download: verbleibende Zeit wird berechnet…',
        custom_games_extraction_eta: 'Entpacken: {speed}/s · Verbleibende Entpackzeit: {time}',
        custom_games_extraction_calculating: 'Entpacken: verbleibende Zeit wird berechnet…',
        custom_games_reconnecting: 'Verbindung unterbrochen. Dieser Abschnitt wird erneut verbunden ({attempt}/{max})…',
        custom_games_connection_failed: 'Die Verbindung antwortet nicht mehr. Klicke auf Herunterladen, um fortzufahren.',
        custom_games_continue: 'Merlin weiter verwenden', custom_games_show_progress: 'Fortschritt anzeigen',
        custom_games_install_failed: 'Die Installation konnte nicht abgeschlossen werden', custom_games_cancelled_title: 'Download abgebrochen',
        custom_games_cancel_download: 'Download abbrechen', custom_games_close: 'Schließen',
        custom_games_installed: 'Installiert', custom_games_download: 'Herunterladen', custom_games_play: 'Spielen',
        custom_games_folder: 'Ordner öffnen', custom_games_uninstall: 'Deinstallieren',
        custom_games_uninstall_title: 'Spiel deinstallieren?',
        custom_games_uninstall_message: 'Der Spielordner wird in den Papierkorb verschoben. Spielstände außerhalb des Ordners bleiben erhalten.',
        custom_games_info: 'Anleitung', custom_games_no_drives: 'Kein Laufwerk zur Installation verfügbar.',
        custom_games_install_success: 'Spiel installiert. Bereit zum Spielen!',
        custom_games_uninstall_success: 'Spiel in den Papierkorb verschoben.',
        custom_games_uninstall_failed: 'Windows hat das Verschieben des Ordners in den Papierkorb abgelehnt. Die Installation bleibt erhalten. Prüfe, ob der Papierkorb dieses Laufwerks verfügbar ist, und versuche es erneut.',
        custom_games_operation_failed: 'Aktion konnte nicht abgeschlossen werden.',
        custom_games_busy: 'Warte, bis der andere Download abgeschlossen ist.',
        custom_games_disk_space: 'Nicht genug Speicherplatz auf dem gewählten Laufwerk.',
        custom_games_permission: 'Keine Schreibberechtigung für den Merlin-games-Ordner. Starte Merlin als Administrator und versuche es erneut.',
        custom_games_folder_exists: 'Ein Ordner mit diesem Namen existiert bereits. Wähle ein anderes Laufwerk oder verschiebe den Ordner.',
        custom_games_archive_failed: 'Die ZIP-Datei ist beschädigt oder enthält unsichere Dateien. Kontaktiere den Support.',
        custom_games_package_failed: 'Die Spieldateien sind unvollständig oder ungültig. Kontaktiere den Support.',
        custom_games_executable_missing: 'Die angegebene EXE fehlt im Spielepaket. Kontaktiere den Support.',
        custom_games_cancelled: 'Download abgebrochen und temporäre Dateien entfernt.',
        custom_games_path: 'Ziel: {path}', custom_games_size: '{size}',
    },
};
for (const [language, messages] of Object.entries(customGameTranslations)) Object.assign(translations[language], messages);

document.addEventListener('DOMContentLoaded', () => {
    const api = window.electronAPI.customGames;
    const el = Object.fromEntries([
        'customGamesBtn', 'customGamesView', 'customGamesRefresh', 'customGamesSearch', 'customGamesState',
        'customGamesGrid', 'customGamesInstallModal', 'customGamesInstallName', 'customGamesInstallImage',
        'customGamesInstallSize', 'customGamesInstallNote', 'customGamesDriveList', 'customGamesInstallSpace',
        'customGamesInstallPath', 'customGamesInstallCancel', 'customGamesInstallConfirm',
        'customGamesProgressModal', 'customGamesProgressTitle', 'customGamesProgressName', 'customGamesProgressDetail',
        'customGamesProgressRate', 'customGamesProgressBar', 'customGamesProgressCancel', 'customGamesProgressMinimize', 'customGamesProgressClose',
        'customGamesDownloadWidget', 'customGamesWidgetTitle', 'customGamesWidgetName', 'customGamesWidgetDetail',
        'customGamesWidgetRate', 'customGamesWidgetBar', 'customGamesWidgetOpen', 'customGamesWidgetClose',
        'customGamesInfoModal', 'customGamesInfoName', 'customGamesInfoText', 'customGamesInfoClose',
        'customGamesUninstallModal', 'customGamesUninstallName', 'customGamesUninstallCancel', 'customGamesUninstallConfirm',
    ].map(id => [id, document.getElementById(id)]));
    let games = [];
    let drives = [];
    let selected = null;
    let selectedDrive = '';
    let uninstallTarget = null;
    let busy = false;
    let loaded = false;
    let offline = false;
    let activeStage = null;
    let progressSnapshot = null;
    let progressModalDismissed = false;
    let pendingProgress = null;
    let progressFrame = null;
    let gridDirty = false;
    let uninstallPending = false;
    let hasGoldAccess = false;
    const tr = (key, values = {}) => Object.entries(values).reduce((value, [name, replacement]) =>
        value.replaceAll(`{${name}}`, replacement), window.merlinI18n.t(key));
    const notify = (message, type = 'info') => window.showNotification?.(message, type);
    const updateGoldAccess = detail => {
        hasGoldAccess = detail?.authenticated === true && detail?.expired !== true &&
            String(detail?.planTier || '').trim().toLowerCase() === 'ouro';
        el.customGamesBtn.hidden = !hasGoldAccess;
        if (!hasGoldAccess && !el.customGamesView.hidden) window.merlinView.set('home');
    };
    const noteFor = game => game.adminNotes?.[window.merlinI18n.current()] || game.adminNote || '';
    const size = bytes => {
        const value = Number(bytes) || 0;
        if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
        if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
        return `${Math.round(value / 1024)} KB`;
    };
    const formatEta = seconds => {
        const value = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        const remainingSeconds = value % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };
    const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    const knownEta = value => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;

    function renderProgress(state) {
        if (!state?.id) return;
        progressSnapshot = state;
        activeStage = state.stage;
        if (!selected || selected.id !== state.id) {
            selected = games.find(game => game.id === state.id) || { id: state.id, name: state.name || state.id };
        }
        const extracting = state.stage === 'extracting';
        const verifying = state.stage === 'verifying';
        const terminal = ['completed', 'failed', 'cancelled'].includes(state.stage);
        if (terminal && progressFrame !== null) {
            window.cancelAnimationFrame(progressFrame);
            progressFrame = null;
            pendingProgress = null;
        }
        const nextBusy = !terminal;
        const busyChanged = busy !== nextBusy;
        busy = nextBusy;
        const title = tr(extracting ? 'custom_games_extracting' : verifying ? 'custom_games_verifying' : state.stage === 'completed'
            ? 'custom_games_install_success' : state.stage === 'cancelled' || state.code === 'cancelled'
                ? 'custom_games_cancelled_title' : state.stage === 'failed'
                    ? 'custom_games_install_failed' : 'custom_games_downloading');
        const name = state.name || selected.name || '';
        const globalExtraction = extracting && Number(state.extractionTotalBytes) > 0;
        const current = globalExtraction ? Number(state.extractedBytes) || 0
            : extracting || verifying ? Number(state.bytes) || 0 : Number(state.received) || 0;
        const total = globalExtraction ? Number(state.extractionTotalBytes)
            : extracting || verifying ? Number(state.totalBytes) || 0 : Number(state.total) || 0;
        const percent = total > 0 ? Math.min(100, Math.floor(current / total * 100)) : 0;
        const totalInstallFiles = Number.isInteger(state.totalInstallFiles) && state.totalInstallFiles > 0
            ? state.totalInstallFiles : extracting && Number.isInteger(state.totalFiles) && state.totalFiles > 0 ? state.totalFiles : 0;
        const installedFiles = Math.min(totalInstallFiles, Math.max(0,
            Number(state.installedFiles ?? (extracting ? state.files : 0)) || 0));
        const installationDetail = totalInstallFiles ? tr('custom_games_install_files', {
            files: installedFiles, total: totalInstallFiles, remaining: totalInstallFiles - installedFiles,
        }) : '';
        let detail = '';
        if (state.stage === 'downloading') {
            detail = tr('custom_games_progress', { received: size(current), total: size(total), percent });
            if (installationDetail) detail += ` · ${installationDetail}`;
            else if (Number.isInteger(state.totalFiles) && state.totalFiles > 0) {
                detail += ` · ${state.completedFiles || 0}/${state.totalFiles}`;
            }
        } else if (extracting) {
            detail = installationDetail || tr('custom_games_extract_progress', { files: state.files || 0 });
            if (total > 0) detail += ` · ${tr('custom_games_progress', { received: size(current), total: size(total), percent })}`;
        } else if (verifying) {
            detail = tr('custom_games_verify_progress', { received: size(current), total: size(total), percent });
        } else if (state.stage === 'completed') {
            detail = tr('custom_games_install_success');
        } else if (state.stage === 'cancelled' || state.code === 'cancelled') {
            detail = tr('custom_games_cancelled');
        } else if (state.stage === 'failed') {
            detail = errorText(state.code);
        }
        const speed = Number(state.speedBytesPerSecond) || 0;
        const extractionRate = knownEta(state.extractionEtaSeconds) ? tr('custom_games_extraction_eta', {
            speed: size(Number(state.extractionSpeedBytesPerSecond) || 0), time: formatEta(state.extractionEtaSeconds),
        }) : tr('custom_games_extraction_calculating');
        const networkRate = knownEta(state.etaSeconds)
            ? tr('custom_games_network_eta', { speed: size(speed), time: formatEta(state.etaSeconds) })
            : tr('custom_games_network_calculating');
        // A network estimate does not include pending extraction. Keep both
        // estimates named while the service overlaps the two kinds of work.
        let rate = terminal || verifying ? '' : extracting
            ? globalExtraction ? extractionRate : knownEta(state.etaSeconds)
                ? tr('custom_games_speed_eta', { speed: size(speed), time: formatEta(state.etaSeconds) }) : tr('custom_games_eta_calculating')
            : networkRate;
        if (!terminal && !verifying && state.retryAttempt) rate = tr('custom_games_reconnecting', {
            attempt: state.retryAttempt, max: state.maxAttempts || 4,
        });
        if (state.stage === 'downloading' && Number(state.extractionTotalBytes) > 0 && Number(state.extractedBytes) > 0) {
            rate += ` · ${extractionRate}`;
        }
        setText(el.customGamesProgressTitle, title);
        setText(el.customGamesProgressName, name);
        setText(el.customGamesProgressDetail, detail);
        setText(el.customGamesProgressRate, rate);
        el.customGamesProgressBar.style.width = `${extracting ? percent : state.stage === 'completed' ? 100 : percent}%`;
        el.customGamesProgressCancel.hidden = terminal;
        el.customGamesProgressMinimize.hidden = terminal;
        el.customGamesProgressClose.hidden = !terminal;
        el.customGamesDownloadWidget.hidden = false;
        setText(el.customGamesWidgetTitle, title);
        setText(el.customGamesWidgetName, name);
        setText(el.customGamesWidgetDetail, detail);
        setText(el.customGamesWidgetRate, rate);
        el.customGamesWidgetDetail.title = detail;
        el.customGamesWidgetRate.title = rate;
        el.customGamesWidgetBar.style.width = `${extracting ? percent : state.stage === 'completed' ? 100 : percent}%`;
        el.customGamesWidgetClose.hidden = !terminal;
        el.customGamesWidgetOpen.hidden = false;
        if (!progressModalDismissed) el.customGamesProgressModal.hidden = false;
        if (busyChanged) {
            if (el.customGamesView.hidden) gridDirty = true;
            else render();
        }
    }

    function setState(message, spin = false) {
        el.customGamesState.hidden = false;
        el.customGamesState.replaceChildren();
        if (spin) {
            const spinner = document.createElement('span');
            spinner.className = 'library-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            el.customGamesState.append(spinner);
        }
        const text = document.createElement('p');
        text.textContent = message;
        el.customGamesState.append(text);
    }

    function action(label, fn, variant = 'secondary') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn-${variant} correction-card-btn`;
        button.textContent = label;
        button.addEventListener('click', fn);
        return button;
    }

    function render() {
        gridDirty = false;
        el.customGamesGrid.replaceChildren();
        const query = el.customGamesSearch.value.trim().toLocaleLowerCase();
        const visible = games.filter(game => game.name.toLocaleLowerCase().includes(query));
        if (!games.length) setState(tr('custom_games_empty'));
        else if (!visible.length) setState(tr('custom_games_empty'));
        else el.customGamesState.hidden = true;
        for (const game of visible) {
            const card = document.createElement('article');
            card.className = 'correction-card custom-game-card';
            const cover = document.createElement('div');
            cover.className = 'correction-card-image-wrap';
            if (game.imageUrl) {
                const img = document.createElement('img');
                img.className = 'correction-card-cover';
                img.src = game.imageUrl;
                img.alt = '';
                img.loading = 'lazy';
                img.style.objectPosition = `${game.imagePositionX ?? 50}% ${game.imagePositionY ?? 50}%`;
                img.style.transform = `scale(${game.imageZoom || 1})`;
                img.style.transformOrigin = img.style.objectPosition;
                cover.append(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'correction-card-cover correction-card-cover-placeholder';
                cover.append(placeholder);
            }
            const title = document.createElement('h3');
            title.className = 'correction-card-title';
            title.textContent = game.name;
            title.title = game.name;
            const meta = document.createElement('p');
            meta.className = 'correction-card-appid';
            meta.textContent = game.installed ? tr('custom_games_installed') : size(game.archiveSize);
            const actions = document.createElement('div');
            actions.className = 'custom-game-actions';
            if (game.installed) {
                if (game.executablePath) actions.append(action(tr('custom_games_play'), async () => {
                    const result = await api.play(game.id);
                    if (!result.success) notify(errorText(result.code), 'error');
                }, 'primary'));
                actions.append(action(tr('custom_games_folder'), async () => {
                    const result = await api.openFolder(game.id);
                    if (!result.success) notify(errorText(result.code), 'error');
                }));
                actions.append(action(tr('custom_games_uninstall'), () => {
                    uninstallTarget = game;
                    el.customGamesUninstallName.textContent = game.name;
                    el.customGamesUninstallModal.hidden = false;
                }));
            } else {
                const download = action(tr('custom_games_download'), () => beginInstall(game), 'primary');
                download.disabled = offline || busy;
                actions.append(download);
            }
            if (noteFor(game)) {
                const info = document.createElement('button');
                info.type = 'button';
                info.className = 'correction-card-note';
                info.textContent = 'i';
                info.setAttribute('aria-label', `${tr('custom_games_info')}: ${game.name}`);
                info.addEventListener('click', () => {
                    el.customGamesInfoName.textContent = game.name;
                    el.customGamesInfoText.textContent = noteFor(game);
                    el.customGamesInfoModal.hidden = false;
                });
                card.append(info);
            }
            card.append(cover, title, meta, actions);
            el.customGamesGrid.append(card);
        }
        el.customGamesGrid.hidden = !visible.length;
    }

    function errorText(code) {
        if (code === 'busy') return tr('custom_games_busy');
        if (code === 'download_stalled') return tr('custom_games_connection_failed');
        if (code === 'trash_failed') return tr('custom_games_uninstall_failed');
        if (code === 'disk_space') return tr('custom_games_disk_space');
        if (code === 'EACCES' || code === 'EPERM') return tr('custom_games_permission');
        if (code === 'folder_exists') return tr('custom_games_folder_exists');
        if (code === 'executable_missing') return tr('custom_games_executable_missing');
        if (code === 'cancelled') return tr('custom_games_cancelled');
        if (code === 'invalid_folder_manifest' || code === 'invalid_range_response' || code === 'incomplete_download') return tr('custom_games_package_failed');
        if (String(code || '').startsWith('archive_') || code === 'unsafe_archive_path' || code === 'duplicate_archive_path') return tr('custom_games_archive_failed');
        return tr('custom_games_operation_failed');
    }

    async function load(force = false) {
        if (busy && !force && loaded) return;
        const hasGamesToKeepVisible = games.length > 0;
        el.customGamesRefresh.disabled = true;
        el.customGamesRefresh.classList.toggle('loading', force);
        el.customGamesRefresh.querySelector('span').textContent = tr(force ? 'custom_games_refreshing' : 'custom_games_refresh');
        if (!hasGamesToKeepVisible) setState(tr('custom_games_loading'), true);
        try {
            const result = force ? await api.refresh() : await api.list();
            if (!result.success) {
                if (result.code === 'gold_required') {
                    hasGoldAccess = false;
                    el.customGamesBtn.hidden = true;
                    window.merlinView.set('home');
                }
                throw new Error(result.code);
            }
            games = result.games || [];
            drives = result.drives || [];
            offline = Boolean(result.offline);
            loaded = true;
            if (result.operation) {
                progressModalDismissed = true;
                renderProgress(result.operation);
            }
            render();
            if (offline) notify(tr('custom_games_offline'));
        } catch {
            if (hasGamesToKeepVisible) notify(tr('custom_games_error'), 'error');
            else setState(tr('custom_games_error'));
        } finally {
            el.customGamesRefresh.disabled = false;
            el.customGamesRefresh.classList.remove('loading');
            el.customGamesRefresh.querySelector('span').textContent = tr('custom_games_refresh');
        }
    }

    function updateDriveSelection() {
        for (const row of el.customGamesDriveList.querySelectorAll('.custom-games-drive-option')) {
            const radio = row.querySelector('input');
            const current = radio.value === selectedDrive;
            radio.checked = current;
            row.classList.toggle('is-selected', current);
        }
        const drive = drives.find(item => item.letter === selectedDrive);
        const required = Number(drive?.requiredFreeBytes ?? selected.requiredFreeBytes);
        const known = drive && Number.isFinite(drive.freeBytes) && Number.isFinite(required);
        const enough = known && drive.freeBytes >= required;
        el.customGamesInstallSpace.classList.toggle('is-error', !enough);
        const spaceMessage = known
            ? tr(enough ? 'custom_games_required_space' : 'custom_games_insufficient_space', { size: size(required) })
            : tr('custom_games_unknown_space');
        el.customGamesInstallSpace.textContent = known && !enough
            ? `${spaceMessage} ${tr('custom_games_required_space', { size: size(required) })}` : spaceMessage;
        el.customGamesInstallConfirm.disabled = !enough;
        el.customGamesInstallPath.textContent = tr('custom_games_path', {
            path: `${selectedDrive}:\\Merlin-games\\${selected.installName}`,
        });
    }

    function renderDriveList() {
        if (!selected) return;
        el.customGamesDriveList.replaceChildren();
        for (const drive of drives) {
            const row = document.createElement('label');
            row.className = 'custom-games-drive-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'customGamesDriveChoice';
            radio.value = drive.letter;
            radio.addEventListener('change', () => { selectedDrive = drive.letter; updateDriveSelection(); });
            const icon = document.createElement('img');
            icon.src = 'node_modules/lucide-static/icons/hard-drive.svg';
            icon.alt = '';
            const name = document.createElement('span');
            name.className = 'custom-games-drive-name';
            name.textContent = tr('custom_games_drive_name', { letter: drive.letter });
            const free = document.createElement('span');
            free.className = 'custom-games-drive-free';
            free.textContent = Number.isFinite(drive.freeBytes)
                ? tr('custom_games_drive_free', { size: size(drive.freeBytes) })
                : tr('custom_games_drive_free_unknown');
            row.append(radio, icon, name, free);
            el.customGamesDriveList.append(row);
        }
        updateDriveSelection();
    }

    async function beginInstall(game) {
        if (busy) return notify(tr('custom_games_busy'), 'error');
        try { drives = await api.drives(game.id); }
        catch { return notify(tr('custom_games_no_drives'), 'error'); }
        if (!drives.length) return notify(tr('custom_games_no_drives'), 'error');
        selected = game;
        selectedDrive = drives.find(drive => drive.letter === 'C')?.letter || drives[0].letter;
        el.customGamesInstallName.textContent = game.name;
        el.customGamesInstallSize.textContent = tr('custom_games_zip_size', { size: size(game.archiveSize) });
        el.customGamesInstallImage.hidden = !game.imageUrl;
        if (game.imageUrl) {
            el.customGamesInstallImage.src = game.imageUrl;
            el.customGamesInstallImage.style.objectPosition = `${game.imagePositionX ?? 50}% ${game.imagePositionY ?? 50}%`;
        }
        el.customGamesInstallNote.textContent = noteFor(game);
        el.customGamesInstallNote.hidden = !noteFor(game);
        renderDriveList();
        el.customGamesInstallModal.hidden = false;
    }

    function onProgress(state) {
        if (!state?.id) return;
        if (['completed', 'failed', 'cancelled'].includes(state.stage)) {
            renderProgress(state);
            return;
        }
        pendingProgress = state;
        if (progressFrame !== null) return;
        progressFrame = window.requestAnimationFrame(() => {
            progressFrame = null;
            const latest = pendingProgress;
            pendingProgress = null;
            if (latest) renderProgress(latest);
        });
    }

    async function startInstall(item, drive) {
        selected = item;
        progressModalDismissed = false;
        el.customGamesInstallModal.hidden = true;
        el.customGamesProgressModal.hidden = false;
        el.customGamesDownloadWidget.hidden = false;
        el.customGamesProgressName.textContent = item.name;
        el.customGamesProgressDetail.textContent = '';
        el.customGamesProgressRate.textContent = tr('custom_games_eta_calculating');
        el.customGamesProgressBar.style.width = '0%';
        el.customGamesProgressCancel.hidden = false;
        el.customGamesProgressMinimize.hidden = false;
        el.customGamesProgressClose.hidden = true;
        busy = true;
        render();
        try {
            const result = await api.install(item.id, drive);
            if (!result.success) notify(errorText(result.code), 'error');
            else notify(tr('custom_games_install_success'), 'success');
            renderProgress({ ...(progressSnapshot || {}), id: item.id, name: item.name,
                stage: result.success ? 'completed' : result.code === 'cancelled' ? 'cancelled' : 'failed',
                code: result.code, done: true });
        } catch {
            notify(tr('custom_games_operation_failed'), 'error');
            renderProgress({ ...(progressSnapshot || {}), id: item.id, name: item.name,
                stage: 'failed', code: 'install_failed', done: true });
        }
        finally {
            busy = false;
            await load();
        }
    }

    el.customGamesInstallConfirm.addEventListener('click', () => {
        if (selected && !el.customGamesInstallConfirm.disabled) void startInstall(selected, selectedDrive);
    });

    el.customGamesProgressCancel.addEventListener('click', async () => {
        el.customGamesProgressCancel.disabled = true;
        await api.cancel();
        el.customGamesProgressCancel.disabled = false;
    });
    el.customGamesProgressClose.addEventListener('click', () => {
        el.customGamesProgressModal.hidden = true;
        el.customGamesDownloadWidget.hidden = true;
        selected = null;
        progressSnapshot = null;
        progressModalDismissed = false;
    });
    el.customGamesProgressMinimize.addEventListener('click', () => {
        progressModalDismissed = true;
        el.customGamesProgressModal.hidden = true;
        el.customGamesDownloadWidget.hidden = false;
    });
    el.customGamesWidgetOpen.addEventListener('click', () => {
        progressModalDismissed = false;
        el.customGamesProgressModal.hidden = false;
    });
    el.customGamesWidgetClose.addEventListener('click', () => {
        el.customGamesDownloadWidget.hidden = true;
        el.customGamesProgressModal.hidden = true;
        selected = null;
        progressSnapshot = null;
        progressModalDismissed = false;
    });
    el.customGamesInstallCancel.addEventListener('click', () => { el.customGamesInstallModal.hidden = true; selected = null; });
    el.customGamesInfoClose.addEventListener('click', () => { el.customGamesInfoModal.hidden = true; });
    el.customGamesUninstallCancel.addEventListener('click', () => {
        if (uninstallPending) return;
        el.customGamesUninstallModal.hidden = true;
        uninstallTarget = null;
        el.customGamesUninstallConfirm.disabled = false;
    });
    el.customGamesUninstallConfirm.addEventListener('click', async () => {
        if (!uninstallTarget || uninstallPending) return;
        const item = uninstallTarget;
        uninstallPending = true;
        el.customGamesUninstallConfirm.disabled = true;
        el.customGamesUninstallCancel.disabled = true;
        try {
            const result = await api.uninstall(item.id);
            notify(result.success ? tr('custom_games_uninstall_success') : errorText(result.code), result.success ? 'success' : 'error');
            if (result.success) {
                el.customGamesUninstallModal.hidden = true;
                uninstallTarget = null;
                // Unlock the dialog before refreshing the catalog; list refreshes
                // can take longer than the filesystem operation itself.
                el.customGamesUninstallConfirm.disabled = false;
                el.customGamesUninstallCancel.disabled = false;
                void load();
            }
        } finally {
            uninstallPending = false;
            el.customGamesUninstallConfirm.disabled = false;
            el.customGamesUninstallCancel.disabled = false;
        }
    });
    el.customGamesBtn.hidden = true;
    el.customGamesBtn.addEventListener('click', () => {
        if (hasGoldAccess) window.merlinView.set('custom-games');
    });
    el.customGamesRefresh.addEventListener('click', () => load(true));
    el.customGamesSearch.addEventListener('input', render);
    window.addEventListener('merlin-view-changed', event => {
        const requested = event.detail?.view === 'custom-games';
        if (requested && !hasGoldAccess) {
            window.merlinView.set('home');
            return;
        }
        const current = requested && hasGoldAccess;
        el.customGamesView.hidden = !current;
        el.customGamesBtn.classList.toggle('active', current);
        el.customGamesBtn.setAttribute('aria-pressed', String(current));
        if (current && !loaded) void load();
        else if (current && gridDirty) render();
    });
    window.addEventListener('merlin-entitlement-changed', event => updateGoldAccess(event.detail));
    window.addEventListener('merlin-language-changed', () => {
        if (el.customGamesView.hidden) gridDirty = true;
        else render();
        if (progressSnapshot) renderProgress(progressSnapshot);
        if (!el.customGamesInstallModal.hidden) renderDriveList();
    });
    api.onProgress(onProgress);
});

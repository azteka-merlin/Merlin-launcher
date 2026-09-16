// Traductions multilingues
const translations = {
    ptbr: {
        config: 'Configuração',
        steam_ready: 'Steam pronta',
        steam_not_detected: 'Steam não detectada',
        steam_settings_pending: 'Configurações pendentes',
        account_menu: 'Minha conta',
        my_access: 'Meu acesso',
        tier_bronze: 'Bronze', tier_prata: 'Prata', tier_ouro: 'Ouro',
        tutorial_menu: 'Tutorial', faq_menu: 'FAQ', logout_menu: 'Sair',
        settings_subtitle: 'Ajuste a integração do Merlin com a Steam.',
        steam_integration: 'Integração Steam', open_settings: 'Abrir configurações',
        steam_detected_here: 'Steam detectada neste computador.', steam_not_detected_here: 'Steam não detectada neste computador.',
        steam_files_installed: 'Arquivos do Merlin instalados.', steam_files_repair: 'Arquivos do Merlin precisam de reparo.',
        settings_general: 'GERAL',
        settings_steam: 'STEAM',
        settings_maintenance: 'MANUTENÇÃO',
        settings_launcher_language: 'Idioma do launcher',
        steam_path: 'Caminho do Steam',
        steam_not_configured: 'Não configurado',
        detect_steam: 'Detecção automática',
        select_steam: 'Procurar',
        verify_files: 'Reparar',
        status: 'Status',
        steam_offline: 'Não detectada',
        steam_online: 'Detectada',
        app_id: 'App ID',
        actions: 'Ações',
        add_to_steam: 'Adicionar ao Steam',
        restart_steam: 'Reiniciar Steam',
        gamepad_connected: 'Controle Conectado',
        downloading: 'Adicionando à Steam…',
        instructions: 'Deixe a magia com Merlin. · Powered by Azteka',
        footer_magic: 'Deixe a magia com Merlin',
        footer_discord_support: 'Discord',
        footer_whatsapp_community: 'Suporte oficial no WhatsApp',
        footer_instagram: 'Instagram',
        footer_powered: 'Powered by Azteka',
        discord_announcement_title: '🏰 Bem-vindo à Casa do Merlin!',
        discord_announcement_subtitle: 'A comunidade oficial do Merlin está no WhatsApp.',
        discord_announcement_message: 'Acompanhe as novidades do projeto, receba suporte oficial, relate bugs, envie sugestões e converse com a comunidade.',
        discord_announcement_closing: 'Esperamos você por lá!',
        discord_announcement_footer_note: 'Quer entrar depois? Sem problema. O WhatsApp continuará disponível no rodapé do Merlin Launcher.',
        discord_announcement_join: 'Entrar no WhatsApp',
        discord_announcement_close: 'Fechar aviso',
        discord_announcement_later: 'Agora não',
        discord_announcement_dont_remind: 'Não me lembre novamente',
        tutorial_prompt_title: 'Quer conhecer o Merlin?',
        tutorial_prompt_message: 'Preparamos um tutorial rápido para mostrar como usar o Merlin. Você deseja assistir agora?',
        tutorial_prompt_hint: 'Você poderá assistir novamente a qualquer momento em Ajuda → Tutorial.',
        tutorial_watch_now: 'Assistir tutorial',
        tutorial_not_now: 'Agora não',
        tutorial_title: 'Tutorial do Merlin',
        tutorial_close: 'Fechar tutorial',
        steam_detected: 'Steam detectado com sucesso',
        steam_not_found: 'Steam não encontrado. Por favor, selecione manualmente.',
        config_saved: 'Configuração salva',
        app_detected: 'Jogo detectado: ID do App',
        no_app_id: 'Nenhum ID do App detectado',
        download_success: 'Jogo adicionado à Steam.',
        download_error: 'Não foi possível adicionar o jogo à Steam',
        restart_confirm: 'Deseja reiniciar o Steam agora?',
        add_confirm: 'Adicionar este jogo à Steam',
        closing_steam: 'Fechando Steam...',
        starting_steam: 'Iniciando Steam...',
        steam_restarted: 'Steam reiniciado com sucesso',
        files_ok: 'Instalado',
        files_missing: 'Pendente',
        files_label: 'Arquivos',
        billing_title: 'Assinatura',
        billing_description: 'Gerencie sua mensalidade, cartão e cancelamento pelo portal seguro.',
        billing_manage: 'Gerenciar assinatura',
        billing_opening: 'Abrindo portal de assinatura...',
        billing_opened: 'Portal de assinatura aberto.',
        billing_unavailable: 'Esta licença não possui assinatura mensal para gerenciar.',
        billing_portal_failed: 'Não foi possível abrir o portal de assinatura.',
        files_verified: 'Arquivos verificados com sucesso',
        files_already_ok: 'Tudo já está configurado.',
        repair_steam_close_failed: 'Não foi possível fechar a Steam por completo. Feche-a pelo Gerenciador de Tarefas e tente Reparar novamente.',
        repair_steam_files_locked: 'A Steam ainda está usando um arquivo do Merlin. Feche-a por completo e tente Reparar novamente.',
        activation_path_invalid: 'O caminho configurado não é uma instalação válida do Steam.',
        activation_files_missing: 'Os arquivos obrigatórios não estão instalados. Clique em Reparar primeiro.'
    },

    en: {
        config: 'Configuration',
        steam_ready: 'Steam ready',
        steam_not_detected: 'Steam not detected',
        steam_settings_pending: 'Setup pending',
        account_menu: 'My account',
        my_access: 'My access',
        tier_bronze: 'Bronze', tier_prata: 'Silver', tier_ouro: 'Gold',
        tutorial_menu: 'Tutorial', faq_menu: 'FAQ', logout_menu: 'Sign out',
        settings_subtitle: 'Adjust Merlin’s integration with Steam.',
        steam_integration: 'Steam integration', open_settings: 'Open settings',
        steam_detected_here: 'Steam is detected on this computer.', steam_not_detected_here: 'Steam is not detected on this computer.',
        steam_files_installed: 'Merlin files are installed.', steam_files_repair: 'Merlin files need repair.',
        settings_general: 'GENERAL',
        settings_steam: 'STEAM',
        settings_maintenance: 'MAINTENANCE',
        settings_launcher_language: 'Launcher language',
        steam_path: 'Steam Path',
        steam_not_configured: 'Not configured',
        detect_steam: 'Auto Detect',
        select_steam: 'Browse',
        verify_files: 'Repair',
        status: 'Status',
        steam_offline: 'Not detected',
        steam_online: 'Detected',
        app_id: 'App ID',
        actions: 'Actions',
        add_to_steam: 'Add to Steam',
        restart_steam: 'Restart Steam',
        gamepad_connected: 'Controller Connected',
        downloading: 'Adding to Steam…',
        instructions: 'Leave the magic to Merlin. · Powered by Azteka',
        footer_magic: 'Leave the magic to Merlin',
        footer_discord_support: 'Discord',
        footer_whatsapp_community: 'Official WhatsApp support',
        footer_instagram: 'Instagram',
        footer_powered: 'Powered by Azteka',
        discord_announcement_title: 'Merlin’s House has opened its doors!',
        discord_announcement_subtitle: 'Merlin’s official community is on WhatsApp.',
        discord_announcement_message: 'Follow project news, receive official support, report bugs, send suggestions, and talk with the community.',
        discord_announcement_closing: 'We’ll be waiting for you there!',
        discord_announcement_footer_note: 'Want to join later? No problem. WhatsApp will remain available in the Merlin Launcher footer.',
        discord_announcement_join: 'Join WhatsApp',
        discord_announcement_close: 'Close notice',
        discord_announcement_later: 'Not now',
        discord_announcement_dont_remind: 'Don’t remind me again',
        tutorial_prompt_title: 'Want to discover Merlin?',
        tutorial_prompt_message: 'We prepared a quick tutorial to show you how to use Merlin. Would you like to watch it now?',
        tutorial_prompt_hint: 'You can watch it again at any time from Help → Tutorial.',
        tutorial_watch_now: 'Watch tutorial',
        tutorial_not_now: 'Not now',
        tutorial_title: 'Merlin tutorial',
        tutorial_close: 'Close tutorial',
        steam_detected: 'Steam detected successfully',
        steam_not_found: 'Steam not found. Please select manually.',
        config_saved: 'Configuration saved',
        app_detected: 'Game detected: App ID',
        no_app_id: 'No App ID detected',
        download_success: 'Game added to Steam.',
        download_error: 'Could not add the game to Steam',
        restart_confirm: 'Do you want to restart Steam now?',
        add_confirm: 'Add this game to Steam',
        closing_steam: 'Closing Steam...',
        starting_steam: 'Starting Steam...',
        steam_restarted: 'Steam restarted successfully',
        files_ok: 'Installed',
        files_missing: 'Pending',
        files_label: 'Files',
        billing_title: 'Subscription',
        billing_description: 'Manage your monthly plan, card, and cancellation through the secure portal.',
        billing_manage: 'Manage subscription',
        billing_opening: 'Opening subscription portal...',
        billing_opened: 'Subscription portal opened.',
        billing_unavailable: 'This license does not have a monthly subscription to manage.',
        billing_portal_failed: 'Could not open the subscription portal.',
        files_verified: 'Files verified successfully',
        files_already_ok: 'Everything is already set up.',
        repair_steam_close_failed: 'Steam could not be closed completely. Close it in Task Manager and try Repair again.',
        repair_steam_files_locked: 'Steam is still using a Merlin file. Close Steam completely and try Repair again.',
        activation_path_invalid: 'The configured path is not a valid Steam installation.',
        activation_files_missing: 'Required files are not installed. Click Repair first.'
    },

    es: {
        config: 'Configuración',
        steam_ready: 'Steam lista',
        steam_not_detected: 'Steam no detectada',
        steam_settings_pending: 'Configuración pendiente',
        account_menu: 'Mi cuenta',
        my_access: 'Mi acceso',
        tier_bronze: 'Bronce', tier_prata: 'Plata', tier_ouro: 'Oro',
        tutorial_menu: 'Tutorial', faq_menu: 'FAQ', logout_menu: 'Salir',
        settings_subtitle: 'Ajusta la integración de Merlin con Steam.',
        steam_integration: 'Integración de Steam', open_settings: 'Abrir configuración',
        steam_detected_here: 'Steam está detectada en este equipo.', steam_not_detected_here: 'Steam no está detectada en este equipo.',
        steam_files_installed: 'Los archivos de Merlin están instalados.', steam_files_repair: 'Los archivos de Merlin necesitan reparación.',
        settings_general: 'GENERAL',
        settings_steam: 'STEAM',
        settings_maintenance: 'MANTENIMIENTO',
        settings_launcher_language: 'Idioma del launcher',
        steam_path: 'Ruta de Steam',
        steam_not_configured: 'No configurado',
        detect_steam: 'Auto-detectar',
        select_steam: 'Explorar',
        verify_files: 'Reparar',
        status: 'Estado',
        steam_offline: 'No detectado',
        steam_online: 'Detectado',
        app_id: 'App ID',
        actions: 'Acciones',
        add_to_steam: 'Agregar a Steam',
        restart_steam: 'Reiniciar Steam',
        gamepad_connected: 'Controlador conectado',
        downloading: 'Agregando a Steam…',
        instructions: 'Deja la magia en manos de Merlin. · Powered by Azteka',
        footer_magic: 'Deja la magia en manos de Merlin',
        footer_discord_support: 'Discord',
        footer_whatsapp_community: 'Soporte oficial en WhatsApp',
        footer_instagram: 'Instagram',
        footer_powered: 'Powered by Azteka',
        discord_announcement_title: 'La Casa de Merlin abrió sus puertas!',
        discord_announcement_subtitle: 'La comunidad oficial de Merlin está en WhatsApp.',
        discord_announcement_message: 'Sigue las novedades del proyecto, recibe soporte oficial, reporta bugs, envía sugerencias y conversa con la comunidad.',
        discord_announcement_closing: 'Te esperamos allí!',
        discord_announcement_footer_note: '¿Quieres entrar más tarde? Sin problema. WhatsApp seguirá disponible en el pie de página de Merlin Launcher.',
        discord_announcement_join: 'Entrar a WhatsApp',
        discord_announcement_close: 'Cerrar aviso',
        discord_announcement_later: 'Ahora no',
        discord_announcement_dont_remind: 'No recordarme de nuevo',
        tutorial_prompt_title: '¿Quieres conocer Merlin?',
        tutorial_prompt_message: 'Preparamos un tutorial rápido para mostrarte cómo usar Merlin. ¿Quieres verlo ahora?',
        tutorial_prompt_hint: 'Puedes verlo de nuevo en cualquier momento desde Ayuda → Tutorial.',
        tutorial_watch_now: 'Ver tutorial',
        tutorial_not_now: 'Ahora no',
        tutorial_title: 'Tutorial de Merlin',
        tutorial_close: 'Cerrar tutorial',
        steam_detected: 'Steam detectado con éxito',
        steam_not_found: 'Steam no encontrado. Por favor seleccione manualmente.',
        config_saved: 'Configuración guardada',
        app_detected: 'Juego detectado: App ID',
        no_app_id: 'Ningún App ID detectado',
        download_success: 'Juego agregado a Steam.',
        download_error: 'No se pudo agregar el juego a Steam',
        restart_confirm: '¿Desea reiniciar Steam ahora?',
        add_confirm: 'Agregar este juego a Steam',
        closing_steam: 'Cerrando Steam...',
        starting_steam: 'Iniciando Steam...',
        steam_restarted: 'Steam reiniciado con éxito',
        files_ok: 'Instalado',
        files_missing: 'Pendiente',
        files_label: 'Archivos',
        billing_title: 'Suscripción',
        billing_description: 'Gestiona tu mensualidad, tarjeta y cancelación desde el portal seguro.',
        billing_manage: 'Gestionar suscripción',
        billing_opening: 'Abriendo portal de suscripción...',
        billing_opened: 'Portal de suscripción abierto.',
        billing_unavailable: 'Esta licencia no tiene una suscripción mensual para gestionar.',
        billing_portal_failed: 'No se pudo abrir el portal de suscripción.',
        files_verified: 'Archivos verificados con éxito',
        files_already_ok: 'Todo ya está configurado.',
        repair_steam_close_failed: 'No se pudo cerrar Steam por completo. Ciérrela desde el Administrador de tareas e intente Reparar de nuevo.',
        repair_steam_files_locked: 'Steam sigue usando un archivo de Merlin. Cierre Steam por completo e intente Reparar de nuevo.',
        activation_path_invalid: 'La ruta configurada no es una instalación válida de Steam.',
        activation_files_missing: 'Los archivos obligatorios no están instalados. Use Reparar primero.'
    },

    fr: {
        config: 'Configuration',
        steam_ready: 'Steam prête',
        steam_not_detected: 'Steam non détectée',
        steam_settings_pending: 'Configuration requise',
        account_menu: 'Mon compte',
        my_access: 'Mon accès',
        tier_bronze: 'Bronze', tier_prata: 'Argent', tier_ouro: 'Or',
        tutorial_menu: 'Tutoriel', faq_menu: 'FAQ', logout_menu: 'Se déconnecter',
        settings_subtitle: 'Ajustez l’intégration de Merlin avec Steam.',
        steam_integration: 'Intégration Steam', open_settings: 'Ouvrir les paramètres',
        steam_detected_here: 'Steam est détectée sur cet ordinateur.', steam_not_detected_here: 'Steam n’est pas détectée sur cet ordinateur.',
        steam_files_installed: 'Les fichiers Merlin sont installés.', steam_files_repair: 'Les fichiers Merlin nécessitent une réparation.',
        settings_general: 'GÉNÉRAL',
        settings_steam: 'STEAM',
        settings_maintenance: 'MAINTENANCE',
        settings_launcher_language: 'Langue du launcher',
        steam_path: 'Chemin Steam',
        steam_not_configured: 'Non configuré',
        detect_steam: 'Auto-détection',
        select_steam: 'Parcourir',
        verify_files: 'Réparer',
        status: 'Statut',
        steam_offline: 'Non détecté',
        steam_online: 'Détecté',
        app_id: 'App ID',
        actions: 'Actions',
        add_to_steam: 'Ajouter à Steam',
        restart_steam: 'Redémarrer Steam',
        gamepad_connected: 'Manette connectée',
        downloading: 'Ajout à Steam…',
        instructions: 'Laissez Merlin faire la magie. · Powered by Azteka',
        footer_magic: 'Laissez Merlin faire la magie',
        footer_discord_support: 'Discord',
        footer_whatsapp_community: 'Support officiel sur WhatsApp',
        footer_instagram: 'Instagram',
        footer_powered: 'Powered by Azteka',
        discord_announcement_title: 'La Maison de Merlin a ouvert ses portes !',
        discord_announcement_subtitle: 'La communauté officielle de Merlin est sur WhatsApp.',
        discord_announcement_message: 'Suivez les nouveautés du projet, recevez le support officiel, signalez des bugs, envoyez des suggestions et discutez avec la communauté.',
        discord_announcement_closing: 'Nous vous y attendons !',
        discord_announcement_footer_note: 'Vous voulez rejoindre plus tard ? Aucun souci. WhatsApp restera disponible dans le pied de page de Merlin Launcher.',
        discord_announcement_join: 'Rejoindre WhatsApp',
        discord_announcement_close: 'Fermer l’avis',
        discord_announcement_later: 'Pas maintenant',
        discord_announcement_dont_remind: 'Ne plus me le rappeler',
        tutorial_prompt_title: 'Envie de découvrir Merlin ?',
        tutorial_prompt_message: 'Nous avons préparé un court tutoriel pour vous montrer comment utiliser Merlin. Voulez-vous le regarder maintenant ?',
        tutorial_prompt_hint: 'Vous pourrez le revoir à tout moment depuis Aide → Tutoriel.',
        tutorial_watch_now: 'Voir le tutoriel',
        tutorial_not_now: 'Pas maintenant',
        tutorial_title: 'Tutoriel Merlin',
        tutorial_close: 'Fermer le tutoriel',
        steam_detected: 'Steam détecté avec succès',
        steam_not_found: 'Steam non trouvé. Veuillez sélectionner manuellement.',
        config_saved: 'Configuration sauvegardée',
        app_detected: 'Jeu détecté : App ID',
        no_app_id: 'Aucun App ID détecté',
        download_success: 'Jeu ajouté à Steam.',
        download_error: 'Impossible d’ajouter le jeu à Steam',
        restart_confirm: 'Voulez-vous redémarrer Steam maintenant ?',
        add_confirm: 'Ajouter ce jeu à Steam',
        closing_steam: 'Fermeture de Steam...',
        starting_steam: 'Démarrage de Steam...',
        steam_restarted: 'Steam redémarré avec succès',
        files_ok: 'Installé',
        files_missing: 'En attente',
        files_label: 'Fichiers',
        billing_title: 'Abonnement',
        billing_description: 'Gérez votre mensualité, votre carte et l’annulation depuis le portail sécurisé.',
        billing_manage: 'Gérer l’abonnement',
        billing_opening: 'Ouverture du portail d’abonnement...',
        billing_opened: 'Portail d’abonnement ouvert.',
        billing_unavailable: 'Cette licence n’a pas d’abonnement mensuel à gérer.',
        billing_portal_failed: 'Impossible d’ouvrir le portail d’abonnement.',
        files_verified: 'Fichiers vérifiés avec succès',
        files_already_ok: 'Tout est déjà configuré.',
        repair_steam_close_failed: 'Steam n’a pas pu être fermée complètement. Fermez-la dans le Gestionnaire des tâches puis réessayez Réparer.',
        repair_steam_files_locked: 'Steam utilise encore un fichier Merlin. Fermez Steam complètement puis réessayez Réparer.',
        activation_path_invalid: 'Le chemin configuré n’est pas une installation Steam valide.',
        activation_files_missing: 'Les fichiers requis ne sont pas installés. Utilisez Réparer.'
    },

    de: {
        config: 'Einstellungen',
        steam_ready: 'Steam bereit',
        steam_not_detected: 'Steam nicht erkannt',
        steam_settings_pending: 'Einrichtung erforderlich',
        account_menu: 'Mein Konto',
        my_access: 'Mein Zugang',
        tier_bronze: 'Bronze', tier_prata: 'Silber', tier_ouro: 'Gold',
        tutorial_menu: 'Tutorial', faq_menu: 'FAQ', logout_menu: 'Abmelden',
        settings_subtitle: 'Passen Sie Merlins Steam-Integration an.',
        steam_integration: 'Steam-Integration', open_settings: 'Einstellungen öffnen',
        steam_detected_here: 'Steam wurde auf diesem Computer erkannt.', steam_not_detected_here: 'Steam wurde auf diesem Computer nicht erkannt.',
        steam_files_installed: 'Die Merlin-Dateien sind installiert.', steam_files_repair: 'Die Merlin-Dateien müssen repariert werden.',
        settings_general: 'ALLGEMEIN',
        settings_steam: 'STEAM',
        settings_maintenance: 'WARTUNG',
        settings_launcher_language: 'Sprache des Launchers',
        steam_path: 'Steam-Pfad',
        steam_not_configured: 'Nicht konfiguriert',
        detect_steam: 'Auto-Erkennung',
        select_steam: 'Durchsuchen',
        verify_files: 'Reparieren',
        status: 'Status',
        steam_offline: 'Nicht erkannt',
        steam_online: 'Erkannt',
        app_id: 'App ID',
        actions: 'Aktionen',
        add_to_steam: 'Zu Steam hinzufügen',
        restart_steam: 'Steam neustarten',
        gamepad_connected: 'Controller verbunden',
        downloading: 'Wird zu Steam hinzugefügt…',
        instructions: 'Überlass die Magie Merlin. · Powered by Azteka',
        footer_magic: 'Überlass die Magie Merlin',
        footer_discord_support: 'Discord',
        footer_whatsapp_community: 'Offizieller WhatsApp-Support',
        footer_instagram: 'Instagram',
        footer_powered: 'Powered by Azteka',
        discord_announcement_title: 'Das Haus von Merlin hat seine Türen geöffnet!',
        discord_announcement_subtitle: 'Die offizielle Merlin-Community ist auf WhatsApp.',
        discord_announcement_message: 'Verfolge Neuigkeiten zum Projekt, erhalte offiziellen Support, melde Bugs, sende Vorschläge und sprich mit der Community.',
        discord_announcement_closing: 'Wir warten dort auf dich!',
        discord_announcement_footer_note: 'Möchtest du später beitreten? Kein Problem. WhatsApp bleibt in der Fußzeile des Merlin Launchers verfügbar.',
        discord_announcement_join: 'WhatsApp beitreten',
        discord_announcement_close: 'Hinweis schließen',
        discord_announcement_later: 'Jetzt nicht',
        discord_announcement_dont_remind: 'Nicht erneut erinnern',
        tutorial_prompt_title: 'Möchtest du Merlin kennenlernen?',
        tutorial_prompt_message: 'Wir haben ein kurzes Tutorial vorbereitet, das dir die Verwendung von Merlin zeigt. Möchtest du es jetzt ansehen?',
        tutorial_prompt_hint: 'Du kannst es jederzeit unter Hilfe → Tutorial erneut ansehen.',
        tutorial_watch_now: 'Tutorial ansehen',
        tutorial_not_now: 'Nicht jetzt',
        tutorial_title: 'Merlin-Tutorial',
        tutorial_close: 'Tutorial schließen',
        steam_detected: 'Steam erfolgreich erkannt',
        steam_not_found: 'Steam nicht gefunden. Bitte manuell auswählen.',
        config_saved: 'Konfiguration gespeichert',
        app_detected: 'Spiel erkannt: App ID',
        no_app_id: 'Keine App ID erkannt',
        download_success: 'Spiel zu Steam hinzugefügt.',
        download_error: 'Spiel konnte nicht zu Steam hinzugefügt werden',
        restart_confirm: 'Möchten Sie Steam jetzt neustarten?',
        add_confirm: 'Dieses Spiel zu Steam hinzufügen',
        closing_steam: 'Steam wird geschlossen...',
        starting_steam: 'Steam wird gestartet...',
        steam_restarted: 'Steam erfolgreich neugestartet',
        files_ok: 'Installiert',
        files_missing: 'Ausstehend',
        files_label: 'Dateien',
        billing_title: 'Abonnement',
        billing_description: 'Verwalte Monatsplan, Karte und Kündigung im sicheren Portal.',
        billing_manage: 'Abonnement verwalten',
        billing_opening: 'Abonnement-Portal wird geöffnet...',
        billing_opened: 'Abonnement-Portal geöffnet.',
        billing_unavailable: 'Diese Lizenz hat kein monatliches Abonnement zur Verwaltung.',
        billing_portal_failed: 'Das Abonnement-Portal konnte nicht geöffnet werden.',
        files_verified: 'Dateien erfolgreich verifiziert',
        files_already_ok: 'Alles ist bereits eingerichtet.',
        repair_steam_close_failed: 'Steam konnte nicht vollständig geschlossen werden. Schließen Sie Steam im Task-Manager und versuchen Sie die Reparatur erneut.',
        repair_steam_files_locked: 'Steam verwendet noch eine Merlin-Datei. Schließen Sie Steam vollständig und versuchen Sie die Reparatur erneut.',
        activation_path_invalid: 'Der konfigurierte Pfad ist keine gültige Steam-Installation.',
        activation_files_missing: 'Erforderliche Dateien fehlen. Verwenden Sie zuerst Reparieren.'
    }
};

Object.assign(translations.ptbr, {
    logout_button: 'Sair',
    logout_eyebrow: 'CONTA MERLIN',
    logout_title: 'Deseja sair do Merlin?',
    logout_confirm: 'Você será desconectado do Merlin neste computador.',
    logout_warning: 'Para entrar novamente, basta informar uma chave válida.',
    logout_cancel: 'Cancelar',
    logout_action: 'Sair',
    logout_success: 'Você saiu do Merlin.',
    logout_failed: 'Não foi possível sair. Tente novamente.'
});

Object.assign(translations.en, {
    logout_button: 'Sign out',
    logout_eyebrow: 'MERLIN ACCOUNT',
    logout_title: 'Do you want to sign out of Merlin?',
    logout_confirm: 'You will be disconnected from Merlin on this computer.',
    logout_warning: 'To sign in again, just enter a valid key.',
    logout_cancel: 'Cancel',
    logout_action: 'Sign out',
    logout_success: 'You signed out of Merlin.',
    logout_failed: 'Could not sign out. Try again.'
});

Object.assign(translations.es, {
    logout_button: 'Salir',
    logout_eyebrow: 'CUENTA MERLIN',
    logout_title: '¿Desea salir de Merlin?',
    logout_confirm: 'Serás desconectado de Merlin en este equipo.',
    logout_warning: 'Para entrar de nuevo, basta informar una clave válida.',
    logout_cancel: 'Cancelar',
    logout_action: 'Salir',
    logout_success: 'Saliste de Merlin.',
    logout_failed: 'No se pudo salir. Inténtalo de nuevo.'
});

Object.assign(translations.fr, {
    logout_button: 'Se déconnecter',
    logout_eyebrow: 'COMPTE MERLIN',
    logout_title: 'Voulez-vous quitter Merlin ?',
    logout_confirm: 'Vous serez déconnecté de Merlin sur cet ordinateur.',
    logout_warning: 'Pour vous reconnecter, saisissez simplement une clé valide.',
    logout_cancel: 'Annuler',
    logout_action: 'Se déconnecter',
    logout_success: 'Vous êtes déconnecté de Merlin.',
    logout_failed: 'Impossible de se déconnecter. Réessayez.'
});

Object.assign(translations.de, {
    logout_button: 'Abmelden',
    logout_eyebrow: 'MERLIN-KONTO',
    logout_title: 'Möchten Sie Merlin verlassen?',
    logout_confirm: 'Sie werden auf diesem Computer von Merlin getrennt.',
    logout_warning: 'Zum erneuten Anmelden geben Sie einfach einen gültigen Schlüssel ein.',
    logout_cancel: 'Abbrechen',
    logout_action: 'Abmelden',
    logout_success: 'Sie wurden von Merlin abgemeldet.',
    logout_failed: 'Abmeldung fehlgeschlagen. Versuchen Sie es erneut.'
});

const addGamesTranslations = {
    ptbr: {
        add_games_title: 'Adicionar jogo à Steam',
        add_games_description: 'Adicione jogos à sua biblioteca Steam pelo Merlin. O download e a instalação são feitos pela própria Steam.',
        add_games_link_label: 'Link da página do jogo na Steam',
        add_games_link_placeholder: 'https://store.steampowered.com/app/...',
        add_game_source: 'Adicionar jogo', add_game_link_mode: 'Por link', steam_store_source: 'Loja Steam',
        main_navigation_label: 'Navegação principal', add_game_mode_label: 'Modo de adicionar jogo',
        install_now: 'Adicionar à Steam', remove_from_queue: 'Remover {name} da fila',
        add_to_queue: 'Adicionar à fila',
        queue_title: 'Jogos na fila',
        clear_queue: 'Limpar fila',
        install_all: 'Adicionar todos à Steam',
        games_resolving: 'Consultando o jogo...',
        games_install_preparing: 'Adicionando à Steam…',
        games_added: '{name} foi adicionado à fila.',
        games_add_failed: 'Não foi possível adicionar o jogo à fila. Tente novamente.',
        games_install_success: '{name} foi adicionado à Steam.',
        games_install_failed: 'Não foi possível adicionar o jogo à Steam.',
        games_restart_prompt: 'Instalação concluída. Deseja reiniciar a Steam agora?',
        games_restart_success: 'Steam reiniciada.',
        games_restart_failed: 'Não foi possível reiniciar a Steam.',
        games_batch_start: 'Adicionando jogos à Steam…',
        games_batch_summary: '{installed} adicionado(s), {failed} com falha.',
        games_batch_restart_prompt: '{summary} Deseja reiniciar a Steam agora?',
        games_batch_failed: 'Não foi possível concluir a fila.',
        games_queue_cleared: 'Fila limpa.',
        games_queue_load_failed: 'Não foi possível carregar a fila.',
        games_progress: '{current}/{total} · {name} · {message} ({percent}%)',
        games_progress_downloading: 'Adicionando à Steam…',
        games_progress_extracting: 'Adicionando à Steam…',
        games_progress_installing: 'Adicionando à Steam…',
        games_progress_cleaning: 'Adicionando à Steam…',
        games_progress_complete: 'Jogo adicionado à Steam.',
        games_error_invalid_link: 'Cole um link válido da página do jogo na Steam.',
        games_error_invalid_domain: 'O link deve ser da loja oficial da Steam.',
        games_error_missing_name: 'O link precisa incluir o nome do jogo. Copie o endereço completo da página da Steam.',
        games_error_duplicate: 'Este jogo já está na fila.',
        games_error_empty_queue: 'A fila está vazia.',
        games_error_install_busy: 'Já existe uma adição à Steam em andamento.',
        games_error_queue_not_empty: 'Adicione os jogos da fila primeiro ou remova-os para continuar.',
        games_error_queue_locked: 'A fila não pode ser alterada enquanto os jogos estão sendo adicionados à Steam.',
        games_error_not_found: 'O jogo não está mais na fila.',
        games_error_steam_path_missing: 'Configure o caminho da Steam antes de adicionar o jogo.',
        games_error_steam_path_invalid: 'O caminho configurado não é uma instalação válida da Steam.',
        games_error_required_files_missing: 'Os arquivos obrigatórios da integração Steam não estão instalados. Use Reparar primeiro.',
        games_error_manifest_unavailable: 'Este jogo ainda não está disponível no catálogo do Merlin. Verifique se ele já foi lançado; se sim, informe o suporte para avaliar a possibilidade de disponibilizá-lo.',
        games_error_manifest_sources_unavailable: 'Não foi possível adicionar este jogo à Steam agora. Se ele já foi lançado, entre em contato com o suporte.',
        games_error_download_unavailable: 'Não foi possível adicionar este jogo à Steam agora. Tente novamente.',
        games_error_archive_invalid: 'Não foi possível adicionar este jogo à Steam. Tente novamente.',
        games_error_queue_full: 'A fila permite no máximo 30 jogos.',
        games_error_rate_limited: 'O limite temporário de solicitações desta licença foi atingido. Aguarde alguns instantes e tente novamente.',
        games_error_generic: 'Não foi possível adicionar o jogo à Steam. Tente novamente.'
    },
    en: {
        add_games_title: 'Add a game to Steam', add_games_description: 'Add games to your Steam Library with Merlin. Steam handles game downloads and installation.',
        add_games_link_label: 'Link to the game page on Steam', add_games_link_placeholder: 'https://store.steampowered.com/app/...',
        add_game_source: 'Add game', add_game_link_mode: 'By link', steam_store_source: 'Steam Store',
        main_navigation_label: 'Main navigation', add_game_mode_label: 'Add game mode',
        install_now: 'Add to Steam', remove_from_queue: 'Remove {name} from the queue', add_to_queue: 'Add to queue', queue_title: 'Games in queue', clear_queue: 'Clear queue', install_all: 'Add all to Steam',
        games_resolving: 'Looking up the game...', games_install_preparing: 'Adding to Steam…', games_added: '{name} was added to the queue.',
        games_add_failed: 'The game could not be added to the queue. Try again.', games_install_success: '{name} was added to Steam.', games_install_failed: 'The game could not be added to Steam.',
        games_restart_prompt: 'Installation complete. Restart Steam now?', games_restart_success: 'Steam restarted.', games_restart_failed: 'Steam could not be restarted.',
        games_batch_start: 'Adding games to Steam…', games_batch_summary: '{installed} added, {failed} failed.', games_batch_restart_prompt: '{summary} Restart Steam now?',
        games_batch_failed: 'The queue could not be completed.', games_queue_cleared: 'Queue cleared.', games_queue_load_failed: 'The queue could not be loaded.',
        games_progress: '{current}/{total} · {name} · {message} ({percent}%)', games_progress_downloading: 'Adding to Steam…', games_progress_extracting: 'Adding to Steam…',
        games_progress_installing: 'Adding to Steam…', games_progress_cleaning: 'Adding to Steam…', games_progress_complete: 'Game added to Steam.',
        games_error_invalid_link: 'Paste a valid link to the game page on Steam.', games_error_invalid_domain: 'The link must be from the official Steam Store.',
        games_error_missing_name: 'The link must include the game name. Copy the full address from the Steam page.', games_error_duplicate: 'This game is already in the queue.',
        games_error_empty_queue: 'The queue is empty.', games_error_install_busy: 'An addition to Steam is already in progress.', games_error_queue_not_empty: 'Add the games in the queue first, or remove them to continue.',
        games_error_queue_locked: 'The queue cannot be changed while games are being added to Steam.', games_error_not_found: 'The game is no longer in the queue.',
        games_error_steam_path_missing: 'Configure the Steam path before adding the game.', games_error_steam_path_invalid: 'The configured path is not a valid Steam installation.',
        games_error_required_files_missing: 'Required Steam integration files are missing. Use Repair first.', games_error_manifest_unavailable: 'This game is not yet available in the Merlin catalog. Check whether it has already been released; if so, contact support so we can evaluate making it available.', games_error_manifest_sources_unavailable: 'Could not add this game to Steam right now. If it has already been released, contact support.', games_error_download_unavailable: 'Could not add this game to Steam right now. Try again.',
        games_error_archive_invalid: 'Could not add this game to Steam. Try again.', games_error_queue_full: 'The queue allows a maximum of 30 games.',
        games_error_rate_limited: 'The temporary request limit for this license was reached. Wait a few moments and try again.', games_error_generic: 'Could not add the game to Steam. Try again.'
    },
    es: {
        add_games_title: 'Añadir juego a Steam', add_games_description: 'Agrega juegos a tu biblioteca de Steam con Merlin. Steam realiza la descarga e instalación del juego.',
        add_games_link_label: 'Enlace de la página del juego en Steam', add_games_link_placeholder: 'https://store.steampowered.com/app/...',
        add_game_source: 'Añadir juego', add_game_link_mode: 'Por enlace', steam_store_source: 'Tienda de Steam',
        main_navigation_label: 'Navegación principal', add_game_mode_label: 'Modo de añadir juego',
        install_now: 'Agregar a Steam', remove_from_queue: 'Eliminar {name} de la cola', add_to_queue: 'Añadir a la cola', queue_title: 'Juegos en la cola', clear_queue: 'Limpiar cola', install_all: 'Agregar todos a Steam',
        games_resolving: 'Consultando el juego...', games_install_preparing: 'Agregando a Steam…', games_added: '{name} se añadió a la cola.',
        games_add_failed: 'No se pudo añadir el juego a la cola. Inténtelo de nuevo.', games_install_success: '{name} se agregó a Steam.', games_install_failed: 'No se pudo agregar el juego a Steam.',
        games_restart_prompt: 'Instalación completada. ¿Reiniciar Steam ahora?', games_restart_success: 'Steam se reinició.', games_restart_failed: 'No se pudo reiniciar Steam.',
        games_batch_start: 'Agregando juegos a Steam…', games_batch_summary: '{installed} agregado(s), {failed} con error.', games_batch_restart_prompt: '{summary} ¿Reiniciar Steam ahora?',
        games_batch_failed: 'No se pudo completar la cola.', games_queue_cleared: 'Cola vaciada.', games_queue_load_failed: 'No se pudo cargar la cola.',
        games_progress: '{current}/{total} · {name} · {message} ({percent}%)', games_progress_downloading: 'Agregando a Steam…', games_progress_extracting: 'Agregando a Steam…',
        games_progress_installing: 'Agregando a Steam…', games_progress_cleaning: 'Agregando a Steam…', games_progress_complete: 'Juego agregado a Steam.',
        games_error_invalid_link: 'Pegue un enlace válido de la página del juego en Steam.', games_error_invalid_domain: 'El enlace debe pertenecer a la tienda oficial de Steam.',
        games_error_missing_name: 'El enlace debe incluir el nombre del juego. Copie la dirección completa de Steam.', games_error_duplicate: 'Este juego ya está en la cola.',
        games_error_empty_queue: 'La cola está vacía.', games_error_install_busy: 'Ya hay una adición a Steam en curso.', games_error_queue_not_empty: 'Agregue primero los juegos de la cola o elimínelos para continuar.',
        games_error_queue_locked: 'No se puede modificar la cola mientras se agregan juegos a Steam.', games_error_not_found: 'El juego ya no está en la cola.',
        games_error_steam_path_missing: 'Configure la ruta de Steam antes de agregar el juego.', games_error_steam_path_invalid: 'La ruta configurada no es una instalación válida de Steam.',
        games_error_required_files_missing: 'Faltan archivos obligatorios de la integración de Steam. Use Reparar primero.', games_error_manifest_unavailable: 'Este juego aún no está disponible en el catálogo de Merlin. Compruebe si ya fue lanzado; si es así, contacte al soporte para evaluar la posibilidad de añadirlo.', games_error_manifest_sources_unavailable: 'No se pudo agregar este juego a Steam ahora. Si ya fue lanzado, contacte al soporte.', games_error_download_unavailable: 'No se pudo agregar este juego a Steam ahora. Inténtelo de nuevo.',
        games_error_archive_invalid: 'No se pudo agregar este juego a Steam. Inténtelo de nuevo.', games_error_queue_full: 'La cola permite un máximo de 30 juegos.',
        games_error_rate_limited: 'Se alcanzó el límite temporal de solicitudes de esta licencia. Espere unos instantes e inténtelo de nuevo.', games_error_generic: 'No se pudo agregar el juego a Steam. Inténtelo de nuevo.'
    },
    fr: {
        add_games_title: 'Ajouter un jeu à Steam', add_games_description: 'Ajoutez des jeux à votre bibliothèque Steam avec Merlin. Steam assure le téléchargement et l’installation du jeu.',
        add_games_link_label: 'Lien de la page du jeu sur Steam', add_games_link_placeholder: 'https://store.steampowered.com/app/...',
        add_game_source: 'Ajouter un jeu', add_game_link_mode: 'Par lien', steam_store_source: 'Boutique Steam',
        main_navigation_label: 'Navigation principale', add_game_mode_label: 'Mode d’ajout de jeu',
        install_now: 'Ajouter à Steam', remove_from_queue: 'Retirer {name} de la file', add_to_queue: 'Ajouter à la file', queue_title: 'Jeux dans la file', clear_queue: 'Vider la file', install_all: 'Tout ajouter à Steam',
        games_resolving: 'Recherche du jeu...', games_install_preparing: 'Ajout à Steam…', games_added: '{name} a été ajouté à la file.',
        games_add_failed: 'Impossible d’ajouter le jeu à la file. Réessayez.', games_install_success: '{name} a été ajouté à Steam.', games_install_failed: 'Impossible d’ajouter le jeu à Steam.',
        games_restart_prompt: 'Installation terminée. Redémarrer Steam maintenant ?', games_restart_success: 'Steam a redémarré.', games_restart_failed: 'Impossible de redémarrer Steam.',
        games_batch_start: 'Ajout des jeux à Steam…', games_batch_summary: '{installed} ajouté(s), {failed} en échec.', games_batch_restart_prompt: '{summary} Redémarrer Steam maintenant ?',
        games_batch_failed: 'Impossible de terminer la file.', games_queue_cleared: 'File vidée.', games_queue_load_failed: 'Impossible de charger la file.',
        games_progress: '{current}/{total} · {name} · {message} ({percent}%)', games_progress_downloading: 'Ajout à Steam…', games_progress_extracting: 'Ajout à Steam…',
        games_progress_installing: 'Ajout à Steam…', games_progress_cleaning: 'Ajout à Steam…', games_progress_complete: 'Jeu ajouté à Steam.',
        games_error_invalid_link: 'Collez un lien valide vers la page du jeu sur Steam.', games_error_invalid_domain: 'Le lien doit provenir de la boutique Steam officielle.',
        games_error_missing_name: 'Le lien doit inclure le nom du jeu. Copiez l’adresse complète depuis Steam.', games_error_duplicate: 'Ce jeu est déjà dans la file.',
        games_error_empty_queue: 'La file est vide.', games_error_install_busy: 'Un ajout à Steam est déjà en cours.', games_error_queue_not_empty: 'Ajoutez d’abord les jeux de la file ou retirez-les pour continuer.',
        games_error_queue_locked: 'La file ne peut pas être modifiée pendant l’ajout des jeux à Steam.', games_error_not_found: 'Le jeu n’est plus dans la file.',
        games_error_steam_path_missing: 'Configurez le chemin Steam avant d’ajouter le jeu.', games_error_steam_path_invalid: 'Le chemin configuré n’est pas une installation Steam valide.',
        games_error_required_files_missing: 'Des fichiers requis de l’intégration Steam sont absents. Utilisez d’abord Réparer.', games_error_manifest_unavailable: 'Ce jeu n’est pas encore disponible dans le catalogue Merlin. Vérifiez s’il est déjà sorti ; si oui, contactez le support afin que nous puissions évaluer sa disponibilité.', games_error_manifest_sources_unavailable: 'Impossible d’ajouter ce jeu à Steam pour le moment. S’il est déjà sorti, contactez le support.', games_error_download_unavailable: 'Impossible d’ajouter ce jeu à Steam pour le moment. Réessayez.',
        games_error_archive_invalid: 'Impossible d’ajouter ce jeu à Steam. Réessayez.', games_error_queue_full: 'La file est limitée à 30 jeux.',
        games_error_rate_limited: 'La limite temporaire de requêtes pour cette licence a été atteinte. Attendez quelques instants puis réessayez.', games_error_generic: 'Impossible d’ajouter le jeu à Steam. Réessayez.'
    },
    de: {
        add_games_title: 'Spiel zu Steam hinzufügen', add_games_description: 'Fügen Sie Spiele mit Merlin zu Ihrer Steam-Bibliothek hinzu. Steam übernimmt Download und Installation des Spiels.',
        add_games_link_label: 'Link zur Spielseite auf Steam', add_games_link_placeholder: 'https://store.steampowered.com/app/...',
        add_game_source: 'Spiel hinzufügen', add_game_link_mode: 'Per Link', steam_store_source: 'Steam-Shop',
        main_navigation_label: 'Hauptnavigation', add_game_mode_label: 'Modus zum Hinzufügen von Spielen',
        install_now: 'Zu Steam hinzufügen', remove_from_queue: '{name} aus der Warteschlange entfernen', add_to_queue: 'Zur Warteschlange', queue_title: 'Spiele in der Warteschlange', clear_queue: 'Warteschlange leeren', install_all: 'Alle zu Steam hinzufügen',
        games_resolving: 'Spiel wird gesucht...', games_install_preparing: 'Wird zu Steam hinzugefügt…', games_added: '{name} wurde zur Warteschlange hinzugefügt.',
        games_add_failed: 'Das Spiel konnte nicht zur Warteschlange hinzugefügt werden.', games_install_success: '{name} wurde zu Steam hinzugefügt.', games_install_failed: 'Das Spiel konnte nicht zu Steam hinzugefügt werden.',
        games_restart_prompt: 'Installation abgeschlossen. Steam jetzt neu starten?', games_restart_success: 'Steam wurde neu gestartet.', games_restart_failed: 'Steam konnte nicht neu gestartet werden.',
        games_batch_start: 'Spiele werden zu Steam hinzugefügt…', games_batch_summary: '{installed} hinzugefügt, {failed} fehlgeschlagen.', games_batch_restart_prompt: '{summary} Steam jetzt neu starten?',
        games_batch_failed: 'Die Warteschlange konnte nicht abgeschlossen werden.', games_queue_cleared: 'Warteschlange geleert.', games_queue_load_failed: 'Die Warteschlange konnte nicht geladen werden.',
        games_progress: '{current}/{total} · {name} · {message} ({percent}%)', games_progress_downloading: 'Wird zu Steam hinzugefügt…', games_progress_extracting: 'Wird zu Steam hinzugefügt…',
        games_progress_installing: 'Wird zu Steam hinzugefügt…', games_progress_cleaning: 'Wird zu Steam hinzugefügt…', games_progress_complete: 'Spiel zu Steam hinzugefügt.',
        games_error_invalid_link: 'Fügen Sie einen gültigen Link zur Steam-Spielseite ein.', games_error_invalid_domain: 'Der Link muss aus dem offiziellen Steam Store stammen.',
        games_error_missing_name: 'Der Link muss den Spielnamen enthalten. Kopieren Sie die vollständige Steam-Adresse.', games_error_duplicate: 'Dieses Spiel ist bereits in der Warteschlange.',
        games_error_empty_queue: 'Die Warteschlange ist leer.', games_error_install_busy: 'Ein Hinzufügen zu Steam läuft bereits.', games_error_queue_not_empty: 'Fügen Sie zuerst die Spiele in der Warteschlange hinzu oder entfernen Sie sie, um fortzufahren.',
        games_error_queue_locked: 'Die Warteschlange kann nicht geändert werden, während Spiele zu Steam hinzugefügt werden.', games_error_not_found: 'Das Spiel ist nicht mehr in der Warteschlange.',
        games_error_steam_path_missing: 'Konfigurieren Sie den Steam-Pfad, bevor Sie das Spiel hinzufügen.', games_error_steam_path_invalid: 'Der konfigurierte Pfad ist keine gültige Steam-Installation.',
        games_error_required_files_missing: 'Erforderliche Dateien für die Steam-Integration fehlen. Verwenden Sie zuerst Reparieren.', games_error_manifest_unavailable: 'Dieses Spiel ist noch nicht im Merlin-Katalog verfügbar. Prüfen Sie, ob es bereits veröffentlicht wurde. Falls ja, wenden Sie sich an den Support, damit wir die Verfügbarkeit prüfen können.', games_error_manifest_sources_unavailable: 'Dieses Spiel konnte jetzt nicht zu Steam hinzugefügt werden. Wenn es bereits veröffentlicht wurde, wenden Sie sich an den Support.', games_error_download_unavailable: 'Dieses Spiel konnte jetzt nicht zu Steam hinzugefügt werden. Versuchen Sie es erneut.',
        games_error_archive_invalid: 'Dieses Spiel konnte nicht zu Steam hinzugefügt werden. Versuchen Sie es erneut.', games_error_queue_full: 'Die Warteschlange ist auf 30 Spiele begrenzt.',
        games_error_rate_limited: 'Das temporäre Anfragelimit für diese Lizenz wurde erreicht. Warten Sie einen Moment und versuchen Sie es erneut.', games_error_generic: 'Das Spiel konnte nicht zu Steam hinzugefügt werden. Versuchen Sie es erneut.'
    }
};

for (const [language, messages] of Object.entries(addGamesTranslations)) {
    Object.assign(translations[language], messages);
}

// global variables
let currentLanguage = 'en';
let config = {};
let currentAppId = null;
let webview;
let billingPortalBusy = false;
let steamIsDetected = false;
let steamFilesAreReady = false;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    webview = document.getElementById('webview');

    prepareDiscordAnnouncementImage();

    // Load configuration
    await loadConfig();

    // Setup events
    setupEventListeners();

    // Setup webview
    setupWebview();

    // Check Steam status
    checkSteamStatus();
    setInterval(checkSteamStatus, 5000);

    // Listen to download progress
    window.electronAPI.onDownloadProgress((data) => {
        showProgress(data.stage === 'downloading' ? t('downloading') : data.message, data.percent);
    });

    window.electronAPI.onFilesStatus((data) => {
        updateFilesStatus(data.ok);
    });

    window.merlinView.set(document.body.dataset.merlinView || 'add-games');
    refreshBillingPortalCard();
    maybeShowDiscordAnnouncement();
});

function prepareDiscordAnnouncementImage() {
    const image = document.getElementById('discordAnnouncementImage');
    const fallback = document.getElementById('discordAnnouncementFallback');
    if (!image || !fallback) return;

    image.addEventListener('load', () => {
        image.hidden = false;
        fallback.hidden = true;
    }, { once: true });

    image.addEventListener('error', () => {
        image.hidden = true;
        fallback.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth > 0) {
        image.hidden = false;
        fallback.hidden = true;
    }
}

function showDiscordAnnouncement() {
    const modal = document.getElementById('discordAnnouncementModal');
    const joinButton = document.getElementById('discordAnnouncementJoinBtn');
    if (!modal) return;

    modal.hidden = false;
    joinButton?.focus();
}

function hideDiscordAnnouncement() {
    const modal = document.getElementById('discordAnnouncementModal');
    if (modal) modal.hidden = true;
}

async function dismissDiscordAnnouncement() {
    const dontRemind = document.getElementById('discordAnnouncementDontRemind');
    hideDiscordAnnouncement();

    if (dontRemind?.checked) {
        config.discordAnnouncementSeen = true;
        await window.electronAPI.saveConfig({ discordAnnouncementSeen: true });
    }
}

function maybeShowDiscordAnnouncement() {
    if (config.discordAnnouncementSeen === true) return;
    if (config.tutorialPromptSeen !== true) return;

    window.setTimeout(() => {
        const modal = document.getElementById('discordAnnouncementModal');
        const welcomeModal = document.getElementById('welcomeModal');
        if (!modal || (welcomeModal && !welcomeModal.hidden)) return;
        showDiscordAnnouncement();
    }, 900);
}
// Load configuration
async function loadConfig() {
    const steamDetectedPromise = window.electronAPI.isSteamDetected().catch(() => false);
    config = await window.electronAPI.getConfig();
    currentLanguage = config.language || 'ptbr';

    if (!config.steamPath) {
        const detectedSteamPath = await window.electronAPI.findSteam();
        if (detectedSteamPath) {
            config.steamPath = detectedSteamPath;
            await window.electronAPI.saveConfig(config);
        }
    }

    updateLanguage(currentLanguage);
    updateSteamPathDisplay();

    const filesStatusPromise = config.steamPath
        ? window.electronAPI.checkFilesStatus().catch(() => ({ ok: false }))
        : Promise.resolve({ ok: false });

    const [isDetected, filesStatus] = await Promise.all([
        steamDetectedPromise,
        filesStatusPromise
    ]);

    updateSteamStatus(isDetected);
    updateFilesStatus(Boolean(filesStatus?.ok));

    document.querySelectorAll('.language-selector').forEach(select => { select.value = currentLanguage; });
}

function updateSteamStatus(isDetected) {
    steamIsDetected = Boolean(isDetected);
    const indicator = document.getElementById('steamStatus');
    const text = document.getElementById('steamStatusText');

    if (isDetected) {
        indicator?.classList.add('online');
        if (text) text.textContent = t('steam_online');
    } else {
        indicator?.classList.remove('online');
        if (text) text.textContent = t('steam_offline');
    }

    const headerStatus = document.getElementById('steamHeaderStatus');
    const popoverText = document.getElementById('steamStatusPopoverText');
    updateSteamHeaderStatus();
    if (popoverText) popoverText.textContent = isDetected ? t('steam_detected_here') : t('steam_not_detected_here');
    const popoverDot = document.getElementById('steamPopoverSteamDot');
    popoverDot?.classList.toggle('online', isDetected);
}

function updateSteamHeaderStatus() {
    const headerStatus = document.getElementById('steamHeaderStatus');
    if (!headerStatus) return;

    const isReady = steamIsDetected && steamFilesAreReady;
    const statusKey = isReady ? 'steam_ready' : 'steam_settings_pending';
    headerStatus.classList.toggle('is-offline', !isReady);
    headerStatus.lastElementChild.setAttribute('data-i18n', statusKey);
    headerStatus.lastElementChild.textContent = t(statusKey);
}

function setBillingPortalBusy(isBusy) {
    billingPortalBusy = Boolean(isBusy);
    const button = document.getElementById('manageSubscriptionBtn');
    if (!button) return;
    button.disabled = billingPortalBusy;
    button.textContent = billingPortalBusy ? t('billing_opening') : t('billing_manage');
}

function renderBillingPortalCard(session) {
    const card = document.getElementById('billingCard');
    if (!card) return;
    const canManageSubscription = Boolean(session?.authenticated && session.license?.billing?.canManageSubscription);
    card.hidden = !canManageSubscription;
    if (!canManageSubscription) {
        setBillingPortalBusy(false);
    }
}

async function refreshBillingPortalCard() {
    try {
        const session = await window.electronAPI.auth.status();
        renderBillingPortalCard(session);
        renderAccountIdentity(session);
    } catch (_) {
        renderBillingPortalCard(null);
    }
}

async function openBillingPortal() {
    if (billingPortalBusy) return;
    setBillingPortalBusy(true);
    try {
        const result = await window.electronAPI.auth.manageSubscription();
        if (result?.ok) {
            showNotification(t('billing_opened'));
            await refreshBillingPortalCard();
            return;
        }
        showNotification(t(result?.code || 'billing_portal_failed'), 'error');
    } catch (_) {
        showNotification(t('billing_portal_failed'), 'error');
    } finally {
        setBillingPortalBusy(false);
    }
}

function askToLogout() {
    const modal = document.getElementById('logoutConfirmModal');
    const closeButton = document.getElementById('logoutCloseBtn');
    const cancelButton = document.getElementById('logoutCancelBtn');
    const confirmButton = document.getElementById('logoutConfirmBtn');
    if (!modal || !closeButton || !cancelButton || !confirmButton) return Promise.resolve(false);

    return new Promise(resolve => {
        let settled = false;

        function close(value) {
            if (settled) return;
            settled = true;
            modal.hidden = true;
            modal.removeEventListener('click', handleBackdrop);
            closeButton.removeEventListener('click', handleCancel);
            cancelButton.removeEventListener('click', handleCancel);
            confirmButton.removeEventListener('click', handleConfirm);
            document.removeEventListener('keydown', handleKeydown);
            resolve(value);
        }

        function handleCancel() {
            close(false);
        }

        function handleConfirm() {
            close(true);
        }

        function handleBackdrop(event) {
            if (event.target === modal) close(false);
        }

        function handleKeydown(event) {
            if (event.key === 'Escape' && !modal.hidden) close(false);
        }

        modal.hidden = false;
        closeButton.addEventListener('click', handleCancel);
        cancelButton.addEventListener('click', handleCancel);
        confirmButton.addEventListener('click', handleConfirm);
        modal.addEventListener('click', handleBackdrop);
        document.addEventListener('keydown', handleKeydown);
        confirmButton.focus();
    });
}

// Check Steam status
async function checkSteamStatus() {
    const isDetected = await window.electronAPI.isSteamDetected();
    updateSteamStatus(isDetected);
}

async function refreshStatusIndicators() {
    const [isDetected, filesStatus] = await Promise.all([
        window.electronAPI.isSteamDetected().catch(() => false),
        window.electronAPI.checkFilesStatus().catch(() => ({ ok: false }))
    ]);

    updateSteamStatus(isDetected);
    updateFilesStatus(Boolean(filesStatus?.ok));
}

// Update Steam path display
function updateSteamPathDisplay() {
    const display = document.getElementById('steamPathDisplay');
    if (config.steamPath) {
        display.textContent = config.steamPath;
        display.classList.remove('value');
        display.classList.add('value');
    } else {
        display.textContent = t('steam_not_configured');
    }
}

// Function to translate
function t(key) {
    return translations[currentLanguage][key] || key;
}

window.merlinI18n = {
    t,
    current() {
        return currentLanguage;
    },
    register(messagesByLanguage) {
        for (const [language, messages] of Object.entries(messagesByLanguage)) {
            if (translations[language]) Object.assign(translations[language], messages);
        }
    }
};

Object.assign(translations.ptbr, {
    repair_steam_running_title: 'Fechar a Steam para continuar?',
    repair_steam_running_message: 'Para atualizar os arquivos do Merlin, a Steam precisa ser fechada por alguns instantes. Deseja fechar a Steam e continuar agora?',
    repair_steam_running_cancel: 'Cancelar',
    repair_steam_running_action: 'Fechar Steam e continuar'
});

Object.assign(translations.en, {
    repair_steam_running_title: 'Close Steam to continue?',
    repair_steam_running_message: 'Steam needs to close for a moment so Merlin can update its files. Do you want to close Steam and continue now?',
    repair_steam_running_cancel: 'Cancel',
    repair_steam_running_action: 'Close Steam and continue'
});

Object.assign(translations.es, {
    repair_steam_running_title: '¿Cerrar Steam para continuar?',
    repair_steam_running_message: 'Steam debe cerrarse por un momento para que Merlin actualice sus archivos. ¿Desea cerrar Steam y continuar ahora?',
    repair_steam_running_cancel: 'Cancelar',
    repair_steam_running_action: 'Cerrar Steam y continuar'
});

Object.assign(translations.fr, {
    repair_steam_running_title: 'Fermer Steam pour continuer ?',
    repair_steam_running_message: 'Steam doit se fermer un instant pour que Merlin mette ses fichiers à jour. Voulez-vous fermer Steam et continuer maintenant ?',
    repair_steam_running_cancel: 'Annuler',
    repair_steam_running_action: 'Fermer Steam et continuer'
});

Object.assign(translations.de, {
    repair_steam_running_title: 'Steam zum Fortfahren schliessen?',
    repair_steam_running_message: 'Steam muss kurz geschlossen werden, damit Merlin seine Dateien aktualisieren kann. Moechten Sie Steam jetzt schliessen und fortfahren?',
    repair_steam_running_cancel: 'Abbrechen',
    repair_steam_running_action: 'Steam schliessen und fortfahren'
});

window.merlinView = {
    get() {
        return document.body.dataset.merlinView || 'add-games';
    },
    set(view) {
        const nextView = String(view || '').trim() || 'add-games';
        document.body.dataset.merlinView = nextView;
        window.dispatchEvent(new CustomEvent('merlin-view-changed', {
            detail: { view: nextView }
        }));
    }
};

// Update language
function updateLanguage(lang) {
    currentLanguage = lang;

    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translated = t(key);

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = translated;
        } else {
            element.textContent = translated;
        }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        element.setAttribute('aria-label', t(element.getAttribute('data-i18n-aria-label')));
    });

    updateSteamPathDisplay();
    void refreshStatusIndicators();
    const sidePlan = document.getElementById('sidePlanLabel');
    const tier = sidePlan?.dataset.tier;
    if (sidePlan && tier) sidePlan.textContent = `· ${t(`tier_${tier}`)}`;
    window.dispatchEvent(new CustomEvent('merlin-language-changed'));
}

// Setup event listeners
function setupEventListeners() {
    const settingsView = document.getElementById('settingsView');
    const settingsMainView = document.getElementById('settingsMainView');
    if (settingsView && settingsMainView) settingsMainView.appendChild(settingsView);

    const setUtilityView = (view) => {
        const isSettings = view === 'settings';
        document.getElementById('settingsMainView').hidden = !isSettings;
        if (settingsView) settingsView.hidden = !isSettings;
        document.getElementById('accessView').hidden = view !== 'access';
        document.getElementById('settingsNavBtn')?.classList.toggle('active', isSettings);
        document.getElementById('accessNavBtn')?.classList.toggle('active', view === 'access');
        document.getElementById('settingsNavBtn')?.setAttribute('aria-pressed', String(isSettings));
        document.getElementById('accessNavBtn')?.setAttribute('aria-pressed', String(view === 'access'));
    };
    window.addEventListener('merlin-view-changed', (event) => setUtilityView(event.detail?.view));
    document.getElementById('settingsNavBtn')?.addEventListener('click', () => window.merlinView.set('settings'));
    document.getElementById('accessNavBtn')?.addEventListener('click', () => window.merlinView.set('access'));
    document.getElementById('accountAccessBtn')?.addEventListener('click', () => {
        window.merlinView.set('access');
    });
    document.getElementById('openSettingsFromSteamBtn')?.addEventListener('click', () => {
        window.merlinView.set('settings');
        document.getElementById('steamStatusPopover').hidden = true;
    });
    const steamHeaderStatus = document.getElementById('steamHeaderStatus');
    const steamStatusPopover = document.getElementById('steamStatusPopover');
    const closeSteamStatusPopover = () => {
        if (steamStatusPopover) steamStatusPopover.hidden = true;
    };
    steamHeaderStatus?.addEventListener('click', () => {
        if (!steamStatusPopover) return;
        const willOpen = steamStatusPopover.hidden;
        closeSteamStatusPopover();
        if (willOpen) {
            window.dispatchEvent(new CustomEvent('merlin-popover-open', { detail: { name: 'steam' } }));
            steamStatusPopover.hidden = false;
        }
    });
    document.addEventListener('pointerdown', event => {
        if (steamStatusPopover?.hidden) return;
        if (steamStatusPopover.contains(event.target) || steamHeaderStatus?.contains(event.target)) return;
        closeSteamStatusPopover();
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeSteamStatusPopover();
    });
    window.addEventListener('merlin-popover-open', event => {
        if (event.detail?.name !== 'steam') closeSteamStatusPopover();
    });
    const discordSupportLink = document.getElementById('discordSupportLink');
    if (discordSupportLink) {
        discordSupportLink.addEventListener('click', () => {
            window.electronAPI.openDiscordSupport();
        });
    }
    const whatsappCommunityLink = document.getElementById('whatsappCommunityLink');
    if (whatsappCommunityLink) {
        whatsappCommunityLink.addEventListener('click', () => {
            window.electronAPI.openWhatsAppCommunity();
        });
    }
    const instagramLink = document.getElementById('instagramLink');
    if (instagramLink) {
        instagramLink.addEventListener('click', () => {
            window.electronAPI.openInstagram();
        });
    }
    const discordAnnouncementCloseBtn = document.getElementById('discordAnnouncementCloseBtn');
    const discordAnnouncementLaterBtn = document.getElementById('discordAnnouncementLaterBtn');
    const discordAnnouncementJoinBtn = document.getElementById('discordAnnouncementJoinBtn');

    discordAnnouncementCloseBtn?.addEventListener('click', dismissDiscordAnnouncement);
    discordAnnouncementLaterBtn?.addEventListener('click', dismissDiscordAnnouncement);
    discordAnnouncementJoinBtn?.addEventListener('click', async () => {
        hideDiscordAnnouncement();
        config.discordAnnouncementSeen = true;
        await window.electronAPI.saveConfig({ discordAnnouncementSeen: true });
        await window.electronAPI.openWhatsAppCommunity();
    });

    const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
    manageSubscriptionBtn?.addEventListener('click', openBillingPortal);
    window.addEventListener('merlin-authenticated', refreshBillingPortalCard);

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async () => {
        if (!await askToLogout()) return;

        logoutBtn.disabled = true;
        try {
            const result = await window.electronAPI.auth.logout();
            if (!result?.ok) throw new Error('logout_failed');
            renderBillingPortalCard(null);
            showNotification(t('logout_success'));
            window.dispatchEvent(new CustomEvent('merlin-logout'));
        } catch (_) {
            showNotification(t('logout_failed'), 'error');
        } finally {
            logoutBtn.disabled = false;
        }
    });

    // Language change
    document.querySelectorAll('.language-selector').forEach(select => {
        select.addEventListener('change', async (e) => {
            currentLanguage = e.target.value;
            document.querySelectorAll('.language-selector').forEach(other => { other.value = currentLanguage; });
            await window.electronAPI.saveConfig({ language: currentLanguage });
            await window.electronAPI.setMenuLanguage(currentLanguage);
            updateLanguage(currentLanguage);
            showNotification(t('config_saved'));
        });
    });

    // Detect Steam
    document.getElementById('detectSteamBtn').addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.detectSteam();

            if (result) {
            config.steamPath = result.steamPath;

            await window.electronAPI.saveConfig(config);

            updateSteamPathDisplay();
            await refreshStatusIndicators();
            showNotification(t('steam_detected'));

            // Só pergunta se realmente instalou as DLLs
            if (result.installed) {
                await promptRestartSteamIfRunning();
            }

            } else {
                showNotification(t('steam_not_found'), 'error');
            }
        } catch (error) {
            showNotification(`${t('download_error')}: ${error.message}`, 'error');
        }
    });

    document.getElementById('verifyFilesBtn').addEventListener('click', async () => {
        if (!config.steamPath) {
            showNotification(t('steam_not_configured'), 'error');
            return;
        }

        try {
            const filesStatus = await window.electronAPI.checkFilesStatus();
            if (filesStatus?.ok) {
                await refreshStatusIndicators();
                showNotification(t('files_already_ok'));
                return;
            }

            if (await window.electronAPI.isSteamRunning()) {
                const shouldCloseSteam = await askToCloseSteamForRepair();
                if (!shouldCloseSteam) return;
                showNotification(t('closing_steam'));
                const closed = await window.electronAPI.closeSteam();
                if (!closed || await window.electronAPI.isSteamRunning()) {
                    showNotification(t('repair_steam_close_failed'), 'error');
                    return;
                }
            }

            const result = await window.electronAPI.verifyFiles();

            await refreshStatusIndicators();

            if (result.installed) {
                showNotification(t('files_verified'));
                return;
            }

            if (result.alreadyInstalled) {
                showNotification(t('files_already_ok'));
            }
        } catch (error) {
            const isSteamFileLocked = /Steam appears to be using/i.test(error?.message || '');
            showNotification(
                isSteamFileLocked ? t('repair_steam_files_locked') : `${t('download_error')}: ${error.message}`,
                'error'
            );
        }
    });

    // Select Steam manually
    document.getElementById('selectSteamBtn').addEventListener('click', async () => {
        const steamPath = await window.electronAPI.selectSteamPath();
        if (steamPath) {
            config.steamPath = steamPath;
            await window.electronAPI.saveConfig(config);
            updateSteamPathDisplay();
            await refreshStatusIndicators();
            showNotification(t('config_saved'));
        }
    });

    // Add to Steam
    document.getElementById('addToSteamBtn').addEventListener('click', async () => {
        if (!currentAppId) {
            showNotification(t('no_app_id'), 'error');
            return;
        }

        if (!config.steamPath) {
            showNotification(t('steam_not_configured'), 'error');
            return;
        }

        const readiness = await window.electronAPI.validateActivation();
        if (!readiness.ok) {
            if (readiness.reason === 'steam_path_missing') {
                showNotification(t('steam_not_configured'), 'error');
            } else if (readiness.reason === 'steam_path_invalid') {
                showNotification(t('activation_path_invalid'), 'error');
            } else if (readiness.reason === 'required_files_missing') {
                updateFilesStatus(false);
                const missing = readiness.missing?.length
                    ? ` (${readiness.missing.join(', ')})`
                    : '';
                showNotification(`${t('activation_files_missing')}${missing}`, 'error');
            }
            return;
        }

        if (await window.merlinGameInstallPrompt.ask({
            message: `${t('add_confirm')} ${currentAppId}?`
        })) {
            await downloadAndInstallGame(currentAppId);
        }
    });

    // Restart Steam
    document.getElementById('restartSteamBtn').addEventListener('click', async () => {
        if (!config.steamPath) {
            showNotification(t('steam_not_configured'), 'error');
            return;
        }

        if (await askToRestartSteam()) {
            await restartSteam();
        }
    });

    document.getElementById('restartSteamSettingsBtn').addEventListener('click', () => {
        document.getElementById('restartSteamBtn').click();
    });

    // Webview navigation
    document.getElementById('backBtn').addEventListener('click', () => {
        if (webview.canGoBack()) webview.goBack();
    });

    document.getElementById('forwardBtn').addEventListener('click', () => {
        if (webview.canGoForward()) webview.goForward();
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        webview.reload();
    });

    document.getElementById('homeBtn').addEventListener('click', () => {
        const homeUrl = document.getElementById('siteSelector').value;
        if (homeUrl === 'add-games') return;
        webview.src = homeUrl;
    });

    // Site change
    document.getElementById('siteSelector').addEventListener('change', (e) => {
        if (e.target.value === 'add-games') return;
        webview.src = e.target.value;
    });
}

// Setup webview
function setupWebview() {
    webview.addEventListener('did-start-loading', () => {
        document.getElementById('refreshBtn').classList.add('loading');
    });

    webview.addEventListener('did-stop-loading', () => {
        document.getElementById('refreshBtn').classList.remove('loading');
    });

    webview.addEventListener('did-navigate', (e) => {
        updateUrlBar(e.url);
        extractAppId(e.url);
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
        updateUrlBar(e.url);
        extractAppId(e.url);
    });
}

// Update URL bar
function updateUrlBar(url) {
    document.getElementById('urlInput').value = url;
}

// Extract App ID from URL
function extractAppId(url) {
    let appId = null;

    // Steam Store: https://store.steampowered.com/app/XXXXXX/
    const steamStoreMatch = url.match(/store\.steampowered\.com\/app\/(\d+)/);
    if (steamStoreMatch) {
        appId = steamStoreMatch[1];
    }

    // Update App ID
    if (appId) {
        currentAppId = appId;
        document.getElementById('addToSteamBtn').disabled = false;
        document.getElementById('steamContextAppId').textContent = `App ID ${appId} detectado`;
        const bar = document.getElementById('steamContextBar');
        if (bar && window.merlinView?.get?.() === 'steam-store') bar.hidden = false;
        showNotification(`${t('app_detected')} ${appId}`, 'success');
    } else {
        currentAppId = null;
        document.getElementById('addToSteamBtn').disabled = true;
        document.getElementById('steamContextBar').hidden = true;
    }
}

function renderAccountIdentity(session) {
    const accountName = document.getElementById('accountMenuName');
    const sidePlan = document.getElementById('sidePlanLabel');
    if (accountName) accountName.textContent = t('account_menu');
    const tier = String(session?.license?.planTier || '').toLowerCase();
    const hasTier = ['bronze', 'prata', 'ouro'].includes(tier);
    if (sidePlan) {
        sidePlan.dataset.tier = hasTier ? tier : '';
        sidePlan.textContent = hasTier ? `· ${t(`tier_${tier}`)}` : '';
    }
}

window.merlinSteamContext = {
    hasAppId: () => Boolean(currentAppId)
};

function updateFilesStatus(ok) {
    steamFilesAreReady = Boolean(ok);
    const dot = document.getElementById('filesStatus');
    const text = document.getElementById('filesStatusText');

    const popoverDot = document.getElementById('steamPopoverFilesDot');
    const popoverText = document.getElementById('steamFilesPopoverText');
    if (ok) {
        dot?.classList.add('online');
        dot?.classList.remove('offline');
        text?.setAttribute('data-i18n', 'files_ok');
        if (text) text.textContent = t('files_ok');
        popoverDot?.classList.add('online');
        popoverDot?.classList.remove('offline');
        if (popoverText) popoverText.textContent = t('steam_files_installed');
    } else {
        dot?.classList.remove('online');
        dot?.classList.add('offline');
        text?.setAttribute('data-i18n', 'files_missing');
        if (text) text.textContent = t('files_missing');
        popoverDot?.classList.remove('online');
        popoverDot?.classList.add('offline');
        if (popoverText) popoverText.textContent = t('steam_files_repair');
    }

    updateSteamHeaderStatus();
}

// Download and install a game
async function downloadAndInstallGame(appId) {
    try {
        document.getElementById('addToSteamBtn').disabled = true;
        showProgress(t('downloading'), 0);

        const result = await window.electronAPI.downloadGame(appId);

        hideProgress();

        if (result.success) {
            showNotification(t('download_success'), 'success');
            await window.merlinCorrections?.offerFor?.(appId);
            await promptRestartSteamIfRunning();
        } else {
            const translatedError = result.reason ? t(`games_error_${result.reason}`) : '';
            const detail = translatedError && translatedError !== `games_error_${result.reason}`
                ? translatedError
                : result.message;
            showNotification(`${t('download_error')}: ${detail}`, 'error');
        }
    } catch (error) {
        hideProgress();
        showNotification(`${t('download_error')}: ${error.message}`, 'error');
    } finally {
        document.getElementById('addToSteamBtn').disabled = false;
    }
}

// Restart Steam
async function askToRestartSteam() {
    return window.merlinRestartPrompt.ask({
        titleKey: 'restart_prompt_title',
        title: t('restart_prompt_title'),
        message: t('restart_confirm'),
        cancelKey: 'restart_prompt_later',
        cancelLabel: t('restart_prompt_later'),
        actionKey: 'restart_prompt_action',
        actionLabel: t('restart_prompt_action')
    });
}

async function promptRestartSteamIfRunning() {
    if (!await window.electronAPI.isSteamRunning()) {
        return false;
    }

    if (!await askToRestartSteam()) {
        return false;
    }

    await restartSteam();
    return true;
}

async function askToCloseSteamForRepair() {
    return window.merlinRestartPrompt.ask({
        titleKey: 'repair_steam_running_title',
        title: t('repair_steam_running_title'),
        messageKey: 'repair_steam_running_message',
        message: t('repair_steam_running_message'),
        cancelKey: 'repair_steam_running_cancel',
        cancelLabel: t('repair_steam_running_cancel'),
        actionKey: 'repair_steam_running_action',
        actionLabel: t('repair_steam_running_action')
    });
}

async function restartSteam() {
    try {
        showNotification(t('closing_steam'));
        await window.electronAPI.closeSteam();

        await new Promise(resolve => setTimeout(resolve, 3000));

        showNotification(t('starting_steam'));
        await window.electronAPI.startSteam();

        await new Promise(resolve => setTimeout(resolve, 2000));

        showNotification(t('steam_restarted'), 'success');
    } catch (error) {
        showNotification(`${t('download_error')}: ${error.message}`, 'error');
    }
}

// Show progress bar
function showProgress(message, percent) {
    const container = document.getElementById('progressContainer');
    const text = document.getElementById('progressText');
    const percentText = document.getElementById('progressPercent');
    const fill = document.getElementById('progressFill');

    container.style.display = 'block';
    text.textContent = message;
    percentText.textContent = `${percent}%`;
    fill.style.width = `${percent}%`;
}

// Hide progress bar
function hideProgress() {
    const container = document.getElementById('progressContainer');
    setTimeout(() => {
        container.style.display = 'none';
    }, 2000);
}

// Show notification (toast)
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#0066ff'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 60000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

window.showNotification = showNotification;

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

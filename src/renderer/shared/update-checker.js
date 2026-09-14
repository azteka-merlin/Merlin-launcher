(() => {
    const translations = {
        ptbr: {
            title: 'Nova versão disponível',
            message: 'O Merlin {version} está disponível. Você está usando a versão {current}.',
            later: 'Agora não',
            download: 'Baixar atualização',
            badge: 'Atualização',
            downloadingTitle: 'Baixando atualização',
            downloadingMessage: 'A nova versão está sendo baixada dentro do Merlin.',
            preparing: 'Preparando download...',
            downloading: 'Baixando arquivo...',
            completedTitle: 'Download concluído',
            completedMessage: 'A atualização foi baixada com sucesso.',
            cancelledTitle: 'Download cancelado',
            cancelledMessage: 'O download da atualização foi cancelado.',
            errorTitle: 'Não foi possível baixar',
            errorMessage: 'Tente novamente em alguns instantes.',
            cancel: 'Cancelar',
            close: 'Fechar',
            retry: 'Tentar novamente',
            openInstaller: 'Abrir instalador',
            openFolder: 'Abrir pasta'
        },
        en: {
            title: 'New version available',
            message: 'Merlin {version} is available. You are using version {current}.',
            later: 'Later',
            download: 'Download update',
            badge: 'Update',
            downloadingTitle: 'Downloading update',
            downloadingMessage: 'The new version is being downloaded inside Merlin.',
            preparing: 'Preparing download...',
            downloading: 'Downloading file...',
            completedTitle: 'Download complete',
            completedMessage: 'The update was downloaded successfully.',
            cancelledTitle: 'Download cancelled',
            cancelledMessage: 'The update download was cancelled.',
            errorTitle: 'Could not download',
            errorMessage: 'Try again in a few moments.',
            cancel: 'Cancel',
            close: 'Close',
            retry: 'Try again',
            openInstaller: 'Open installer',
            openFolder: 'Open folder'
        },
        es: {
            title: 'Nueva versión disponible',
            message: 'Merlin {version} está disponible. Estás usando la versión {current}.',
            later: 'Ahora no',
            download: 'Descargar actualización',
            badge: 'Actualización',
            downloadingTitle: 'Descargando actualización',
            downloadingMessage: 'La nueva versión se está descargando dentro de Merlin.',
            preparing: 'Preparando descarga...',
            downloading: 'Descargando archivo...',
            completedTitle: 'Descarga completada',
            completedMessage: 'La actualización se descargó correctamente.',
            cancelledTitle: 'Descarga cancelada',
            cancelledMessage: 'La descarga de la actualización fue cancelada.',
            errorTitle: 'No se pudo descargar',
            errorMessage: 'Inténtalo de nuevo en unos instantes.',
            cancel: 'Cancelar',
            close: 'Cerrar',
            retry: 'Intentar de nuevo',
            openInstaller: 'Abrir instalador',
            openFolder: 'Abrir carpeta'
        },
        fr: {
            title: 'Nouvelle version disponible',
            message: 'Merlin {version} est disponible. Vous utilisez la version {current}.',
            later: 'Plus tard',
            download: 'Télécharger la mise à jour',
            badge: 'Mise à jour',
            downloadingTitle: 'Téléchargement de la mise à jour',
            downloadingMessage: 'La nouvelle version est téléchargée dans Merlin.',
            preparing: 'Préparation du téléchargement...',
            downloading: 'Téléchargement du fichier...',
            completedTitle: 'Téléchargement terminé',
            completedMessage: 'La mise à jour a été téléchargée avec succès.',
            cancelledTitle: 'Téléchargement annulé',
            cancelledMessage: 'Le téléchargement de la mise à jour a été annulé.',
            errorTitle: 'Téléchargement impossible',
            errorMessage: 'Réessayez dans quelques instants.',
            cancel: 'Annuler',
            close: 'Fermer',
            retry: 'Réessayer',
            openInstaller: 'Ouvrir l’installateur',
            openFolder: 'Ouvrir le dossier'
        },
        de: {
            title: 'Neue Version verfügbar',
            message: 'Merlin {version} ist verfügbar. Sie verwenden Version {current}.',
            later: 'Später',
            download: 'Update herunterladen',
            badge: 'Update',
            downloadingTitle: 'Update wird heruntergeladen',
            downloadingMessage: 'Die neue Version wird in Merlin heruntergeladen.',
            preparing: 'Download wird vorbereitet...',
            downloading: 'Datei wird heruntergeladen...',
            completedTitle: 'Download abgeschlossen',
            completedMessage: 'Das Update wurde erfolgreich heruntergeladen.',
            cancelledTitle: 'Download abgebrochen',
            cancelledMessage: 'Der Update-Download wurde abgebrochen.',
            errorTitle: 'Download fehlgeschlagen',
            errorMessage: 'Versuchen Sie es in Kürze erneut.',
            cancel: 'Abbrechen',
            close: 'Schließen',
            retry: 'Erneut versuchen',
            openInstaller: 'Installer öffnen',
            openFolder: 'Ordner öffnen'
        }
    };

    const versionBadge = document.getElementById('appVersion');
    const updateNoticeBadge = document.getElementById('updateNoticeBadge');
    const updateNoticeBadgeText = document.getElementById('updateNoticeBadgeText');
    const modal = document.getElementById('updateAvailableModal');
    const title = document.getElementById('updateAvailableTitle');
    const message = document.getElementById('updateAvailableMessage');
    const later = document.getElementById('updateLaterBtn');
    const close = document.getElementById('updateModalCloseBtn');
    const download = document.getElementById('updateDownloadBtn');
    const progress = document.getElementById('updateDownloadProgress');
    const progressStage = document.getElementById('updateDownloadStage');
    const progressPercent = document.getElementById('updateDownloadPercent');
    const progressBar = document.getElementById('updateDownloadBar');
    const progressSize = document.getElementById('updateDownloadSize');
    const progressSpeed = document.getElementById('updateDownloadSpeed');

    let update = null;
    let state = 'available';
    let activeOperationId = null;
    let downloadedFilePath = '';
    let downloadedFolderPath = '';
    let lastProgress = {
        transferredBytes: 0,
        totalBytes: 0,
        speedBytesPerSecond: 0
    };

    function getLanguageText() {
        const language = document.getElementById('settingsLanguageSelect')?.value || 'en';
        return translations[language] || translations.en;
    }

    function formatBytes(bytes) {
        const value = Number(bytes) || 0;
        if (value <= 0) return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = value;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit += 1;
        }
        return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
    }

    function stageLabel(stage) {
        const text = getLanguageText();
        return stage === 'downloading' ? text.downloading : text.preparing;
    }

    function setProgress(percent, transferredBytes = 0, totalBytes = 0, speedBytesPerSecond = 0) {
        const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
        lastProgress = { transferredBytes, totalBytes, speedBytesPerSecond };
        progressPercent.textContent = `${safePercent}%`;
        progressBar.style.width = `${safePercent}%`;
        progressSize.textContent = totalBytes > 0
            ? `${formatBytes(transferredBytes)} / ${formatBytes(totalBytes)}`
            : formatBytes(transferredBytes);
        progressSpeed.textContent = speedBytesPerSecond > 0 ? `${formatBytes(speedBytesPerSecond)}/s` : '—';
    }

    function render() {
        const text = getLanguageText();
        if (updateNoticeBadgeText) updateNoticeBadgeText.textContent = text.badge;
        if (!update) return;

        progress.hidden = state === 'available';
        later.disabled = false;
        download.disabled = false;
        if (close) close.disabled = false;

        if (state === 'downloading') {
            title.textContent = text.downloadingTitle;
            message.textContent = text.downloadingMessage;
            later.textContent = text.cancel;
            later.disabled = false;
            download.textContent = text.download;
            download.disabled = true;
            if (close) close.disabled = false;
            return;
        }

        if (state === 'completed') {
            title.textContent = text.completedTitle;
            message.textContent = text.completedMessage;
            progressStage.textContent = text.completedTitle;
            setProgress(100, lastProgress.transferredBytes, lastProgress.totalBytes, 0);
            later.textContent = text.openFolder;
            download.textContent = text.openInstaller;
            return;
        }

        if (state === 'cancelled') {
            title.textContent = text.cancelledTitle;
            message.textContent = text.cancelledMessage;
            later.textContent = text.close;
            download.textContent = text.retry;
            return;
        }

        if (state === 'error') {
            title.textContent = text.errorTitle;
            message.textContent = text.errorMessage;
            later.textContent = text.close;
            download.textContent = text.retry;
            return;
        }

        title.textContent = text.title;
        message.textContent = text.message
            .replace('{version}', update.latestVersion)
            .replace('{current}', update.currentVersion);
        later.textContent = text.later;
        download.textContent = text.download;
    }

    function resetProgress() {
        progressStage.textContent = stageLabel('preparing');
        setProgress(0, 0, 0, 0);
    }

    async function startDownload() {
        if (!update || state === 'downloading') return;
        activeOperationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        downloadedFilePath = '';
        downloadedFolderPath = '';
        lastProgress = { transferredBytes: 0, totalBytes: 0, speedBytesPerSecond: 0 };
        state = 'downloading';
        resetProgress();
        render();

        const result = await window.electronAPI.downloadUpdate({
            operationId: activeOperationId,
            downloadUrl: update.downloadUrl,
            latestVersion: update.latestVersion
        });

        if (result?.success) {
            downloadedFilePath = result.filePath || '';
            downloadedFolderPath = result.folderPath || '';
            state = 'completed';
        } else {
            state = result?.code === 'cancelled' ? 'cancelled' : 'error';
        }
        activeOperationId = null;
        render();
    }

    async function handleSecondaryAction() {
        if (state === 'downloading') {
            if (activeOperationId) {
                await window.electronAPI.cancelUpdateDownload(activeOperationId);
            }
            return;
        }
        if (state === 'completed' && downloadedFolderPath) {
            await window.electronAPI.openDownloadedUpdateFolder(downloadedFolderPath);
            return;
        }
        modal.hidden = true;
    }

    later.addEventListener('click', handleSecondaryAction);
    close?.addEventListener('click', async () => {
        if (state === 'downloading') {
            if (activeOperationId) {
                await window.electronAPI.cancelUpdateDownload(activeOperationId);
            }
            return;
        }
        modal.hidden = true;
    });

    download.addEventListener('click', async () => {
        if (!update) return;
        if (state === 'completed' && downloadedFilePath) {
            await window.electronAPI.openDownloadedUpdate(downloadedFilePath);
            return;
        }
        await startDownload();
    });

    updateNoticeBadge?.addEventListener('click', () => {
        if (!update) return;
        render();
        modal.hidden = false;
    });

    window.electronAPI.onUpdateDownloadProgress(progressEvent => {
        if (!activeOperationId || progressEvent.operationId !== activeOperationId) return;
        progressStage.textContent = stageLabel(progressEvent.stage);
        setProgress(
            progressEvent.percent,
            progressEvent.transferredBytes,
            progressEvent.totalBytes,
            progressEvent.speedBytesPerSecond
        );
    });

    window.addEventListener('merlin-language-changed', render);

    document.addEventListener('DOMContentLoaded', async () => {
        const version = await window.electronAPI.getVersion();
        versionBadge.textContent = `v${version}`;
        render();

        const result = await window.electronAPI.checkForUpdates();
        if (!result?.success || !result.updateAvailable) return;

        update = result;
        state = 'available';
        render();
        updateNoticeBadge.hidden = false;
        modal.hidden = false;
    });
})();

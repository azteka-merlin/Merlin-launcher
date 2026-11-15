(() => {
    'use strict';

    const messages = {
        ptbr: { profile_title: 'Dados da licença', profile_edit: 'Editar dados', profile_key: 'Chave da licença', profile_name: 'Nome', profile_email: 'E-mail da licença', profile_phone: 'Telefone (opcional)', profile_show: 'Mostrar chave', profile_hide: 'Ocultar chave', profile_change_name: 'Alterar nome', profile_change_email: 'Alterar e-mail', profile_change_phone: 'Alterar telefone', profile_cancel: 'Cancelar', profile_save: 'Salvar alterações', profile_confirm: 'Confirmar e salvar', profile_code: 'Código enviado ao novo e-mail', profile_code_hint: 'Confirme o código para salvar o novo endereço.', profile_code_sent: 'Enviamos um código ao novo e-mail.', profile_stage_code: 'No staging, use o código de teste 12345.', profile_saved: 'Dados cadastrais atualizados.', profile_invalid_name: 'Informe um nome com pelo menos 2 caracteres.', profile_invalid_email: 'Informe um e-mail válido.', profile_invalid_phone: 'Informe um telefone válido ou deixe o campo vazio.', profile_invalid_code: 'Confira o código de 5 dígitos.', profile_email_in_use: 'Este e-mail já está cadastrado em outra licença.', profile_rate_limited: 'Aguarde um pouco antes de tentar novamente.', profile_error: 'Não foi possível atualizar os dados agora. Tente novamente.', profile_load_error: 'Não foi possível carregar os dados da licença.' },
        en: { profile_title: 'License details', profile_edit: 'Edit details', profile_key: 'License key', profile_name: 'Name', profile_email: 'License email', profile_phone: 'Phone (optional)', profile_show: 'Show key', profile_hide: 'Hide key', profile_change_name: 'Edit name', profile_change_email: 'Edit email', profile_change_phone: 'Edit phone', profile_cancel: 'Cancel', profile_save: 'Save changes', profile_confirm: 'Confirm and save', profile_code: 'Code sent to the new email', profile_code_hint: 'Confirm the code to save the new address.', profile_code_sent: 'We sent a code to the new email.', profile_stage_code: 'In staging, use test code 12345.', profile_saved: 'Account details updated.', profile_invalid_name: 'Enter a name with at least 2 characters.', profile_invalid_email: 'Enter a valid email.', profile_invalid_phone: 'Enter a valid phone or leave it blank.', profile_invalid_code: 'Check the 5-digit code.', profile_email_in_use: 'This email is registered to another license.', profile_rate_limited: 'Wait a little before trying again.', profile_error: 'Could not update your details. Try again.', profile_load_error: 'Could not load license details.' },
        es: { profile_title: 'Datos de la licencia', profile_edit: 'Editar datos', profile_key: 'Clave de licencia', profile_name: 'Nombre', profile_email: 'Correo de la licencia', profile_phone: 'Teléfono (opcional)', profile_show: 'Mostrar clave', profile_hide: 'Ocultar clave', profile_change_name: 'Cambiar nombre', profile_change_email: 'Cambiar correo', profile_change_phone: 'Cambiar teléfono', profile_cancel: 'Cancelar', profile_save: 'Guardar cambios', profile_confirm: 'Confirmar y guardar', profile_code: 'Código enviado al nuevo correo', profile_code_hint: 'Confirma el código para guardar la nueva dirección.', profile_code_sent: 'Enviamos un código al nuevo correo.', profile_stage_code: 'En staging, usa el código de prueba 12345.', profile_saved: 'Datos actualizados.', profile_invalid_name: 'Introduce un nombre de al menos 2 caracteres.', profile_invalid_email: 'Introduce un correo válido.', profile_invalid_phone: 'Introduce un teléfono válido o deja el campo vacío.', profile_invalid_code: 'Comprueba el código de 5 dígitos.', profile_email_in_use: 'Este correo ya pertenece a otra licencia.', profile_rate_limited: 'Espera un momento antes de intentarlo otra vez.', profile_error: 'No se pudieron actualizar los datos.', profile_load_error: 'No se pudieron cargar los datos de la licencia.' },
        fr: { profile_title: 'Données de la licence', profile_edit: 'Modifier', profile_key: 'Clé de licence', profile_name: 'Nom', profile_email: 'E-mail de la licence', profile_phone: 'Téléphone (facultatif)', profile_show: 'Afficher la clé', profile_hide: 'Masquer la clé', profile_change_name: 'Modifier le nom', profile_change_email: 'Modifier l’e-mail', profile_change_phone: 'Modifier le téléphone', profile_cancel: 'Annuler', profile_save: 'Enregistrer', profile_confirm: 'Confirmer et enregistrer', profile_code: 'Code envoyé au nouvel e-mail', profile_code_hint: 'Confirmez le code pour enregistrer la nouvelle adresse.', profile_code_sent: 'Un code a été envoyé au nouvel e-mail.', profile_stage_code: 'En staging, utilisez le code test 12345.', profile_saved: 'Coordonnées mises à jour.', profile_invalid_name: 'Saisissez un nom de 2 caractères minimum.', profile_invalid_email: 'Saisissez un e-mail valide.', profile_invalid_phone: 'Saisissez un téléphone valide ou laissez vide.', profile_invalid_code: 'Vérifiez le code à 5 chiffres.', profile_email_in_use: 'Cet e-mail appartient à une autre licence.', profile_rate_limited: 'Attendez avant de réessayer.', profile_error: 'Impossible de mettre à jour les données.', profile_load_error: 'Impossible de charger les données de la licence.' },
        de: { profile_title: 'Lizenzdaten', profile_edit: 'Daten ändern', profile_key: 'Lizenzschlüssel', profile_name: 'Name', profile_email: 'Lizenz-E-Mail', profile_phone: 'Telefon (optional)', profile_show: 'Schlüssel anzeigen', profile_hide: 'Schlüssel verbergen', profile_change_name: 'Name ändern', profile_change_email: 'E-Mail ändern', profile_change_phone: 'Telefon ändern', profile_cancel: 'Abbrechen', profile_save: 'Änderungen speichern', profile_confirm: 'Bestätigen und speichern', profile_code: 'Code an neue E-Mail gesendet', profile_code_hint: 'Bestätigen Sie den Code, um die neue Adresse zu speichern.', profile_code_sent: 'Wir haben einen Code an die neue E-Mail gesendet.', profile_stage_code: 'Im Staging den Testcode 12345 verwenden.', profile_saved: 'Kontaktdaten aktualisiert.', profile_invalid_name: 'Geben Sie einen Namen mit mindestens 2 Zeichen ein.', profile_invalid_email: 'Geben Sie eine gültige E-Mail ein.', profile_invalid_phone: 'Geben Sie eine gültige Telefonnummer ein oder lassen Sie das Feld leer.', profile_invalid_code: 'Prüfen Sie den fünfstelligen Code.', profile_email_in_use: 'Diese E-Mail gehört zu einer anderen Lizenz.', profile_rate_limited: 'Warten Sie vor dem nächsten Versuch.', profile_error: 'Die Daten konnten nicht aktualisiert werden.', profile_load_error: 'Die Lizenzdaten konnten nicht geladen werden.' },
    };
    const drawerMessages = {
        ptbr: { profile_drawer_title: 'Editar dados da licença', profile_drawer_description: 'Atualize seus dados cadastrais. A chave da licença não pode ser alterada.', profile_readonly: 'Somente leitura', profile_close: 'Fechar', profile_none: 'Não informado', profile_summary_email: 'E-mail', profile_summary_phone: 'Telefone', profile_invalid_email: 'Formato do e-mail inválido.', profile_invalid_code: 'Confira o código recebido.' },
        en: { profile_drawer_title: 'Edit license details', profile_drawer_description: 'Update your account details. The license key cannot be changed.', profile_readonly: 'Read only', profile_close: 'Close', profile_none: 'Not provided', profile_summary_email: 'Email', profile_summary_phone: 'Phone', profile_invalid_email: 'Invalid email format.', profile_invalid_code: 'Check the code you received.' },
        es: { profile_drawer_title: 'Editar datos de la licencia', profile_drawer_description: 'Actualiza tus datos. La clave de licencia no se puede cambiar.', profile_readonly: 'Solo lectura', profile_close: 'Cerrar', profile_none: 'No informado', profile_summary_email: 'Correo', profile_summary_phone: 'Teléfono', profile_invalid_email: 'Formato de correo inválido.', profile_invalid_code: 'Comprueba el código recibido.' },
        fr: { profile_drawer_title: 'Modifier la licence', profile_drawer_description: 'Modifiez vos coordonnées. La clé de licence ne peut pas être modifiée.', profile_readonly: 'Lecture seule', profile_close: 'Fermer', profile_none: 'Non renseigné', profile_summary_email: 'E-mail', profile_summary_phone: 'Téléphone', profile_invalid_email: 'Format d’e-mail invalide.', profile_invalid_code: 'Vérifiez le code reçu.' },
        de: { profile_drawer_title: 'Lizenzdaten ändern', profile_drawer_description: 'Aktualisieren Sie Ihre Daten. Der Lizenzschlüssel kann nicht geändert werden.', profile_readonly: 'Schreibgeschützt', profile_close: 'Schließen', profile_none: 'Nicht angegeben', profile_summary_email: 'E-Mail', profile_summary_phone: 'Telefon', profile_invalid_email: 'Ungültiges E-Mail-Format.', profile_invalid_code: 'Prüfen Sie den erhaltenen Code.' },
    };
    for (const [language, values] of Object.entries(drawerMessages)) Object.assign(messages[language], values);
    window.merlinI18n.register(messages);

    document.addEventListener('DOMContentLoaded', () => {
        const id = name => document.getElementById(`accessProfile${name}`);
        const card = id('Card');
        const overlay = id('Overlay');
        const drawer = id('Drawer');
        const close = id('Close');
        const cardFeedback = id('CardFeedback');
        const fields = { name: id('Name'), email: id('Email'), phone: id('Phone') };
        const key = id('Key');
        const drawerKey = id('DrawerKey');
        const eye = id('Eye');
        const edit = id('Edit');
        const save = id('Save');
        const cancel = id('Cancel');
        const verification = id('Verification');
        const code = id('Code');
        const codeDigits = Array.from({ length: 6 }, (_, index) => id(`CodeDigit${index}`));
        const feedback = id('Feedback');
        const emailError = id('EmailError');
        const view = document.getElementById('accessView');
        let profile = null;
        let editing = false;
        let busy = false;
        let generation = 0;
        let verifiedEmail = '';
        let closeTimer = null;
        const tr = name => window.merlinI18n.t(name);
        const emailPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

        function syncCode() {
            code.value = codeDigits.map(input => input.value || ' ').join('').trimEnd();
        }

        function clearCode() {
            for (const input of codeDigits) input.value = '';
            code.value = '';
        }

        function fillCode(value, start = 0) {
            const digits = String(value || '').replace(/\D/g, '').slice(0, 6 - start);
            for (let offset = 0; offset < digits.length; offset++) codeDigits[start + offset].value = digits[offset];
            syncCode();
            codeDigits[Math.min(5, start + digits.length)].focus();
        }

        function formatPhone(value) {
            const raw = String(value || '').trim();
            const digits = raw.replace(/\D/g, '');
            let national = digits;
            let prefix = '';
            if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
                national = digits.slice(2);
                prefix = '+55 ';
            } else if (raw.startsWith('+') || digits.length > 11) {
                return raw;
            }
            if (!national) return prefix.trim();
            if (national.length <= 2) return `${prefix}(${national}`;
            if (national.length <= 7) return `${prefix}(${national.slice(0, 2)}) ${national.slice(2)}`;
            const split = national.length > 10 ? 7 : 6;
            return `${prefix}(${national.slice(0, 2)}) ${national.slice(2, split)}-${national.slice(split)}`;
        }

        function formatPhoneInput(event) {
            if (event.isComposing) return;
            const input = fields.phone;
            const before = input.value;
            const formatted = formatPhone(before);
            if (formatted === before) return;
            const selection = [input.selectionStart, input.selectionEnd];
            input.value = formatted;
            if (selection.every(position => typeof position === 'number') && input.setSelectionRange) {
                const offsets = selection.map(position => {
                    const count = before.slice(0, position).replace(/[^+0-9]/g, '').length;
                    if (!count) return 0;
                    let seen = 0;
                    for (let index = 0; index < formatted.length; index++) {
                        if (/[+0-9]/.test(formatted[index]) && ++seen === count) return index + 1;
                    }
                    return formatted.length;
                });
                input.setSelectionRange(...offsets);
            }
        }

        function message(name, success = false) {
            feedback.textContent = name ? tr(name) : '';
            feedback.hidden = !name;
            feedback.dataset.state = success ? 'success' : 'error';
        }

        function setEmailError(visible) {
            emailError.textContent = visible ? tr('profile_invalid_email') : '';
            emailError.hidden = !visible;
            fields.email.setAttribute('aria-invalid', String(visible));
        }

        function hideKey() {
            key.type = 'password';
            drawerKey.type = 'password';
            eye.setAttribute('aria-pressed', 'false');
            eye.setAttribute('aria-label', tr('profile_show'));
            eye.querySelector('img').src = 'node_modules/lucide-static/icons/eye.svg';
        }

        function render() {
            if (!profile) return;
            key.value = profile.licenseKey || '';
            drawerKey.value = profile.licenseKey || '';
            id('SummaryName').textContent = profile.name || tr('profile_none');
            id('SummaryEmail').textContent = profile.email || tr('profile_none');
            id('SummaryPhone').textContent = profile.phone ? formatPhone(profile.phone) : tr('profile_none');
        }

        function finishClose() {
            if (closeTimer !== null) clearTimeout(closeTimer);
            closeTimer = null;
            overlay.hidden = true;
            overlay.dataset.state = '';
            verifiedEmail = '';
            clearCode();
            verification.hidden = true;
            setEmailError(false);
            message('');
            if (!view.hidden) edit.focus();
        }

        function closeDrawer(force = false, immediate = false) {
            if (busy && !force) return;
            if (overlay.hidden) return;
            if (overlay.dataset.state === 'closing') { if (immediate) finishClose(); return; }
            generation += 1;
            editing = false;
            hideKey();
            if (immediate || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
                finishClose();
                return;
            }
            overlay.dataset.state = 'closing';
            closeTimer = setTimeout(finishClose, 180);
        }

        function openDrawer() {
            if (!profile) return;
            if (closeTimer !== null) clearTimeout(closeTimer);
            closeTimer = null;
            overlay.dataset.state = '';
            editing = true;
            hideKey();
            cardFeedback.hidden = true;
            fields.name.value = profile.name || '';
            fields.email.value = profile.email || '';
            fields.phone.value = formatPhone(profile.phone);
            verifiedEmail = '';
            clearCode();
            verification.hidden = true;
            save.textContent = tr('profile_save');
            setEmailError(false);
            message('');
            render();
            overlay.hidden = false;
            fields.name.focus();
        }

        function applyLabels() {
            const labels = [['Title', 'profile_title'], ['EditText', 'profile_edit'], ['Cancel', 'profile_cancel'],
                ['DrawerTitle', 'profile_drawer_title'], ['DrawerDescription', 'profile_drawer_description'],
                ['DrawerKeyLabel', 'profile_key'], ['Readonly', 'profile_readonly'],
                ['SummaryKeyLabel', 'profile_key'], ['SummaryNameLabel', 'profile_name'],
                ['SummaryEmailLabel', 'profile_summary_email'], ['SummaryPhoneLabel', 'profile_summary_phone']];
            for (const [suffix, text] of labels) id(suffix).textContent = tr(text);
            for (const field of Object.keys(fields)) {
                drawer.querySelector(`label[for="accessProfile${field[0].toUpperCase()}${field.slice(1)}"]`).textContent = tr(`profile_${field}`);
            }
            verification.querySelector('label').textContent = tr('profile_code');
            verification.querySelector('p').textContent = tr('profile_code_hint');
            codeDigits.forEach((input, index) => input.setAttribute('aria-label', `${tr('profile_code')} ${index + 1}`));
            save.textContent = verifiedEmail ? tr('profile_confirm') : tr('profile_save');
            eye.setAttribute('aria-label', tr(key.type === 'password' ? 'profile_show' : 'profile_hide'));
            close.setAttribute('aria-label', tr('profile_close'));
            key.setAttribute('aria-label', tr('profile_key'));
            if (!emailError.hidden) emailError.textContent = tr('profile_invalid_email');
            if (profile) render();
        }

        async function load() {
            if (editing || busy) return;
            const request = ++generation;
            try {
                const result = await window.electronAPI.auth.getProfile();
                if (request !== generation || view.hidden) return;
                if (!result?.ok || !result.profile) throw new Error('profile_unavailable');
                profile = result.profile;
                card.hidden = false;
                hideKey();
                render();
                message('');
            } catch (_) {
                if (request !== generation) return;
                card.hidden = true;
            }
        }

        function errorKey(codeValue) {
            return ({ email_in_use: 'profile_email_in_use', rate_limited: 'profile_rate_limited',
                invalid_code: 'profile_invalid_code', verification_required: 'profile_invalid_code' })[codeValue] || 'profile_error';
        }

        async function saveProfile() {
            if (busy || !editing || !profile) return;
            const next = Object.fromEntries(Object.entries(fields).map(([field, input]) => [field,
                input.value.trim()]));
            if (next.name.length < 2 || next.name.length > 100) return message('profile_invalid_name');
            if (!emailPattern.test(next.email)) {
                setEmailError(true);
                fields.email.focus();
                return;
            }
            setEmailError(false);
            const digits = next.phone.replace(/\D/g, '');
            if (next.phone && (digits.length < 8 || digits.length > 15)) return message('profile_invalid_phone');
            const emailChanged = next.email.toLowerCase() !== String(profile.email || '').toLowerCase();
            const request = generation;
            busy = true;
            save.disabled = true;
            try {
                if (emailChanged && verifiedEmail !== next.email.toLowerCase()) {
                    const started = await window.electronAPI.auth.startProfileEmailVerification(next.email);
                    if (request !== generation) return;
                    if (!started?.ok) {
                        if (started?.code === 'invalid_email') { setEmailError(true); fields.email.focus(); return; }
                        return message(errorKey(started?.code));
                    }
                    verifiedEmail = next.email.toLowerCase();
                    verification.hidden = false;
                    save.textContent = tr('profile_confirm');
                    message(started.deliveryMode === 'staging_test' ? 'profile_stage_code' : 'profile_code_sent', true);
                    codeDigits[0].focus();
                    return;
                }
                const emailCode = emailChanged ? code.value.trim() : undefined;
                if (emailChanged && !/^(?:\d{6}|12345)$/.test(emailCode)) return message('profile_invalid_code');
                const result = await window.electronAPI.auth.updateProfile({ ...next, phone: next.phone || null, emailCode });
                if (request !== generation) return;
                if (!result?.ok || !result.profile) return message(errorKey(result?.code));
                profile = result.profile;
                render();
                closeDrawer(true);
                cardFeedback.textContent = tr('profile_saved');
                cardFeedback.hidden = false;
                window.dispatchEvent(new CustomEvent('merlin-profile-updated', { detail: { name: profile.name } }));
            } catch (_) {
                if (request === generation) message('profile_error');
            } finally {
                busy = false;
                save.disabled = false;
            }
        }

        eye.addEventListener('click', () => {
            const visible = key.type === 'password';
            key.type = visible ? 'text' : 'password';
            drawerKey.type = key.type;
            eye.setAttribute('aria-pressed', String(visible));
            eye.setAttribute('aria-label', tr(visible ? 'profile_hide' : 'profile_show'));
            eye.querySelector('img').src = `node_modules/lucide-static/icons/${visible ? 'eye-off' : 'eye'}.svg`;
        });
        edit.addEventListener('click', openDrawer);
        close.addEventListener('click', () => closeDrawer());
        cancel.addEventListener('click', () => closeDrawer());
        overlay.addEventListener('click', event => { if (event.target === overlay) closeDrawer(); });
        save.addEventListener('click', () => void saveProfile());
        fields.phone.addEventListener('input', formatPhoneInput);
        codeDigits.forEach((input, index) => {
            input.addEventListener('input', () => {
                const digits = input.value.replace(/\D/g, '');
                input.value = digits.slice(-1);
                syncCode();
                if (input.value && index < 5) codeDigits[index + 1].focus();
            });
            input.addEventListener('paste', event => {
                event.preventDefault();
                fillCode(event.clipboardData?.getData('text'), index);
            });
            input.addEventListener('keydown', event => {
                if (event.key === 'Backspace' && !input.value && index > 0) codeDigits[index - 1].focus();
                if (event.key === 'ArrowLeft' && index > 0) codeDigits[index - 1].focus();
                if (event.key === 'ArrowRight' && index < 5) codeDigits[index + 1].focus();
            });
        });
        fields.email.addEventListener('input', () => {
            setEmailError(false);
            if (verifiedEmail && fields.email.value.trim().toLowerCase() !== verifiedEmail) {
                verifiedEmail = '';
                clearCode();
                verification.hidden = true;
                save.textContent = tr('profile_save');
                message('');
            }
        });
        document.addEventListener('keydown', event => {
            if (overlay.hidden) return;
            if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [close, drawerKey, fields.name, fields.email, fields.phone,
                ...(!verification.hidden ? codeDigits : []), cancel, save].filter(element => !element.disabled);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        window.addEventListener('merlin-view-changed', event => {
            if (event.detail?.view === 'access') void load();
            else { hideKey(); if (!overlay.hidden) closeDrawer(true, true); }
        });
        window.addEventListener('focus', () => { if (!view.hidden) void load(); });
        window.addEventListener('merlin-logout', () => {
            if (closeTimer !== null) clearTimeout(closeTimer);
            closeTimer = null;
            generation += 1;
            profile = null;
            editing = false;
            overlay.hidden = true;
            overlay.dataset.state = '';
            verifiedEmail = '';
            clearCode();
            key.value = '';
            drawerKey.value = '';
            card.hidden = true;
            cardFeedback.hidden = true;
            hideKey();
        });
        window.addEventListener('merlin-language-changed', applyLabels);
        applyLabels();
    });
})();

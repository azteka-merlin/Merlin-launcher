(function () {
    'use strict';

    const messages = {
        ptbr: { tier_bronze: 'Bronze', tier_prata: 'Prata', tier_ouro: 'Ouro', access_eyebrow: 'CONTA MERLIN', access_subtitle: 'Detalhes reais da sua licença e dos benefícios disponíveis.', access_loading: 'Consultando seu acesso…', access_error: 'Não foi possível atualizar os detalhes do seu acesso agora.', access_current: 'SEU ACESSO ATUAL', access_benefits_title: 'Como funciona seu acesso', access_usage_title: 'Uso no ciclo atual', access_cooldown_title: 'Ativação em andamento', access_manage_subscription: 'Gerenciar assinatura', access_manage: 'Gerenciar acesso', access_view_plans: 'Ver planos', access_test: 'Licença de teste', access_free: 'Acesso Merlin', access_active: 'Acesso ativo', access_status_available: 'Status da licença disponível na sua conta', access_valid_until: 'Válido até {date}', access_plan_bronze: 'Plano Bronze', access_plan_prata: 'Plano Prata', access_plan_ouro: 'Plano Ouro', access_test_limit: 'Os limites desta licença são aplicados no momento de cada ativação.', access_test_catalog: 'A disponibilidade de cada jogo aparece diretamente no catálogo Premium.', access_free_restricted: 'Alguns jogos Premium podem exigir um plano com acesso ao catálogo completo.', access_free_catalog: 'A disponibilidade de cada jogo é mostrada no catálogo Premium.', access_free_plans: 'Consulte os planos para ver os benefícios disponíveis para sua conta.', access_bronze_release: 'Novos jogos ficam disponíveis até 7 dias após o lançamento.', access_bronze_limit: 'Até 3 ativações Premium por ciclo mensal.', access_global_cooldown: 'Cooldown global entre ativações: 24 horas.', access_prata_release: 'Novos jogos ficam disponíveis até 5 dias após o lançamento.', access_unlimited: 'Ativações Premium sem limite de ciclo.', access_ouro_release: 'Novos jogos ficam disponíveis até 48 horas após o lançamento.', access_ouro_cooldown: 'O cooldown de uma nova ativação é informado em cada jogo.', access_usage_text: '{used} de {limit} ativações Premium usadas neste ciclo.', access_cooldown_text: 'Uma ativação está em cooldown até {date}.' },
        en: { tier_bronze: 'Bronze', tier_prata: 'Silver', tier_ouro: 'Gold', access_eyebrow: 'MERLIN ACCOUNT', access_subtitle: 'Real details about your license and available benefits.', access_loading: 'Checking your access…', access_error: 'We could not refresh your access details right now.', access_current: 'YOUR CURRENT ACCESS', access_benefits_title: 'How your access works', access_usage_title: 'Current cycle usage', access_cooldown_title: 'Activation in progress', access_manage_subscription: 'Manage subscription', access_manage: 'Manage access', access_view_plans: 'View plans', access_test: 'Test license', access_free: 'Merlin access', access_active: 'Access active', access_status_available: 'Your license status is available in your account', access_valid_until: 'Valid until {date}', access_plan_bronze: 'Bronze plan', access_plan_prata: 'Silver plan', access_plan_ouro: 'Gold plan', access_test_limit: 'This license’s limits are applied at each activation.', access_test_catalog: 'Each game’s availability appears directly in the Premium catalog.', access_free_restricted: 'Some Premium games may require a plan with full catalog access.', access_free_catalog: 'Each game’s availability is shown in the Premium catalog.', access_free_plans: 'See plans to review the benefits available to your account.', access_bronze_release: 'New games become available up to 7 days after launch.', access_bronze_limit: 'Up to 3 Premium activations per monthly cycle.', access_global_cooldown: 'Global cooldown between activations: 24 hours.', access_prata_release: 'New games become available up to 5 days after launch.', access_unlimited: 'Unlimited Premium activations per cycle.', access_ouro_release: 'New games become available up to 48 hours after launch.', access_ouro_cooldown: 'The cooldown for a new activation is shown for each game.', access_usage_text: '{used} of {limit} Premium activations used this cycle.', access_cooldown_text: 'An activation is in cooldown until {date}.' },
        es: { tier_bronze: 'Bronce', tier_prata: 'Plata', tier_ouro: 'Oro', access_eyebrow: 'CUENTA MERLIN', access_subtitle: 'Detalles reales de tu licencia y beneficios disponibles.', access_loading: 'Consultando tu acceso…', access_error: 'No fue posible actualizar los detalles de tu acceso ahora.', access_current: 'TU ACCESO ACTUAL', access_benefits_title: 'Cómo funciona tu acceso', access_usage_title: 'Uso del ciclo actual', access_cooldown_title: 'Activación en curso', access_manage_subscription: 'Gestionar suscripción', access_manage: 'Gestionar acceso', access_view_plans: 'Ver planes', access_test: 'Licencia de prueba', access_free: 'Acceso Merlin', access_active: 'Acceso activo', access_status_available: 'El estado de tu licencia está disponible en tu cuenta', access_valid_until: 'Válido hasta {date}', access_plan_bronze: 'Plan Bronce', access_plan_prata: 'Plan Plata', access_plan_ouro: 'Plan Oro', access_test_limit: 'Los límites de esta licencia se aplican en cada activación.', access_test_catalog: 'La disponibilidad de cada juego aparece directamente en el catálogo Premium.', access_free_restricted: 'Algunos juegos Premium pueden requerir un plan con acceso completo al catálogo.', access_free_catalog: 'La disponibilidad de cada juego se muestra en el catálogo Premium.', access_free_plans: 'Consulta los planes para ver los beneficios disponibles para tu cuenta.', access_bronze_release: 'Los juegos nuevos están disponibles hasta 7 días después del lanzamiento.', access_bronze_limit: 'Hasta 3 activaciones Premium por ciclo mensual.', access_global_cooldown: 'Cooldown global entre activaciones: 24 horas.', access_prata_release: 'Los juegos nuevos están disponibles hasta 5 días después del lanzamiento.', access_unlimited: 'Activaciones Premium ilimitadas por ciclo.', access_ouro_release: 'Los juegos nuevos están disponibles hasta 48 horas después del lanzamiento.', access_ouro_cooldown: 'El cooldown de una nueva activación se informa en cada juego.', access_usage_text: '{used} de {limit} activaciones Premium usadas en este ciclo.', access_cooldown_text: 'Una activación está en cooldown hasta {date}.' },
        fr: { tier_bronze: 'Bronze', tier_prata: 'Argent', tier_ouro: 'Or', access_eyebrow: 'COMPTE MERLIN', access_subtitle: 'Informations réelles sur votre licence et les avantages disponibles.', access_loading: 'Vérification de votre accès…', access_error: 'Impossible d’actualiser les détails de votre accès actuellement.', access_current: 'VOTRE ACCÈS ACTUEL', access_benefits_title: 'Comment fonctionne votre accès', access_usage_title: 'Utilisation du cycle actuel', access_cooldown_title: 'Activation en cours', access_manage_subscription: 'Gérer l’abonnement', access_manage: 'Gérer l’accès', access_view_plans: 'Voir les forfaits', access_test: 'Licence de test', access_free: 'Accès Merlin', access_active: 'Accès actif', access_status_available: 'Le statut de votre licence est disponible dans votre compte', access_valid_until: 'Valide jusqu’au {date}', access_plan_bronze: 'Forfait Bronze', access_plan_prata: 'Forfait Argent', access_plan_ouro: 'Forfait Or', access_test_limit: 'Les limites de cette licence sont appliquées à chaque activation.', access_test_catalog: 'La disponibilité de chaque jeu apparaît directement dans le catalogue Premium.', access_free_restricted: 'Certains jeux Premium peuvent nécessiter un forfait avec accès complet au catalogue.', access_free_catalog: 'La disponibilité de chaque jeu est affichée dans le catalogue Premium.', access_free_plans: 'Consultez les forfaits pour voir les avantages disponibles.', access_bronze_release: 'Les nouveaux jeux sont disponibles jusqu’à 7 jours après leur sortie.', access_bronze_limit: 'Jusqu’à 3 activations Premium par cycle mensuel.', access_global_cooldown: 'Cooldown global entre les activations : 24 heures.', access_prata_release: 'Les nouveaux jeux sont disponibles jusqu’à 5 jours après leur sortie.', access_unlimited: 'Activations Premium illimitées par cycle.', access_ouro_release: 'Les nouveaux jeux sont disponibles jusqu’à 48 heures après leur sortie.', access_ouro_cooldown: 'Le cooldown d’une nouvelle activation est indiqué pour chaque jeu.', access_usage_text: '{used} sur {limit} activations Premium utilisées ce cycle.', access_cooldown_text: 'Une activation est en cooldown jusqu’au {date}.' },
        de: { tier_bronze: 'Bronze', tier_prata: 'Silber', tier_ouro: 'Gold', access_eyebrow: 'MERLIN-KONTO', access_subtitle: 'Echte Details zu Ihrer Lizenz und verfügbaren Vorteilen.', access_loading: 'Ihr Zugang wird geprüft…', access_error: 'Ihre Zugangsdaten konnten gerade nicht aktualisiert werden.', access_current: 'IHR AKTUELLER ZUGANG', access_benefits_title: 'So funktioniert Ihr Zugang', access_usage_title: 'Nutzung im aktuellen Zyklus', access_cooldown_title: 'Aktivierung läuft', access_manage_subscription: 'Abonnement verwalten', access_manage: 'Zugang verwalten', access_view_plans: 'Pläne ansehen', access_test: 'Testlizenz', access_free: 'Merlin-Zugang', access_active: 'Zugang aktiv', access_status_available: 'Der Status Ihrer Lizenz ist in Ihrem Konto verfügbar', access_valid_until: 'Gültig bis {date}', access_plan_bronze: 'Bronze-Plan', access_plan_prata: 'Silber-Plan', access_plan_ouro: 'Gold-Plan', access_test_limit: 'Die Grenzen dieser Lizenz werden bei jeder Aktivierung angewendet.', access_test_catalog: 'Die Verfügbarkeit jedes Spiels wird direkt im Premium-Katalog angezeigt.', access_free_restricted: 'Einige Premium-Spiele benötigen möglicherweise einen Plan mit vollem Katalogzugang.', access_free_catalog: 'Die Verfügbarkeit jedes Spiels wird im Premium-Katalog angezeigt.', access_free_plans: 'Sehen Sie sich die Pläne und verfügbaren Vorteile an.', access_bronze_release: 'Neue Spiele werden bis zu 7 Tage nach Veröffentlichung verfügbar.', access_bronze_limit: 'Bis zu 3 Premium-Aktivierungen pro Monatszyklus.', access_global_cooldown: 'Globaler Cooldown zwischen Aktivierungen: 24 Stunden.', access_prata_release: 'Neue Spiele werden bis zu 5 Tage nach Veröffentlichung verfügbar.', access_unlimited: 'Unbegrenzte Premium-Aktivierungen pro Zyklus.', access_ouro_release: 'Neue Spiele werden bis zu 48 Stunden nach Veröffentlichung verfügbar.', access_ouro_cooldown: 'Der Cooldown einer neuen Aktivierung wird bei jedem Spiel angezeigt.', access_usage_text: '{used} von {limit} Premium-Aktivierungen in diesem Zyklus genutzt.', access_cooldown_text: 'Eine Aktivierung ist bis {date} im Cooldown.' }
    };
    window.merlinI18n.register(messages);
    const tr = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), window.merlinI18n.t(key));
    const tierNames = { bronze: () => tr('access_plan_bronze'), prata: () => tr('access_plan_prata'), ouro: () => tr('access_plan_ouro') };
    const tierArtwork = {
        bronze: 'assets/plans/plano-bronze.png',
        prata: 'assets/plans/plano-prata.png',
        ouro: 'assets/plans/plano-ouro.png'
    };

    function formatDate(value) {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const locale = { ptbr: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }[window.merlinI18n.current()] || 'en-US';
        // Numeric dates keep the expiry block compact in every supported
        // language and prevent localized month names from wrapping.
        return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    }

    function firstViewer(items) {
        return items.map(item => item?.viewer).find(viewer => viewer && typeof viewer === 'object') || null;
    }

    function benefitLines(tier, viewer, isTest, isFree) {
        if (isTest) return [
            tr('access_test_limit'), tr('access_test_catalog')
        ];
        if (isFree) return [
            viewer?.lockedReason === 'free_catalog_cutoff'
                ? tr('access_free_restricted') : tr('access_free_catalog'),
            tr('access_free_plans')
        ];
        if (tier === 'bronze') return [
            tr('access_bronze_release'), tr('access_bronze_limit'), tr('access_global_cooldown')
        ];
        if (tier === 'prata') return [
            tr('access_prata_release'), tr('access_unlimited'), tr('access_global_cooldown')
        ];
        return [
            tr('access_ouro_release'), tr('access_unlimited'), tr('access_ouro_cooldown')
        ];
    }

    document.addEventListener('DOMContentLoaded', () => {
        const elements = {
            view: document.getElementById('accessView'),
            loading: document.getElementById('accessLoading'), error: document.getElementById('accessError'), details: document.getElementById('accessDetails'),
            plan: document.getElementById('accessPlanName'), status: document.getElementById('accessLicenseStatus'), expiry: document.getElementById('accessExpiry'),
            benefits: document.getElementById('accessBenefits'), usage: document.getElementById('accessUsageCard'), usageText: document.getElementById('accessUsageText'),
            cooldown: document.getElementById('accessCooldownCard'), cooldownText: document.getElementById('accessCooldownText'),
            artwork: document.getElementById('accessArtwork'), artworkImage: document.getElementById('accessArtworkImage'), manage: document.getElementById('accessManageBtn'), plans: document.getElementById('accessPlansBtn'),
            sidePlan: document.getElementById('sidePlanLabel')
        };
        let loaded = false;
        let accessState = null;

        function setArtwork(path) {
            const hasArtwork = Boolean(path);
            elements.artwork.classList.remove('has-artwork');
            elements.artwork.classList.toggle('is-loading', hasArtwork);
            elements.artworkImage.hidden = true;
            elements.artworkImage.removeAttribute('src');

            if (!hasArtwork) return;

            elements.artworkImage.onload = () => {
                elements.artwork.classList.remove('is-loading');
                elements.artwork.classList.add('has-artwork');
                elements.artworkImage.hidden = false;
            };
            elements.artworkImage.onerror = () => {
                elements.artwork.classList.remove('is-loading');
                elements.artworkImage.hidden = true;
            };
            elements.artworkImage.src = path;
        }

        function showArtworkSkeleton() {
            elements.artwork.classList.remove('has-artwork');
            elements.artwork.classList.add('is-loading');
            elements.artworkImage.hidden = true;
            elements.artworkImage.removeAttribute('src');
        }

        function renderAccessState(state) {
            if (!state) return;
            const { tier, isTest, isFree, viewer, license, used, limit, cooldownItem, canManageSubscription } = state;
            const label = isTest ? tr('access_test') : (isFree ? tr('access_free') : tierNames[tier]());
            elements.plan.textContent = label;
            elements.sidePlan.textContent = isFree || isTest ? '' : `· ${tr(`tier_${tier}`)}`;
            const expiry = formatDate(license.billing?.currentPeriodEnd || license.expiresAt);
            elements.status.textContent = license.status === 'active' ? tr('access_active') : tr('access_status_available');
            elements.expiry.textContent = expiry ? tr('access_valid_until', { date: expiry }) : '';
            elements.benefits.replaceChildren(...benefitLines(tier, viewer, isTest, isFree).map(text => {
                const item = document.createElement('li'); item.textContent = text; return item;
            }));
            elements.usage.hidden = !(tier === 'bronze' && Number.isFinite(used) && Number.isFinite(limit));
            if (!elements.usage.hidden) elements.usageText.textContent = tr('access_usage_text', { used, limit });
            elements.cooldown.hidden = !cooldownItem;
            if (cooldownItem) elements.cooldownText.textContent = tr('access_cooldown_text', { date: formatDate(cooldownItem.viewer.cooldownUntil) || '—' });
            elements.manage.hidden = false;
            elements.manage.dataset.action = canManageSubscription ? 'subscription' : 'plans';
            elements.manage.textContent = canManageSubscription ? tr('access_manage_subscription') : tr('access_manage');
        }

        async function loadAccess() {
            if (loaded) return;
            elements.loading.hidden = false; elements.error.hidden = true; elements.details.hidden = true;
            showArtworkSkeleton();
            try {
                const [session, catalog] = await Promise.all([window.electronAPI.auth.status(), window.electronAPI.premium.list()]);
                if (!session?.authenticated) throw new Error('missing_session');
                const viewer = catalog?.success ? firstViewer(catalog.items || []) : null;
                const license = session.license || {};
                const tier = String(license.planTier || viewer?.planTier || '').toLowerCase();
                const isTest = license.licenseType === 'test';
                // The plan tier is the source of truth. Some older/staging billing records
                // legitimately report accessType "free" while retaining their plan tier.
                const isFree = !tierNames[tier];
                const used = Number(viewer?.premiumActivationsUsed);
                const limit = Number(viewer?.premiumActivationLimit);
                const cooldownItem = (catalog?.items || []).find(item => ['cooldown', 'reserved'].includes(item?.viewer?.status) && item?.viewer?.cooldownUntil);
                const canManageSubscription = Boolean(license.billing?.canManageSubscription);
                accessState = { tier, isTest, isFree, viewer, license, used, limit, cooldownItem, canManageSubscription };
                renderAccessState(accessState);
                setArtwork(!isFree && !isTest ? tierArtwork[tier] : '');
                loaded = true; elements.details.hidden = false;
            } catch (_) {
                elements.error.hidden = false;
                setArtwork('');
            } finally { elements.loading.hidden = true; }
        }

        elements.manage.addEventListener('click', () => window.electronAPI.auth.openAccess());
        elements.plans.addEventListener('click', () => window.electronAPI.auth.openPlans());
        window.addEventListener('merlin-view-changed', event => { if (event.detail?.view === 'access') loadAccess(); });
        window.addEventListener('merlin-authenticated', () => {
            loaded = false;
            // Warm the access view as soon as the session is established so
            // opening "Meu acesso" never reveals an empty shell first.
            void loadAccess();
        });
        window.addEventListener('merlin-logout', () => {
            loaded = false;
            accessState = null;
            elements.sidePlan.textContent = '';
            elements.sidePlan.dataset.tier = '';
            elements.details.hidden = true;
            elements.error.hidden = true;
            setArtwork('');
        });
        window.addEventListener('merlin-language-changed', () => {
            renderAccessState(accessState);
        });
    });
}());

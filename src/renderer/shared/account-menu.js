(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const trigger = document.getElementById('accountMenuTrigger');
        const menu = document.getElementById('accountMenuPopover');
        if (!trigger || !menu) return;

        let cleanupPosition = null;
        function positionMenu() {
            const rect = trigger.getBoundingClientRect();
            const menuWidth = menu.offsetWidth;
            menu.style.left = `${Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth))}px`;
            menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 12, rect.bottom + 8)}px`;
        }
        function close() {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            cleanupPosition?.(); cleanupPosition = null;
        }
        function open() {
            window.dispatchEvent(new CustomEvent('merlin-popover-open', { detail: { name: 'account' } }));
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            positionMenu();
            window.addEventListener('resize', positionMenu);
            cleanupPosition = () => window.removeEventListener('resize', positionMenu);
        }
        trigger.addEventListener('click', () => menu.hidden ? open() : close());
        document.getElementById('accountTutorialBtn')?.addEventListener('click', () => window.merlinTutorial?.open?.());
        document.getElementById('accountFaqBtn')?.addEventListener('click', () => window.merlinFaq?.open?.());
        document.addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) close(); }, true);
        document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
        window.addEventListener('merlin-popover-open', event => { if (event.detail?.name !== 'account') close(); });
        menu.addEventListener('click', event => { if (event.target.closest('button')) close(); });
    });
}());

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const trigger = document.getElementById('accountMenuTrigger');
        const menu = document.getElementById('accountMenuPopover');
        if (!trigger || !menu || !window.FloatingUIDOM) return;

        let cleanupPosition = null;
        function close() {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            cleanupPosition?.(); cleanupPosition = null;
        }
        function open() {
            window.dispatchEvent(new CustomEvent('merlin-popover-open', { detail: { name: 'account' } }));
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            const { computePosition, offset, flip, shift, autoUpdate } = window.FloatingUIDOM;
            const update = () => computePosition(trigger, menu, {
                placement: 'bottom-end', strategy: 'fixed', middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })]
            }).then(({ x, y }) => Object.assign(menu.style, { left: `${x}px`, top: `${y}px` }));
            update(); cleanupPosition = autoUpdate(trigger, menu, update);
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

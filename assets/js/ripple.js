/**
 * BEEPREPARE — Ripple Effect Engine
 * Injects ripple-wave on click for all interactive elements.
 * Automatically attaches on DOM-ready.
 */
(function () {
  'use strict';

  const RIPPLE_SELECTORS = [
    'button',
    '.btn',
    '.btn-primary',
    '.btn-adv',
    '.btn-outline',
    '.btn-danger',
    '.btn-logout',
    '.logout-btn',
    '.login-btn',
    '.update-btn',
    '.rename-confirm',
    '.rename-cancel',
    '.refresh-btn',
    '.feature-card',
    '.action-card',
    '.dash-card',
    '.adv-card',
    '.role-card',
    '.selection-card',
    '.pill',
    '.page-btn',
    '.back-btn',
    '[role="button"]',
    '[onclick]'
  ].join(',');

  function createRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';

    // Determine ripple tint
    const isDanger = el.classList.contains('logout-btn') ||
                     el.classList.contains('btn-logout') ||
                     el.classList.contains('btn-danger') ||
                     (el.getAttribute('onclick') || '').match(/delete|purge|block/i);
    const isGold   = el.classList.contains('btn-primary') ||
                     el.classList.contains('btn-adv') ||
                     el.classList.contains('login-btn') ||
                     el.classList.contains('update-btn') ||
                     el.classList.contains('rename-confirm');

    if (isDanger) wave.classList.add('danger');
    else if (isGold) wave.classList.add('gold');

    // Position relative to element
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    wave.style.left = `${x}px`;
    wave.style.top  = `${y}px`;

    // Ensure host is position:relative + overflow:hidden
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';

    el.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  }

  function attachRipples() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest(RIPPLE_SELECTORS);
      if (el && !el.disabled && !el.classList.contains('no-ripple')) {
        createRipple(e, el);
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachRipples);
  } else {
    attachRipples();
  }
})();

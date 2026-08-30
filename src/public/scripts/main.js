const header = document.querySelector('.site-header');
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

if (toggle && nav) {
  const focusableSelector = 'a[href], button:not([disabled])';
  const mobileNavQuery = window.matchMedia('(max-width: 980px)');
  let lastFocused = null;
  let ignoreDocumentCloseUntil = 0;
  let scrollLockY = 0;
  const navHome = {
    parent: nav.parentElement,
    next: nav.nextSibling
  };

  const isMobileNav = () => mobileNavQuery.matches;

  const positionMobileNav = () => {
    if (!(header instanceof HTMLElement) || !nav.classList.contains('is-open') || !isMobileNav()) {
      return;
    }

    const top = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
    nav.style.top = `${top}px`;
    nav.style.maxHeight = `calc(100dvh - ${top}px - env(safe-area-inset-bottom, 0px))`;
  };

  const syncHeaderMetrics = () => {
    if (!(header instanceof HTMLElement)) {
      return;
    }

    const headerRect = header.getBoundingClientRect();
    document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
    document.documentElement.style.setProperty('--site-nav-top', `${headerRect.bottom}px`);
    positionMobileNav();
  };

  const lockScroll = () => {
    if (!isMobileNav()) {
      return;
    }

    scrollLockY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  };

  const unlockScroll = () => {
    const previousScroll = scrollLockY;
    scrollLockY = 0;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, previousScroll);
  };

  const mountMobileNav = () => {
    if (!isMobileNav()) {
      return;
    }

    if (navHome.parent && navHome.parent.contains(nav)) {
      document.body.appendChild(nav);
    }

    nav.classList.add('is-portal');
  };

  const restoreMobileNav = () => {
    nav.classList.remove('is-portal');
    nav.style.top = '';
    nav.style.maxHeight = '';

    if (!navHome.parent || navHome.parent.contains(nav)) {
      return;
    }

    navHome.parent.insertBefore(nav, navHome.next);
  };

  const getFocusableItems = () =>
    Array.from(nav.querySelectorAll(focusableSelector)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      return nav.classList.contains('is-open');
    });

  const setNavOpen = (open) => {
    if (open) {
      if (isMobileNav()) {
        mountMobileNav();
        lockScroll();
      }

      nav.classList.add('is-open');
      header?.classList.add('is-nav-open');
      document.body.classList.add('is-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Закрыть меню');

      const syncOpenPosition = () => {
        syncHeaderMetrics();
        positionMobileNav();
      };

      syncOpenPosition();
      requestAnimationFrame(syncOpenPosition);
      requestAnimationFrame(() => requestAnimationFrame(syncOpenPosition));

      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ignoreDocumentCloseUntil = Date.now() + 400;

      const firstLink = getFocusableItems()[0];
      if (firstLink instanceof HTMLElement) {
        firstLink.focus({ preventScroll: true });
      }
      return;
    }

    nav.classList.remove('is-open');
    header?.classList.remove('is-nav-open');
    document.body.classList.remove('is-nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
    restoreMobileNav();
    unlockScroll();

    if (lastFocused instanceof HTMLElement) {
      lastFocused.focus({ preventScroll: true });
    }
  };

  syncHeaderMetrics();
  window.addEventListener('resize', syncHeaderMetrics);
  window.addEventListener('scroll', syncHeaderMetrics, { passive: true });

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setNavOpen(!nav.classList.contains('is-open'));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setNavOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setNavOpen(false);
      return;
    }

    if (event.key !== 'Tab' || !nav.classList.contains('is-open')) {
      return;
    }

    const focusableItems = getFocusableItems();
    if (!focusableItems.length) {
      return;
    }

    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstItem) {
      event.preventDefault();
      if (lastItem instanceof HTMLElement) {
        lastItem.focus({ preventScroll: true });
      }
      return;
    }

    if (!event.shiftKey && activeElement === lastItem) {
      event.preventDefault();
      if (firstItem instanceof HTMLElement) {
        firstItem.focus({ preventScroll: true });
      }
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open') || Date.now() < ignoreDocumentCloseUntil) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (toggle.contains(target) || nav.contains(target)) {
      return;
    }

    setNavOpen(false);
  });

  window.addEventListener('resize', () => {
    syncHeaderMetrics();
    if (!isMobileNav()) {
      restoreMobileNav();
    }
    if (window.innerWidth > 980 && nav.classList.contains('is-open')) {
      setNavOpen(false);
    }
  });

  mobileNavQuery.addEventListener('change', () => {
    if (!isMobileNav()) {
      restoreMobileNav();
      if (nav.classList.contains('is-open')) {
        setNavOpen(false);
      }
    }
  });
}

const materialEditors = document.querySelectorAll('[data-material-editor]');

materialEditors.forEach((editor) => {
  const list = editor.querySelector('[data-material-list]');
  const addButton = editor.querySelector('[data-add-material]');
  const template = editor.querySelector('template[data-material-template]');
  const status = editor.querySelector('[data-primary-status]');
  const maxPrimary = Number(editor.getAttribute('data-max-primary') || '3');

  if (!list || !addButton || !template) {
    return;
  }

  const renderStatus = (message) => {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.toggle('is-error', message.includes('не более'));
  };

  const updateStatus = () => {
    const checkedCount = editor.querySelectorAll('[data-material-primary]:checked').length;
    renderStatus(`Основные материалы: ${checkedCount}/${maxPrimary}`);
  };

  addButton.addEventListener('click', () => {
    const nextIndex = list.children.length;
    const html = template.innerHTML
      .replace(/__INDEX__/g, String(nextIndex))
      .replace(/__NUMBER__/g, String(nextIndex + 1));

    list.insertAdjacentHTML('beforeend', html);
    updateStatus();
  });

  editor.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-material-primary]')) {
      return;
    }

    const checkedCount = editor.querySelectorAll('[data-material-primary]:checked').length;
    if (checkedCount > maxPrimary) {
      target.checked = false;
      renderStatus(`Можно выбрать не более ${maxPrimary} основных материалов.`);
      return;
    }

    updateStatus();
  });

  updateStatus();
});

const renumberAudienceTopics = (list) => {
  list.querySelectorAll('[data-audience-topic-row]').forEach((row, index) => {
    const label = row.querySelector('[data-audience-topic-label]');
    const input = row.querySelector('input[type="text"]');
    if (label) {
      label.textContent = `Пункт ${index + 1}`;
    }
    if (input instanceof HTMLInputElement) {
      input.name = `audienceTopics[${index}]`;
    }
  });
};

document.querySelectorAll('[data-audience-editor]').forEach((editor) => {
  const list = editor.querySelector('[data-audience-topic-list]');
  const addButton = editor.querySelector('[data-add-audience-topic]');
  const template = editor.querySelector('template[data-audience-topic-template]');

  if (!list || !addButton || !template) {
    return;
  }

  addButton.addEventListener('click', () => {
    const nextIndex = list.children.length;
    const html = template.innerHTML
      .replace(/__INDEX__/g, String(nextIndex))
      .replace(/__NUMBER__/g, String(nextIndex + 1));

    list.insertAdjacentHTML('beforeend', html);
    const input = list.lastElementChild?.querySelector('input[type="text"]');
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  });

  editor.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const removeButton = target.closest('[data-remove-audience-topic]');
    if (!removeButton) {
      return;
    }

    const row = removeButton.closest('[data-audience-topic-row]');
    if (!row) {
      return;
    }

    if (list.children.length <= 1) {
      const input = row.querySelector('input[type="text"]');
      if (input instanceof HTMLInputElement) {
        input.value = '';
        input.focus();
      }
      return;
    }

    row.remove();
    renumberAudienceTopics(list);
  });
});

document.querySelectorAll('[data-rich-editor]').forEach((editor) => {
  const surface = editor.querySelector('[data-rich-surface]');
  const input = editor.querySelector('[data-rich-input]');
  const toolbar = editor.querySelector('[data-rich-toolbar]');
  const form = editor.closest('form');

  if (!(surface instanceof HTMLElement) || !(input instanceof HTMLTextAreaElement) || !toolbar) {
    return;
  }

  const syncInput = () => {
    const html = surface.innerHTML.trim();
    input.value = html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>' ? '' : surface.innerHTML;
  };

  toolbar.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  toolbar.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('[data-rich-command]');
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const command = button.getAttribute('data-rich-command');
    if (!command) {
      return;
    }

    surface.focus();
    document.execCommand(command, false);
    syncInput();
  });

  surface.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    document.execCommand('insertParagraph');
    syncInput();
  });

  surface.addEventListener('input', syncInput);
  surface.addEventListener('blur', syncInput);

  if (form) {
    form.addEventListener('submit', syncInput);
  }

  syncInput();
});

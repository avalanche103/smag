const header = document.querySelector('.site-header');
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

if (toggle && nav) {
  const focusableSelector = 'a[href], button:not([disabled])';
  let lastFocused = null;
  let lockedScrollY = 0;

  const syncHeaderMetrics = () => {
    if (!(header instanceof HTMLElement)) {
      return;
    }

    document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
    document.documentElement.style.setProperty('--site-nav-top', `${header.getBoundingClientRect().bottom}px`);
  };

  const getFocusableItems = () =>
    Array.from(nav.querySelectorAll(focusableSelector)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      return element.offsetParent !== null || element === document.activeElement;
    });

  const setNavOpen = (open) => {
    nav.classList.toggle('is-open', open);
    header?.classList.toggle('is-nav-open', open);
    document.body.classList.toggle('is-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');

    if (open) {
      lockedScrollY = window.scrollY;
      syncHeaderMetrics();
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';

      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const firstLink = getFocusableItems()[0];
      if (firstLink instanceof HTMLElement) {
        firstLink.focus();
      }
      return;
    }

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedScrollY);

    if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  };

  syncHeaderMetrics();
  window.addEventListener('resize', syncHeaderMetrics);

  toggle.addEventListener('click', () => {
    setNavOpen(!nav.classList.contains('is-open'));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setNavOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
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
        lastItem.focus();
      }
      return;
    }

    if (!event.shiftKey && activeElement === lastItem) {
      event.preventDefault();
      if (firstItem instanceof HTMLElement) {
        firstItem.focus();
      }
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open')) {
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
    if (window.innerWidth > 980) {
      setNavOpen(false);
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

const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    nav.classList.toggle('is-open');
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
    input.value = html === '<br>' || html === '<div><br></div>' ? '' : surface.innerHTML;
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

  surface.addEventListener('input', syncInput);
  surface.addEventListener('blur', syncInput);

  if (form) {
    form.addEventListener('submit', syncInput);
  }

  syncInput();
});

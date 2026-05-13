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

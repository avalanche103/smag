document.addEventListener("DOMContentLoaded", function () {
  const page = document.querySelector(".published-lists-page");
  if (!page) {
    return;
  }

  const form = page.querySelector(".published-materials-filters");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const numberInput = form.querySelector(".filter-number");
  const sectionSelect = form.querySelector(".filter-section");
  const titleInput = form.querySelector(".filter-title");
  const authorInput = form.querySelector(".filter-author");
  let debounceTimer = 0;

  function submitFilters() {
    form.requestSubmit();
  }

  function debouncedSubmit() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(submitFilters, 450);
  }

  [numberInput, titleInput, authorInput].forEach((input) => {
    input?.addEventListener("input", debouncedSubmit);
  });
  sectionSelect?.addEventListener("change", submitFilters);
});

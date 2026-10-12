document.addEventListener("DOMContentLoaded", function () {
  const page = document.querySelector(".published-lists-page");
  if (!page) {
    return;
  }

  const form = page.querySelector(".published-materials-filters");
  const tableWrap = page.querySelector(".published-materials-wrap");
  if (!(form instanceof HTMLFormElement) || !(tableWrap instanceof HTMLElement)) {
    return;
  }

  const numberInput = form.querySelector(".filter-number");
  const sectionSelect = form.querySelector(".filter-section");
  const titleInput = form.querySelector(".filter-title");
  const authorInput = form.querySelector(".filter-author");
  let debounceTimer = 0;
  let requestId = 0;

  function buildFilterUrl() {
    const params = new URLSearchParams(new FormData(form));
    for (const [key, value] of [...params.entries()]) {
      if (!String(value).trim()) {
        params.delete(key);
      }
    }
    const query = params.toString();
    return query ? `/published-lists?${query}` : "/published-lists";
  }

  function restoreActiveField(activeName, selectionStart, selectionEnd) {
    if (!activeName) {
      return;
    }
    const field = form.elements.namedItem(activeName);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
      return;
    }
    field.focus({ preventScroll: true });
    if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
      try {
        field.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // Some input types do not support selection ranges.
      }
    }
  }

  async function applyFilters(options = {}) {
    const { syncHistory = true } = options;
    const url = buildFilterUrl();
    const currentRequest = ++requestId;
    const active = document.activeElement;
    const activeName =
      active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement
        ? active.name
        : "";
    const selectionStart = active instanceof HTMLInputElement ? active.selectionStart : null;
    const selectionEnd = active instanceof HTMLInputElement ? active.selectionEnd : null;

    tableWrap.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(url, {
        headers: { Accept: "text/html", "X-Requested-With": "fetch" }
      });
      if (!response.ok) {
        throw new Error(`Filter request failed: ${response.status}`);
      }

      const html = await response.text();
      if (currentRequest !== requestId) {
        return;
      }

      const doc = new DOMParser().parseFromString(html, "text/html");
      const nextWrap = doc.querySelector(".published-materials-wrap");
      if (!nextWrap) {
        throw new Error("Filter response is missing table markup");
      }

      tableWrap.innerHTML = nextWrap.innerHTML;
      if (syncHistory && window.location.pathname + window.location.search !== url) {
        window.history.replaceState({}, "", url);
      }
    } catch (error) {
      console.error(error);
      // Fallback: full navigation if fetch/update fails.
      window.location.assign(url);
      return;
    } finally {
      tableWrap.removeAttribute("aria-busy");
      restoreActiveField(activeName, selectionStart, selectionEnd);
    }
  }

  function debouncedApply() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      applyFilters();
    }, 450);
  }

  [numberInput, titleInput, authorInput].forEach((input) => {
    input?.addEventListener("input", debouncedApply);
  });
  sectionSelect?.addEventListener("change", () => {
    window.clearTimeout(debounceTimer);
    applyFilters();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(debounceTimer);
    applyFilters();
  });
});

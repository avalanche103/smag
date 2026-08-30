document.addEventListener("DOMContentLoaded", function () {
  const table = document.querySelector(".published-materials-table");
  if (!table) {
    return;
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return;
  }

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const numberInput = table.querySelector(".filter-number");
  const sectionSelect = table.querySelector(".filter-section");
  const titleInput = table.querySelector(".filter-title");
  const authorInput = table.querySelector(".filter-author");

  function filterTable() {
    const number = numberInput?.value.toLowerCase() ?? "";
    const section = sectionSelect?.value.toLowerCase() ?? "";
    const title = titleInput?.value.toLowerCase() ?? "";
    const author = authorInput?.value.toLowerCase() ?? "";

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      const sectionText = cells[1]?.textContent.trim().toLowerCase() ?? "";
      const match =
        cells[0]?.textContent.toLowerCase().includes(number) &&
        (!section || sectionText === section) &&
        cells[2]?.textContent.toLowerCase().includes(title) &&
        cells[3]?.textContent.toLowerCase().includes(author);
      row.style.display = match ? "" : "none";
    });
  }

  [numberInput, titleInput, authorInput].forEach((input) => {
    input?.addEventListener("input", filterTable);
  });
  sectionSelect?.addEventListener("change", filterTable);
});

document.addEventListener('DOMContentLoaded', function () {
  const table = document.querySelector('.table-wrap table');
  if (!table) {
    return;
  }

  const tbody = table.querySelector('tbody');
  if (!tbody) {
    return;
  }

  const rows = Array.from(tbody.querySelectorAll('tr'));

  const filterRow = document.createElement('tr');
  filterRow.innerHTML = `
    <td class="col-issue"><input type="text" placeholder="№" class="filter-number"></td>
    <td class="col-section"><input type="text" placeholder="Рубрика" class="filter-section"></td>
    <td class="col-title"><input type="text" placeholder="Название" class="filter-title"></td>
    <td class="col-author"><input type="text" placeholder="Автор" class="filter-author"></td>
  `;
  table.querySelector('thead')?.appendChild(filterRow);

  function filterTable() {
    const number = table.querySelector('.filter-number')?.value.toLowerCase() ?? '';
    const section = table.querySelector('.filter-section')?.value.toLowerCase() ?? '';
    const title = table.querySelector('.filter-title')?.value.toLowerCase() ?? '';
    const author = table.querySelector('.filter-author')?.value.toLowerCase() ?? '';

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const match =
        cells[0]?.textContent.toLowerCase().includes(number) &&
        cells[1]?.textContent.toLowerCase().includes(section) &&
        cells[2]?.textContent.toLowerCase().includes(title) &&
        cells[3]?.textContent.toLowerCase().includes(author);
      row.style.display = match ? '' : 'none';
    });
  }

  table.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', filterTable);
  });
});

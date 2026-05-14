document.addEventListener('DOMContentLoaded', function () {
  const table = document.querySelector('.table-wrap table');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  // Фильтры
  const filterRow = document.createElement('tr');
  filterRow.innerHTML = `
    <td><input type="text" placeholder="№ журнала" class="filter-number" style="width: 100%"></td>
    <td><input type="text" placeholder="Рубрика" class="filter-section" style="width: 100%"></td>
    <td><input type="text" placeholder="Название" class="filter-title" style="width: 100%"></td>
    <td><input type="text" placeholder="Автор" class="filter-author" style="width: 100%"></td>
  `;
  table.querySelector('thead').appendChild(filterRow);

  function filterTable() {
    const number = table.querySelector('.filter-number').value.toLowerCase();
    const section = table.querySelector('.filter-section').value.toLowerCase();
    const title = table.querySelector('.filter-title').value.toLowerCase();
    const author = table.querySelector('.filter-author').value.toLowerCase();

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const match =
        cells[0].textContent.toLowerCase().includes(number) &&
        cells[1].textContent.toLowerCase().includes(section) &&
        cells[2].textContent.toLowerCase().includes(title) &&
        cells[3].textContent.toLowerCase().includes(author);
      row.style.display = match ? '' : 'none';
    });
  }

  table.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', filterTable);
  });
});

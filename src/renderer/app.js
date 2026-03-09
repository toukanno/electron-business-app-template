const ledgerForm = document.getElementById('ledger-form');
const filterForm = document.getElementById('filter-form');
const rowsEl = document.getElementById('ledger-rows');
const summaryEl = document.getElementById('summary');

let currentFilters = {
  yearMonth: '',
  department: ''
};

function toYen(value) {
  return `¥${Number(value).toLocaleString('ja-JP')}`;
}

async function refresh() {
  const entries = await window.ledgerApi.listEntries(currentFilters);
  rowsEl.innerHTML = '';

  for (const entry of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.account_item}</td>
      <td>${entry.description}</td>
      <td>${toYen(entry.amount)}</td>
      <td>${entry.category}</td>
      <td>${entry.department}</td>
      <td><button class="delete-btn" data-id="${entry.id}">削除</button></td>
    `;
    rowsEl.appendChild(tr);
  }

  summaryEl.innerHTML = '';
  if (currentFilters.yearMonth) {
    const summary = await window.ledgerApi.getSummary(currentFilters.yearMonth);
    for (const item of summary) {
      const li = document.createElement('li');
      li.textContent = `${item.category}: ${toYen(item.total_amount)}（${item.count}件）`;
      summaryEl.appendChild(li);
    }
  }
}

ledgerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(ledgerForm);

  await window.ledgerApi.createEntry({
    date: formData.get('date'),
    accountItem: formData.get('accountItem'),
    description: formData.get('description'),
    amount: formData.get('amount'),
    category: formData.get('category'),
    department: formData.get('department')
  });

  ledgerForm.reset();
  await refresh();
});

filterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(filterForm);
  currentFilters = {
    yearMonth: formData.get('yearMonth') || '',
    department: formData.get('department') || ''
  };

  await refresh();
});

rowsEl.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-btn');
  if (!button) {
    return;
  }

  await window.ledgerApi.deleteEntry(button.dataset.id);
  await refresh();
});

refresh();

const fs = require('node:fs/promises');
const path = require('node:path');

class LedgerDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      lastId: 0,
      entries: []
    };
  }

  async initialize() {
    const fileExists = await fs
      .access(this.filePath)
      .then(() => true)
      .catch(() => false);

    if (fileExists) {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
    }

    await this.persist();
  }

  async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getEntries({ yearMonth = '', department = '' } = {}) {
    return this.data.entries
      .filter((entry) => (yearMonth ? entry.date.startsWith(yearMonth) : true))
      .filter((entry) => (department ? entry.department === department : true))
      .sort((a, b) => {
        if (a.date === b.date) return b.id - a.id;
        return a.date < b.date ? 1 : -1;
      });
  }

  async addEntry(entry) {
    this.data.lastId += 1;
    const next = {
      id: this.data.lastId,
      date: entry.date,
      account_item: entry.accountItem,
      description: entry.description,
      amount: Number(entry.amount),
      category: entry.category,
      department: entry.department,
      created_at: new Date().toISOString()
    };

    this.data.entries.push(next);
    await this.persist();
    return next;
  }

  async removeEntry(id) {
    this.data.entries = this.data.entries.filter((entry) => entry.id !== Number(id));
    await this.persist();
  }

  getMonthlySummary(yearMonth) {
    const buckets = new Map();

    for (const entry of this.data.entries) {
      if (!entry.date.startsWith(yearMonth)) {
        continue;
      }

      const row = buckets.get(entry.category) || { category: entry.category, total_amount: 0, count: 0 };
      row.total_amount += Number(entry.amount);
      row.count += 1;
      buckets.set(entry.category, row);
    }

    return [...buckets.values()].sort((a, b) => b.total_amount - a.total_amount);
  }
}

module.exports = { LedgerDatabase };

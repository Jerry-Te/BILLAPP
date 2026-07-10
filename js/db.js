// ============================================================
// db.js — IndexedDB 数据层
// 完全离线，所有数据存储在本地
// ============================================================

const DB_NAME = 'BillAppDB';
const DB_VERSION = 1;

const STORES = {
  transactions: '++id, type, category, amount, date, createdAt',
  categories: '++id, type, name',
  budgets: '++id, category, month',
  settings: '&key'
};

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type_date', ['type', 'date'], { unique: false });
      }

      if (!db.objectStoreNames.contains('categories')) {
        const store = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('budgets')) {
        const store = db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
        store.createIndex('month', 'month', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // 写入默认分类和设置
      _seedDefaults(event.target.transaction);
    };

    request.onsuccess = event => {
      _db = event.target.result;
      resolve(_db);
    };

    request.onerror = event => reject(event.target.error);
  });
}

function _seedDefaults(transaction) {
  const categoryStore = transaction.objectStore('categories');
  const settingStore = transaction.objectStore('settings');

  const defaultExpenseCategories = [
    { name: '餐饮', type: 'expense', icon: '🍽️', color: '#FF6B6B' },
    { name: '交通', type: 'expense', icon: '🚗', color: '#4ECDC4' },
    { name: '购物', type: 'expense', icon: '🛒', color: '#FFB347' },
    { name: '住房', type: 'expense', icon: '🏠', color: '#A18CD1' },
    { name: '娱乐', type: 'expense', icon: '🎮', color: '#F7A8B8' },
    { name: '医疗', type: 'expense', icon: '💊', color: '#6C5CE7' },
    { name: '教育', type: 'expense', icon: '📚', color: '#74B9FF' },
    { name: '通讯', type: 'expense', icon: '📱', color: '#55EFC4' },
    { name: '人情', type: 'expense', icon: '🧧', color: '#FD79A8' },
    { name: '其他支出', type: 'expense', icon: '📦', color: '#636E72' }
  ];

  const defaultIncomeCategories = [
    { name: '工资', type: 'income', icon: '💼', color: '#00B894' },
    { name: '兼职', type: 'income', icon: '💻', color: '#00CEC9' },
    { name: '投资', type: 'income', icon: '📈', color: '#0984E3' },
    { name: '红包', type: 'income', icon: '🧧', color: '#E17055' },
    { name: '其他收入', type: 'income', icon: '💰', color: '#6C5CE7' }
  ];

  defaultExpenseCategories.forEach(cat => categoryStore.add(cat));
  defaultIncomeCategories.forEach(cat => categoryStore.add(cat));

  settingStore.add({ key: 'currency', value: '¥' });
  settingStore.add({ key: 'firstDayOfMonth', value: 1 });
}

// ==================== 通用工具函数 ====================

function _getStore(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function _wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== 交易记录 ====================

export async function addTransaction(tx) {
  const db = await openDB();
  const store = _getStore('transactions', 'readwrite');
  tx.createdAt = Date.now();
  return _wrapRequest(store.add(tx));
}

export async function updateTransaction(id, updates) {
  const db = await openDB();
  const store = _getStore('transactions', 'readwrite');
  const existing = await _wrapRequest(store.get(id));
  if (!existing) throw new Error('记录不存在');
  const updated = { ...existing, ...updates };
  return _wrapRequest(store.put(updated));
}

export async function deleteTransaction(id) {
  const db = await openDB();
  const store = _getStore('transactions', 'readwrite');
  return _wrapRequest(store.delete(id));
}

export async function getAllTransactions() {
  const db = await openDB();
  const store = _getStore('transactions');
  return _wrapRequest(store.getAll());
}

export async function getTransactionsByMonth(year, month) {
  const db = await openDB();
  const store = _getStore('transactions');
  const index = store.index('date');
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const range = IDBKeyRange.bound(startDate, endDate, false, true);
  return _wrapRequest(index.getAll(range));
}

export async function getRecentTransactions(limit = 20) {
  const db = await openDB();
  const store = _getStore('transactions');
  const index = store.index('createdAt');
  const results = [];
  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, 'prev');
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== 分类 ====================

export async function getCategories(type = null) {
  const db = await openDB();
  const store = _getStore('categories');
  const all = await _wrapRequest(store.getAll());
  return type ? all.filter(c => c.type === type) : all;
}

export async function addCategory(cat) {
  const db = await openDB();
  const store = _getStore('categories', 'readwrite');
  return _wrapRequest(store.add(cat));
}

export async function updateCategory(id, updates) {
  const db = await openDB();
  const store = _getStore('categories', 'readwrite');
  const existing = await _wrapRequest(store.get(id));
  if (!existing) throw new Error('分类不存在');
  return _wrapRequest(store.put({ ...existing, ...updates }));
}

export async function deleteCategory(id) {
  const db = await openDB();
  const store = _getStore('categories', 'readwrite');
  return _wrapRequest(store.delete(id));
}

// ==================== 预算 ====================

export async function setBudget(budget) {
  const db = await openDB();
  const store = _getStore('budgets', 'readwrite');
  return _wrapRequest(store.put(budget));
}

export async function getBudgetForMonth(month) {
  const db = await openDB();
  const store = _getStore('budgets');
  const index = store.index('month');
  const range = IDBKeyRange.only(month);
  return _wrapRequest(index.getAll(range));
}

export async function getAllBudgets() {
  const db = await openDB();
  const store = _getStore('budgets');
  return _wrapRequest(store.getAll());
}

// ==================== 设置 ====================

export async function getSetting(key) {
  const db = await openDB();
  const store = _getStore('settings');
  const result = await _wrapRequest(store.get(key));
  return result ? result.value : null;
}

export async function setSetting(key, value) {
  const db = await openDB();
  const store = _getStore('settings', 'readwrite');
  return _wrapRequest(store.put({ key, value }));
}

export async function getAllSettings() {
  const db = await openDB();
  const store = _getStore('settings');
  const all = await _wrapRequest(store.getAll());
  const map = {};
  all.forEach(s => { map[s.key] = s.value; });
  return map;
}

// ==================== 统计查询 ====================

export async function getMonthlySummary(year, month) {
  const transactions = await getTransactionsByMonth(year, month);
  let income = 0;
  let expense = 0;
  const categories = await getCategories();
  const catMap = {};
  categories.forEach(c => { catMap[c.name] = c; });

  const expenseByCategory = {};
  const incomeByCategory = {};

  transactions.forEach(tx => {
    if (tx.type === 'income') {
      income += tx.amount;
      incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount;
    } else {
      expense += tx.amount;
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
    }
  });

  return {
    income,
    expense,
    balance: income - expense,
    total: income + expense,
    transactionCount: transactions.length,
    expenseByCategory: Object.entries(expenseByCategory).map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: expense > 0 ? (amount / expense) * 100 : 0,
      color: catMap[cat]?.color || '#636E72'
    })).sort((a, b) => b.amount - a.amount),
    incomeByCategory: Object.entries(incomeByCategory).map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: income > 0 ? (amount / income) * 100 : 0,
      color: catMap[cat]?.color || '#00B894'
    })).sort((a, b) => b.amount - a.amount)
  };
}

export async function getBalance() {
  const db = await openDB();
  const store = _getStore('transactions');
  const all = await _wrapRequest(store.getAll());
  let balance = 0;
  all.forEach(tx => {
    balance += tx.type === 'income' ? tx.amount : -tx.amount;
  });
  return balance;
}

// ==================== 导出数据 ====================

export async function exportAllData() {
  const db = await openDB();
  const allData = {};
  for (const storeName of Object.keys(STORES)) {
    const store = _getStore(storeName);
    allData[storeName] = await _wrapRequest(store.getAll());
  }
  return allData;
}

export async function importAllData(data) {
  const db = await openDB();
  const storeNames = Object.keys(STORES);

  for (const storeName of storeNames) {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  for (const storeName of storeNames) {
    const records = Array.isArray(data?.[storeName]) ? data[storeName] : [];
    if (records.length === 0) continue;

    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const record of records) {
      await new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  return true;
}

export async function clearAllData() {
  const db = await openDB();
  for (const storeName of Object.keys(STORES)) {
    const store = _getStore(storeName, 'readwrite');
    await _wrapRequest(store.clear());
  }
  // 重新写入默认数据
  _seedDefaults(_db.transaction(['categories', 'settings'], 'readwrite'));
}

// 初始化数据库
openDB().then(() => console.log('📦 数据库已就绪'));

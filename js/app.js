// ============================================================
// app.js — 小熊记账 主应用逻辑
// 包含路由、UI 工具、所有视图渲染
// ============================================================

import { addTransaction, updateTransaction, deleteTransaction, getAllTransactions, getTransactionsByMonth, getRecentTransactions, getCategories, addCategory, deleteCategory, getBalance, getMonthlySummary, getAllSettings, getSetting, setSetting, getAllBudgets, setBudget, getBudgetForMonth, exportAllData, importAllData, clearAllData } from './db.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const APP_VERSION = 'v1.2.3';
const APP_VERSION_KEY = 'billapp-version';
const FALLBACK_RENDER_TIMEOUT = 5000;

function formatAmount(num) {
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[d.getDay()];
  return month + '月' + day + '日 周' + wd;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function showToast(message, duration) {
  if (!duration) duration = 2000;
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.classList.remove('show'); }, duration);
}

function showModal(id) {
  var overlay = document.getElementById('modal-overlay');
  var sheet = document.getElementById(id);
  if (overlay) overlay.classList.add('show');
  if (sheet) {
    sheet.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function hideModal(id) {
  var overlay = document.getElementById('modal-overlay');
  var sheet = document.getElementById(id);
  if (overlay) overlay.classList.remove('show');
  if (sheet) sheet.classList.remove('show');
  document.body.style.overflow = '';
}

function hideAllModals() {
  document.querySelectorAll('.modal-sheet').forEach(function(el) { el.classList.remove('show'); });
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

var currentView = 'dashboard';

function navigateTo(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');
  document.querySelectorAll('.tab-item').forEach(function(t) { t.classList.remove('active'); });
  var tab = document.querySelector('.tab-item[data-view="' + viewName + '"]');
  if (tab) tab.classList.add('active');
  renderView(viewName);
}

var appState = {
  currentMonth: new Date(),
  currentTxFilter: 'all',
  categories: { income: [], expense: [] },
  currency: '¥',
  selectedCategory: null,
  editingTransaction: null,
  addFormType: 'expense',
  addFormCategory: null,
  editingTxId: null
};

function renderView(viewName) {
  switch (viewName) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'analytics': renderAnalytics(); break;
    case 'settings': renderSettings(); break;
  }
}

async function renderDashboard() {
  var year = appState.currentMonth.getFullYear();
  var month = appState.currentMonth.getMonth() + 1;
  var labelEl = document.querySelector('#view-dashboard .month-label');
  if (labelEl) labelEl.textContent = year + '\u5e74' + month + '\u6708';
  var summary = await getMonthlySummary(year, month);
  var cats = await getCategories();
  appState.categories.income = cats.filter(function(c) { return c.type === 'income'; });
  appState.categories.expense = cats.filter(function(c) { return c.type === 'expense'; });
  var currency = await getSetting('currency') || '\u00a5';
  appState.currency = currency;
  var balEl = document.getElementById('balance-amount');
  if (balEl) balEl.textContent = currency + ' ' + formatAmount(summary.balance);
  var incEl = document.getElementById('income-amount');
  if (incEl) incEl.textContent = currency + ' ' + formatAmount(summary.income);
  var expEl = document.getElementById('expense-amount');
  if (expEl) expEl.textContent = currency + ' ' + formatAmount(summary.expense);
  var breakdownEl = document.getElementById('expense-breakdown');
  if (!breakdownEl) return;
  if (summary.expenseByCategory.length === 0) {
    breakdownEl.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83d\udcca</div><div class="empty-text">\u672c\u6708\u6682\u65e0\u652f\u51fa</div></div>';
    return;
  }
  var html = '';
  summary.expenseByCategory.forEach(function(cat) {
    var found = appState.categories.expense.find(function(c) { return c.name === cat.category; });
    var icon = found ? found.icon : '\ud83d\udce6';
    html += '<div class="category-item">';
    html += '  <div class="cat-icon" style="background:' + cat.color + '22"><span>' + icon + '</span></div>';
    html += '  <div class="cat-info">';
    html += '    <div class="cat-name">' + cat.category + '</div>';
    html += '    <div class="cat-bar"><div class="cat-bar-fill" style="width:' + Math.min(cat.percentage, 100) + '%;background:' + cat.color + '"></div></div>';
    html += '  </div>';
    html += '  <div class="cat-amount">' + currency + ' ' + formatAmount(cat.amount) + '</div>';
    html += '</div>';
  });
  breakdownEl.innerHTML = html;
  var recent = await getRecentTransactions(5);
  var recentEl = document.getElementById('recent-transactions');
  if (!recentEl) return;
  if (recent.length === 0) {
    recentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83d\udcdd</div><div class="empty-text">\u8fd8\u6ca1\u6709\u8bb0\u8d26\u8bb0\u5f55\uff0c\u70b9\u51fb + \u5f00\u59cb\u8bb0\u8d26</div></div>';
    return;
  }
  var rhtml = '';
  recent.forEach(function(tx) {
    var c = (tx.type === 'income' ? appState.categories.income : appState.categories.expense).find(function(c) { return c.name === tx.category; });
    rhtml += '<div class="recent-item">';
    rhtml += '  <div class="tx-icon" style="background:' + (c ? c.color : '#636E72') + '22">' + (c ? c.icon : '\ud83d\udce6') + '</div>';
    rhtml += '  <div class="tx-info">';
    rhtml += '    <div class="tx-category">' + (tx.category || '\u672a\u5206\u7c7b') + '</div>';
    rhtml += '    <div class="tx-note">' + (tx.note || formatDate(tx.date)) + '</div>';
    rhtml += '  </div>';
    rhtml += '  <div class="tx-amount ' + tx.type + '">' + (tx.type === 'income' ? '+' : '-') + currency + ' ' + formatAmount(tx.amount) + '</div>';
    rhtml += '</div>';
  });
  recentEl.innerHTML = rhtml;
}

async function renderTransactions() {
  var year = appState.currentMonth.getFullYear();
  var month = appState.currentMonth.getMonth() + 1;
  var labelEl = document.querySelector('#view-transactions .month-label');
  if (labelEl) labelEl.textContent = year + '\u5e74' + month + '\u6708';
  document.querySelectorAll('#view-transactions .filter-chip').forEach(function(chip) {
    chip.classList.toggle('active', chip.dataset.filter === appState.currentTxFilter);
  });
  var all = await getTransactionsByMonth(year, month);
  var filtered = appState.currentTxFilter === 'all' ? all : all.filter(function(tx) { return tx.type === appState.currentTxFilter; });
  var listEl = document.getElementById('tx-list');
  if (!listEl) return;
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83d\udccb</div><div class="empty-text">\u672c\u6708\u6682\u65e0\u8bb0\u5f55</div></div>';
    return;
  }
  filtered.sort(function(a, b) { return b.date.localeCompare(a.date); });
  var groups = {};
  filtered.forEach(function(tx) {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });
  var html = '';
  Object.keys(groups).forEach(function(date) {
    html += '<div class="tx-date-header">' + formatDate(date) + '</div>';
    groups[date].forEach(function(tx) {
      var c = (tx.type === 'income' ? appState.categories.income : appState.categories.expense).find(function(c) { return c.name === tx.category; });
      html += '<div class="tx-list-item" data-id="' + tx.id + '">';
      html += '  <div class="tx-icon" style="background:' + (c ? c.color : '#636E72') + '22">' + (c ? c.icon : '\ud83d\udce6') + '</div>';
      html += '  <div class="tx-info">';
      html += '    <div class="tx-category">' + (tx.category || '\u672a\u5206\u7c7b') + '</div>';
      html += '    <div class="tx-date">' + (tx.note || tx.date) + '</div>';
      html += '  </div>';
      html += '  <div class="tx-amount ' + tx.type + '">' + (tx.type === 'income' ? '+' : '-') + appState.currency + ' ' + formatAmount(tx.amount) + '</div>';
      html += '</div>';
    });
  });
  listEl.innerHTML = html;
  document.querySelectorAll('#tx-list .tx-list-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var id = Number(el.dataset.id);
      var tx = filtered.find(function(t) { return t.id === id; });
      if (tx) openEditModal(tx);
    });
  });
}

async function renderAnalytics() {
  var currentYear = appState.currentMonth.getFullYear();
  var currentMonth = appState.currentMonth.getMonth() + 1;
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(currentYear, currentMonth - 1 - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') });
  }
  var summaries = await Promise.all(months.map(function(m) { return getMonthlySummary(m.year, m.month); }));
  var current = summaries[summaries.length - 1];
  var labelEl = document.getElementById('stat-month-label');
  if (labelEl) labelEl.textContent = currentYear + '\u5e74' + currentMonth + '\u6708';
  var incEl = document.getElementById('stat-income');
  if (incEl) incEl.textContent = appState.currency + ' ' + formatAmount(current.income);
  var expEl = document.getElementById('stat-expense');
  if (expEl) expEl.textContent = appState.currency + ' ' + formatAmount(current.expense);
  var cntEl = document.getElementById('stat-count');
  if (cntEl) cntEl.textContent = current.transactionCount + ' \u7b14';
  var maxVal = Math.max.apply(null, summaries.map(function(s) { return Math.max(s.income, s.expense); }));
  if (maxVal === 0) maxVal = 1;
  var trendEl = document.getElementById('trend-chart');
  if (trendEl) {
    var charts = '';
    summaries.forEach(function(s, i) {
      var ih = Math.max((s.income / maxVal) * 120, 4);
      var eh = Math.max((s.expense / maxVal) * 120, 4);
      charts += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">';
      charts += '  <div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:2px">';
      charts += '    <div style="width:70%;background:var(--success);border-radius:4px 4px 0 0;height:' + ih + 'px;min-height:4px"></div>';
      charts += '    <div style="width:70%;background:var(--danger);border-radius:4px 4px 0 0;height:' + eh + 'px;min-height:4px"></div>';
      charts += '  </div>';
      charts += '  <div style="font-size:10px;color:var(--text-tertiary);text-align:center">' + months[i].label.slice(5) + '</div>';
      charts += '</div>';
    });
    trendEl.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-end;height:160px;padding:8px 0">' + charts + '</div><div style="display:flex;gap:16px;justify-content:center;font-size:12px;color:var(--text-secondary)"><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--success);display:inline-block"></span>\u6536\u5165</span><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger);display:inline-block"></span>\u652f\u51fa</span></div>';
  }
  var allCats = current.expenseByCategory.concat(current.incomeByCategory).sort(function(a, b) { return b.amount - a.amount; }).slice(0, 8);
  var rankEl = document.getElementById('category-rank');
  if (!rankEl) return;
  if (allCats.length === 0) {
    rankEl.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83d\udcca</div><div class="empty-text">\u672c\u6708\u6682\u65e0\u6570\u636e</div></div>';
    return;
  }
  var rh = '';
  allCats.forEach(function(cat) {
    var found = appState.categories.expense.concat(appState.categories.income).find(function(c) { return c.name === cat.category; });
    rh += '<div class="category-item">';
    rh += '  <div class="cat-icon" style="background:' + cat.color + '22"><span>' + (found ? found.icon : '\ud83d\udce6') + '</span></div>';
    rh += '  <div class="cat-info">';
    rh += '    <div class="cat-name">' + cat.category + '</div>';
    rh += '    <div class="cat-bar"><div class="cat-bar-fill" style="width:' + Math.min(cat.percentage, 100) + '%;background:' + cat.color + '"></div></div>';
    rh += '  </div>';
    rh += '  <div class="cat-amount">' + appState.currency + ' ' + formatAmount(cat.amount) + '</div>';
    rh += '</div>';
  });
  rankEl.innerHTML = rh;
}

async function renderSettings() {
  var currency = await getSetting('currency') || '\u00a5';
  var valEl = document.getElementById('setting-currency-value');
  if (valEl) valEl.textContent = currency;
}

function prevMonth() {
  appState.currentMonth = new Date(appState.currentMonth.getFullYear(), appState.currentMonth.getMonth() - 1, 1);
  renderView(currentView);
}

function nextMonth() {
  appState.currentMonth = new Date(appState.currentMonth.getFullYear(), appState.currentMonth.getMonth() + 1, 1);
  renderView(currentView);
}

function openAddModal() {
  appState.editingTxId = null;
  appState.addFormType = 'expense';
  appState.addFormCategory = null;
  var titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = '\u8bb0\u4e00\u7b14';
  var delGroup = document.getElementById('delete-btn-group');
  if (delGroup) delGroup.style.display = 'none';
  var submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.textContent = '\u4fdd\u5b58';
  resetAddForm();
  showModal('modal-add');
}

function openEditModal(tx) {
  appState.editingTxId = tx.id;
  appState.addFormType = tx.type;
  appState.addFormCategory = tx.category;
  var titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = '\u7f16\u8f91\u8bb0\u5f55';
  var delGroup = document.getElementById('delete-btn-group');
  if (delGroup) delGroup.style.display = 'block';
  var submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.textContent = '\u66f4\u65b0';
  resetAddForm();
  showModal('modal-add');
}

function resetAddForm() {
  var amtEl = document.getElementById('add-amount');
  if (amtEl) amtEl.value = appState.editingTxId ? '' : '';
  var dateEl = document.getElementById('add-date');
  if (dateEl) dateEl.value = appState.editingTxId ? '' : todayStr();
  var noteEl = document.getElementById('add-note');
  if (noteEl) noteEl.value = '';
  setAddType(appState.addFormType);
}

function setAddType(type) {
  appState.addFormType = type;
  appState.addFormCategory = null;
  document.querySelectorAll('#add-type-toggle .type-toggle-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  renderCategoryPicker(type);
}

function selectCategory(name) {
  appState.addFormCategory = name;
  document.querySelectorAll('#category-picker .category-grid-item').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.name === name);
  });
}

function renderCategoryPicker(type) {
  var cats = type === 'income' ? appState.categories.income : appState.categories.expense;
  var picker = document.getElementById('category-picker');
  if (!picker) return;
  var html = '';
  cats.forEach(function(c) {
    html += '<div class="category-grid-item ' + (appState.addFormCategory === c.name ? 'selected' : '') + '" data-name="' + c.name + '">';
    html += '  <div class="cgi-icon" style="background:' + c.color + '22">' + c.icon + '</div>';
    html += '  <div class="cgi-name">' + c.name + '</div>';
    html += '</div>';
  });
  picker.innerHTML = html;
  document.querySelectorAll('#category-picker .category-grid-item').forEach(function(el) {
    el.addEventListener('click', function() { selectCategory(el.dataset.name); });
  });
}

async function submitTransaction() {
  var amtEl = document.getElementById('add-amount');
  var dateEl = document.getElementById('add-date');
  var noteEl = document.getElementById('add-note');
  if (!amtEl || !dateEl) return;
  var amount = parseFloat(amtEl.value);
  var date = dateEl.value;
  var note = noteEl.value.trim();
  if (!amount || amount <= 0) { showToast('\u8bf7\u8f93\u5165\u6709\u6548\u91d1\u989d'); return; }
  if (!appState.addFormCategory) { showToast('\u8bf7\u9009\u62e9\u5206\u7c7b'); return; }
  if (!date) { showToast('\u8bf7\u9009\u62e9\u65e5\u671f'); return; }
  var data = { type: appState.addFormType, category: appState.addFormCategory, amount: amount, date: date, note: note };
  try {
    if (appState.editingTxId) {
      await updateTransaction(appState.editingTxId, data);
      showToast('\u8bb0\u5f55\u5df2\u66f4\u65b0');
    } else {
      await addTransaction(data);
      showToast('\u8bb0\u5f55\u5df2\u4fdd\u5b58');
    }
    hideModal('modal-add');
    renderView(currentView);
  } catch (err) {
    showToast('\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
    console.error(err);
  }
}

async function deleteCurrentTransaction() {
  if (!appState.editingTxId) return;
  if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u6761\u8bb0\u5f55\u5417\uff1f')) return;
  try {
    await deleteTransaction(appState.editingTxId);
    showToast('\u8bb0\u5f55\u5df2\u5220\u9664');
    hideModal('modal-add');
    renderView(currentView);
  } catch (err) {
    showToast('\u5220\u9664\u5931\u8d25');
    console.error(err);
  }
}

async function changeCurrency() {
  var current = await getSetting('currency') || '\u00a5';
  var currencies = [
    { label: '\u4eba\u6c11\u5e01 \u00a5', value: '\u00a5' },
    { label: '\u7f8e\u5143 $', value: '$' },
    { label: '\u6e2f\u5143 HK$', value: 'HK$' },
    { label: '\u6b27\u5143 \u20ac', value: '\u20ac' },
    { label: '\u82f1\u9551 \u00a3', value: '\u00a3' },
    { label: '\u65e5\u5143 \u00a5', value: 'JP\u00a5' },
    { label: '\u97e9\u5143 \u20a9', value: '\u20a9' }
  ];
  var items = currencies.map(function(c) {
    return '<div class="settings-item" data-value="' + c.value + '"><div class="si-left"><span class="si-icon">' + c.value + '</span><span class="si-label">' + c.label + '</span></div><span class="si-value">' + (current === c.value ? '\u2713' : '') + '</span></div>';
  });
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.onclick = function() { overlay.remove(); sheet.remove(); document.body.style.overflow = ''; };
  var sheet = document.createElement('div');
  sheet.className = 'modal-sheet show';
  sheet.innerHTML = '<div class="modal-handle"></div><div class="modal-header"><h2>\u9009\u62e9\u8d27\u5e01</h2><button class="modal-close" id="currency-close">\u2715</button></div><div class="modal-body"><div class="settings-list">' + items.join('') + '</div></div>';
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  document.body.style.overflow = 'hidden';
  var cleanup = function() { overlay.remove(); sheet.remove(); document.body.style.overflow = ''; };
  document.getElementById('currency-close').onclick = cleanup;
  sheet.querySelectorAll('.settings-item[data-value]').forEach(function(el) {
    el.onclick = async function() {
      await setSetting('currency', el.dataset.value);
      appState.currency = el.dataset.value;
      cleanup();
      renderSettings();
      renderView(currentView);
      showToast('\u8d27\u5e01\u5df2\u66f4\u65b0');
    };
  });
}

async function exportData() {
  try {
    var data = await exportAllData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '\u5c0f\u718a\u8bb0\u8d26_\u5907\u4efd_' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('\u6570\u636e\u5df2\u5bfc\u51fa');
  } catch (err) {
    showToast('\u5bfc\u51fa\u5931\u8d25');
    console.error(err);
  }
}

async function resetAllData() {
  if (!confirm('\u786e\u5b9a\u8981\u6e05\u9664\u6240\u6709\u6570\u636e\u5417\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\uff01')) return;
  if (!confirm('\u518d\u6b21\u786e\u8ba4\uff1a\u6240\u6709\u8bb0\u8d26\u8bb0\u5f55\u5c06\u88ab\u5220\u9664\uff01')) return;
  try {
    await clearAllData();
    showToast('\u6570\u636e\u5df2\u6e05\u9664');
    renderView(currentView);
  } catch (err) {
    showToast('\u6e05\u9664\u5931\u8d25');
  }
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[App] Service Worker NOT supported');
    return;
  }
  try {
    var reg = await navigator.serviceWorker.register('/sw.js');
    console.log('[App] SW registered, scope: ' + reg.scope);

    // Wait for the SW to be ready (active + controlling)
    var readyReg = await navigator.serviceWorker.ready;
    console.log('[App] SW ready, state: ' + (readyReg.active ? readyReg.active.state : 'none'));

    // Check if SW is controlling this page
    if (navigator.serviceWorker.controller) {
      console.log('[App] SW controller:', navigator.serviceWorker.controller.state);
      // Query cache info
      navigator.serviceWorker.controller.postMessage({ type: 'GET_CACHE_INFO' });
    } else {
      console.warn('[App] No SW controller yet - first install, reloading...');
      // navigator.serviceWorker.ready resolved, but on first install
      // the page was loaded without SW. Reload once to get control.
      if (!sessionStorage.getItem('swReloaded')) {
        sessionStorage.setItem('swReloaded', '1');
        window.location.reload();
      } else {
        console.warn('[App] Reload already attempted, continuing without controller');
      }
    }

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (!event.data) return;
      switch (event.data.type) {
        case 'ONLINE_STATUS':
          appState.online = event.data.online;
          updateOnlineStatus();
          break;
        case 'CACHE_INFO':
          console.log('[App] Cache:', event.data.cacheName, '(' + event.data.itemCount + ' items)');
          event.data.items.forEach(function(url) { console.log('[App]   cached:', url); });
          break;
      }
    });

    // Detect when SW takes control (e.g., after update)
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      console.log('[App] SW controller changed');
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'GET_CACHE_INFO' });
      }
    });

    // Handle SW updates
    reg.addEventListener('updatefound', function() {
      var newWorker = reg.installing;
      if (!newWorker) return;
      console.log('[App] New SW version found');
      newWorker.addEventListener('statechange', function() {
        switch (newWorker.state) {
          case 'installed':
            if (navigator.serviceWorker.controller) {
              console.log('[App] New SW installed - ready for update');
              showToast('New version ready, refresh to apply');
            }
            break;
          case 'activated':
            console.log('[App] New SW activated');
            break;
        }
      });
    });
  } catch (error) {
    console.error('[App] SW registration failed:', error);
  }
}
function updateOnlineStatus() {
  var root = document.documentElement;
  var ind = document.querySelector('.online-indicator');
  var wasOffline = root.classList.contains('offline');
  if (!navigator.onLine) {
    root.classList.add('offline');
    if (ind) { ind.className = 'online-indicator offline'; ind.title = '离线'; }
    if (!wasOffline) showToast('已断开网络，离线模式运行');
  } else {
    root.classList.remove('offline');
    if (ind) { ind.className = 'online-indicator online'; ind.title = '在线'; }
    if (wasOffline) showToast('网络已恢复');
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const url = new URL(window.location.href);
  if (!url.searchParams.get('v')) {
    url.searchParams.set('v', APP_VERSION);
    window.history.replaceState({}, '', url.toString());
  }

  const lastVersion = localStorage.getItem(APP_VERSION_KEY);
  if (lastVersion && lastVersion !== APP_VERSION) {
    await clearOldCachesAndReload();
    return;
  }
  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);

  await registerSW();
  var isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) document.documentElement.classList.add('pwa-mode');
  var installTip = document.getElementById('install-tip');
  if (installTip && !isStandalone && window.innerWidth <= 768) {
    installTip.hidden = false;
    setTimeout(function() { installTip.style.opacity = '0'; installTip.style.transform = 'translateX(-50%) translateY(-6px)'; }, 2600);
  }
  var cats = await getCategories();
  appState.categories.income = cats.filter(function(c) { return c.type === 'income'; });
  appState.categories.expense = cats.filter(function(c) { return c.type === 'expense'; });
  appState.currency = await getSetting('currency') || '\u00a5';
  var initHash = location.hash.slice(1) || 'dashboard';
  if (['dashboard', 'transactions', 'analytics', 'settings'].indexOf(initHash) >= 0) {
    navigateTo(initHash);
  } else {
    navigateTo('dashboard');
  }
  document.querySelectorAll('.tab-item').forEach(function(tab) {
    tab.addEventListener('click', function() { navigateTo(tab.dataset.view); });
  });
  document.querySelectorAll('.month-nav.prev').forEach(function(el) { el.addEventListener('click', prevMonth); });
  document.querySelectorAll('.month-nav.next').forEach(function(el) { el.addEventListener('click', nextMonth); });
  var fab = document.getElementById('fab-add');
  if (fab) fab.addEventListener('click', openAddModal);
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.addEventListener('click', hideAllModals);
  document.querySelectorAll('.modal-close').forEach(function(el) { el.addEventListener('click', hideAllModals); });
  document.querySelectorAll('#add-type-toggle .type-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { setAddType(btn.dataset.type); });
  });
  var amtInput = document.getElementById('add-amount');
  if (amtInput) {
    amtInput.addEventListener('input', function(e) { e.target.value = e.target.value.replace(/[^\d.]/g, ''); });
  }
  var subBtn = document.getElementById('submit-btn');
  if (subBtn) subBtn.addEventListener('click', submitTransaction);
  var delBtn = document.getElementById('delete-btn');
  if (delBtn) delBtn.addEventListener('click', deleteCurrentTransaction);
  document.querySelectorAll('#view-transactions .filter-chip').forEach(function(chip) {
    chip.addEventListener('click', function() { appState.currentTxFilter = chip.dataset.filter; renderTransactions(); });
  });
  var si = document.getElementById('setting-import');
  if (si) si.addEventListener('click', importData);
  var se = document.getElementById('setting-export');
  if (se) se.addEventListener('click', exportData);
  var sr = document.getElementById('setting-reset');
  if (sr) sr.addEventListener('click', resetAllData);
  var app = document.getElementById('app');
  if (app) app.style.opacity = '1';
  console.log('\ud83d\udc3b \u5c0f\u718a\u8bb0\u8d26\u5df2\u542f\u52a8');
});

// Fallback: force show after 5s to prevent blank page
setTimeout(function() {
  var app = document.getElementById('app');
  if (app && window.getComputedStyle(app).opacity === '0') {
    app.style.opacity = '1';
    app.style.transition = 'none';
    console.warn('Fallback render triggered');
  }
}, 5000);
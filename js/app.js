// ============================================================
// app.js �?小熊记账 PWA 前端逻辑
// 包含页面、IndexedDB、PWA 更新逻辑
// ============================================================

import { addTransaction, updateTransaction, deleteTransaction, getAllTransactions, getTransactionsByMonth, getRecentTransactions, getCategories, addCategory, deleteCategory, getBalance, getMonthlySummary, getAllSettings, getSetting, setSetting, getAllBudgets, setBudget, getBudgetForMonth, exportAllData, importAllData, clearAllData } from './db.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const APP_VERSION = 'v1.2.3';
const APP_VERSION_KEY = 'billapp-version';

function formatAmount(num) {
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['�?, '一', '�?, '�?, '�?, '�?, '�?];
  const wd = weekdays[d.getDay()];
  return month + '�? + day + '�?�? + wd;
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
  if (labelEl) labelEl.textContent = year + '�? + month + '�?;
  var summary = await getMonthlySummary(year, month);
  var cats = await getCategories();
  appState.categories.income = cats.filter(function(c) { return c.type === 'income'; });
  appState.categories.expense = cats.filter(function(c) { return c.type === 'expense'; });
  var currency = await getSetting('currency') || '¥';
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
    breakdownEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">本月暂无支出</div></div>';
    return;
  }
  var html = '';
  summary.expenseByCategory.forEach(function(cat) {
    var found = appState.categories.expense.find(function(c) { return c.name === cat.category; });
    var icon = found ? found.icon : '📦';
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
    recentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">还没有记账记录，点击 + 开始记�?/div></div>';
    return;
  }
  var rhtml = '';
  recent.forEach(function(tx) {
    var c = (tx.type === 'income' ? appState.categories.income : appState.categories.expense).find(function(c) { return c.name === tx.category; });
    rhtml += '<div class="recent-item">';
    rhtml += '  <div class="tx-icon" style="background:' + (c ? c.color : '#636E72') + '22">' + (c ? c.icon : '📦') + '</div>';
   rhtml += '  <div class="tx-info">';
   rhtml += '    <div class="tx-category">' + (tx.category || '未分�?) + '</div>';
   rhtml += '    <div class="tx-note">' + formatDate(tx.date) + (tx.note ? ' | ' + tx.note : '') + '</div>';
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
  if (labelEl) labelEl.textContent = year + '�? + month + '�?;
  document.querySelectorAll('#view-transactions .filter-chip').forEach(function(chip) {
    chip.classList.toggle('active', chip.dataset.filter === appState.currentTxFilter);
  });
  var all = await getTransactionsByMonth(year, month);
  var filtered = appState.currentTxFilter === 'all' ? all : all.filter(function(tx) { return tx.type === appState.currentTxFilter; });
  var listEl = document.getElementById('tx-list');
  if (!listEl) return;
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">本月暂无记录</div></div>';
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
      html += '  <div class="tx-icon" style="background:' + (c ? c.color : '#636E72') + '22">' + (c ? c.icon : '📦') + '</div>';
     html += '  <div class="tx-info">';
     html += '    <div class="tx-category">' + (tx.category || '未分�?) + '</div>';
     html += '    <div class="tx-date">' + formatDate(tx.date) + (tx.note ? ' | ' + tx.note : '') + '</div>';
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
  if (labelEl) labelEl.textContent = currentYear + '�? + currentMonth + '�?;
  var incEl = document.getElementById('stat-income');
  if (incEl) incEl.textContent = appState.currency + ' ' + formatAmount(current.income);
  var expEl = document.getElementById('stat-expense');
  if (expEl) expEl.textContent = appState.currency + ' ' + formatAmount(current.expense);
  var cntEl = document.getElementById('stat-count');
  if (cntEl) cntEl.textContent = current.transactionCount + ' �?;
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
    trendEl.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-end;height:160px;padding:8px 0">' + charts + '</div><div style="display:flex;gap:16px;justify-content:center;font-size:12px;color:var(--text-secondary)"><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--success);display:inline-block"></span>收入</span><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger);display:inline-block"></span>支出</span></div>';
  }
  var allCats = current.expenseByCategory.concat(current.incomeByCategory).sort(function(a, b) { return b.amount - a.amount; }).slice(0, 8);
  var rankEl = document.getElementById('category-rank');
  if (!rankEl) return;
  if (allCats.length === 0) {
    rankEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">本月暂无数据</div></div>';
    return;
  }
  var rh = '';
  allCats.forEach(function(cat) {
    var found = appState.categories.expense.concat(appState.categories.income).find(function(c) { return c.name === cat.category; });
    rh += '<div class="category-item">';
    rh += '  <div class="cat-icon" style="background:' + cat.color + '22"><span>' + (found ? found.icon : '📦') + '</span></div>';
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
  var currency = await getSetting('currency') || '¥';
  var valEl = document.getElementById('setting-currency-value');
  var versionEl = document.getElementById('app-version');
  if (valEl) valEl.textContent = currency;
  if (versionEl) versionEl.textContent = APP_VERSION;
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
  if (titleEl) titleEl.textContent = '记一�?;
  var delGroup = document.getElementById('delete-btn-group');
  if (delGroup) delGroup.style.display = 'none';
  var submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.textContent = '保存';
  resetAddForm();
  showModal('modal-add');
}

function openEditModal(tx) {
  appState.editingTxId = tx.id;
  appState.addFormType = tx.type;
  appState.addFormCategory = tx.category;
  var titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = '编辑记录';
  var delGroup = document.getElementById('delete-btn-group');
  if (delGroup) delGroup.style.display = 'block';
  var submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.textContent = '更新';
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
  if (!amount || amount <= 0) { showToast('请输入有效金�?); return; }
  if (!appState.addFormCategory) { showToast('请选择分类'); return; }
  if (!date) { showToast('请选择日期'); return; }
  var data = { type: appState.addFormType, category: appState.addFormCategory, amount: amount, date: date, note: note };
  try {
    if (appState.editingTxId) {
      await updateTransaction(appState.editingTxId, data);
      showToast('记录已更�?);
    } else {
      await addTransaction(data);
      showToast('记录已保�?);
    }
    hideModal('modal-add');
    renderView(currentView);
  } catch (err) {
    showToast('保存失败，请重试');
    console.error(err);
  }
}

async function deleteCurrentTransaction() {
  if (!appState.editingTxId) return;
  if (!confirm('确定要删除这条记录吗�?)) return;
  try {
    await deleteTransaction(appState.editingTxId);
    showToast('记录已删�?);
    hideModal('modal-add');
    renderView(currentView);
  } catch (err) {
    showToast('删除失败');
    console.error(err);
  }
}

async function importData() {
  if (!confirm('导入数据会覆盖当前所有本地记录，确定继续吗？')) return;
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  input.onchange = async function() {
    var file = input.files && input.files[0];
    if (!file) return;
    try {
      var text = await file.text();
      var data = JSON.parse(text);
      await importAllData(data);
      // 导入后跳转到最近有交易的月�?      var allTx = await getAllTransactions();
      if (allTx && allTx.length > 0) {
        var latestDate = allTx.reduce(function(latest, tx) { return tx.date > latest ? tx.date : latest; }, allTx[0].date);
        var d = new Date(latestDate + 'T00:00:00');
        appState.currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      showToast('数据已导�?);
      renderView(currentView);
    } catch (err) {
      showToast('导入失败，请选择正确的备份文�?);
      console.error(err);
    } finally {
      input.remove();
    }
  };
  document.body.appendChild(input);
  input.click();
}

async function exportData() {
  try {
    var data = await exportAllData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '小熊记账_备份_' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导�?);
  } catch (err) {
    showToast('导出失败');
    console.error(err);
  }
}

async function resetAllData() {
  if (!confirm('确定要清除所有数据吗？此操作不可撤销�?)) return;
  if (!confirm('再次确认：所有记录将被删除！')) return;
  try {
    await clearAllData();
    showToast('数据已清�?);
    renderView(currentView);
  } catch (err) {
    showToast('清除失败');
  }
}

let swRegistration = null;
let isRefreshing = false;

function forceReloadLatestVersion() {
  const url = new URL(window.location.href);
  url.searchParams.set('v', APP_VERSION);
  window.location.replace(url.toString());
}

async function clearOldCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
  } catch (err) {
    console.warn('清理旧缓存失�?, err);
  }

  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  forceReloadLatestVersion();
}

function refreshAppFromNewServiceWorker(worker) {
  if (!worker) return;
  worker.postMessage({ type: 'SKIP_WAITING' });
  showToast('检测到新版本，正在更新...', 1800);
  setTimeout(forceReloadLatestVersion, 800);
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register(new URL('./sw.js', window.location.href));
    console.log('�?Service Worker 已注�?);

    if (swRegistration.waiting) {
      refreshAppFromNewServiceWorker(swRegistration.waiting);
    }

    swRegistration.addEventListener('updatefound', function() {
      const installingWorker = swRegistration.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', function() {
        if (swRegistration.waiting && swRegistration.waiting.state === 'installed') {
          refreshAppFromNewServiceWorker(swRegistration.waiting);
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (!isRefreshing) {
        isRefreshing = true;
        forceReloadLatestVersion();
      }
    });

    await swRegistration.update();
  } catch (error) {
    console.warn('⚠️ Service Worker 注册失败:', error);
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
  appState.currency = await getSetting('currency') || '¥';
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
  console.log('🐻 小熊记账已启�?);
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

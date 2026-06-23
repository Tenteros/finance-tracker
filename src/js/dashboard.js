import {
  loadTransactions,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthTotals,
  getAllCategories,
  applyFilters,
} from './transactions.js';
import { getCurrentUser } from './auth.js';
import {
  loadCustomCategories,
  buildCategoryOptions,
  addCustomCategory,
  isCreateNewValue,
  isOtherValue,
  resolveCategoryValue,
  getCategoryList,
} from './categories.js';
import { formatDate, parseDateInput, todayStr } from './dates.js';
import { initSettingsModal, loadUserPrefs, applyPrefs } from './settings.js';
import { t, applyI18n } from './i18n.js';

const dashboardScreen = document.getElementById('dashboard-screen');
const newTxScreen = document.getElementById('new-tx-screen');
const listEl = document.getElementById('transaction-list');
const emptyEl = document.getElementById('empty-list');
const newTxForm = document.getElementById('new-tx-form');
const newCatSelect = document.getElementById('new-tx-category');
const newCreateWrap = document.getElementById('new-create-wrap');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterSort = document.getElementById('filter-sort');

let editingId = null;

function locale() {
  const l = document.documentElement.lang;
  if (l === 'uk') return 'uk-UA';
  if (l === 'en') return 'en-US';
  return 'ru-RU';
}

function money(n) {
  return n.toLocaleString(locale(), { maximumFractionDigits: 2 }) + ' ₴';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function getFilters() {
  return {
    type: filterType.value,
    category: filterCategory.value,
    sort: filterSort.value,
  };
}

function setCats(select, type, pick = '') {
  select.innerHTML = buildCategoryOptions(type, pick);
  if (pick && [...select.options].some((o) => o.value === pick)) {
    select.value = pick;
  }
}

function toggleCreateBlock(select, wrap) {
  wrap.hidden = !isCreateNewValue(select.value);
  if (!isCreateNewValue(select.value)) {
    const inp = wrap.querySelector('[name="newCatName"]');
    if (inp) inp.value = '';
  }
}

function pickCategory(form) {
  const sel = form.querySelector('[name="category"]');
  const val = sel.value;
  if (isCreateNewValue(val)) return '';
  return resolveCategoryValue(val);
}

function readTxForm(form) {
  const amount = parseFloat(form.querySelector('[name="amount"]').value);
  const dateIso = parseDateInput(form.querySelector('[name="date"]').value);
  const category = pickCategory(form);

  if (!amount || amount <= 0) return { err: t('badAmount') };
  if (!dateIso) return { err: t('badDate') };
  if (!category) return { err: t('pickCategory') };

  return {
    tx: {
      type: form.querySelector('[name="type"]').value,
      amount,
      category,
      date: dateIso,
      comment: (form.querySelector('[name="comment"]')?.value || '').trim(),
    },
  };
}

async function createCatFromForm(form) {
  const sel = form.querySelector('[name="category"]');
  const wrap = form.querySelector('.create-block');
  const nameInput = wrap?.querySelector('[name="newCatName"]');
  if (!nameInput) return;

  const type = form.querySelector('[name="type"]').value;
  const res = await addCustomCategory(type, nameInput.value);
  if (!res.ok) {
    alert(res.msg);
    return;
  }

  setCats(sel, type, res.name);
  sel.value = res.name;
  if (wrap) wrap.hidden = true;
  nameInput.value = '';
}

function inlineForm(tx) {
  const catPick = getCategoryList(tx.type).includes(tx.category) ? tx.category : tx.category;

  return `
    <form class="inline-edit">
      <label><span>${t('type')}</span>
        <select name="type">
          <option value="expense" ${tx.type === 'expense' ? 'selected' : ''}>${t('expenseType')}</option>
          <option value="income" ${tx.type === 'income' ? 'selected' : ''}>${t('incomeType')}</option>
        </select>
      </label>
      <label><span>${t('amount')}</span>
        <input type="number" name="amount" value="${tx.amount}" min="0.01" step="0.01" required />
      </label>
      <label><span>${t('category')}</span>
        <select name="category">${buildCategoryOptions(tx.type, catPick)}</select>
      </label>
      <div class="create-block" hidden>
        <label><span>${t('otherName')}</span>
          <input type="text" name="newCatName" />
        </label>
        <button type="button" class="btn ok tiny" data-action="create-cat">${t('createCat')}</button>
      </div>
      <label><span>${t('date')}</span>
        <input type="text" name="date" value="${formatDate(tx.date)}" required />
      </label>
      <label><span>${t('comment')}</span>
        <input type="text" name="comment" value="${esc(tx.comment)}" />
      </label>
      <div class="inline-btns">
        <button type="submit" class="btn ok tiny">${t('save')}</button>
        <button type="button" class="btn tiny" data-action="cancel-edit">${t('cancel')}</button>
      </div>
    </form>`;
}

function resetNewForm() {
  newTxForm.reset();
  const typeSel = newTxForm.querySelector('[name="type"]');
  typeSel.value = 'expense';
  setCats(newCatSelect, 'expense');
  newTxForm.querySelector('[name="date"]').value = todayStr();
  toggleCreateBlock(newCatSelect, newCreateWrap);
}

export async function showDashboardHome() {
  newTxScreen.classList.remove('active');
  dashboardScreen.classList.add('active');
  editingId = null;
  await renderDashboard();
}

async function showNewTxPage() {
  dashboardScreen.classList.remove('active');
  newTxScreen.classList.add('active');
  await loadCustomCategories();
  resetNewForm();
  applyI18n(newTxScreen);
}

function renderMonthStats() {
  const { balance, income, expense } = getMonthTotals();
  const hero = document.getElementById('hero-balance');
  hero.textContent = money(balance);
  hero.classList.toggle('neg', balance < 0);
  document.getElementById('month-balance').textContent = money(balance);
  document.getElementById('month-income').textContent = money(income);
  document.getElementById('month-expense').textContent = money(expense);
}

function fillFilterCategories() {
  const cats = getAllCategories();
  const cur = filterCategory.value;
  let html = `<option value="all">${t('all')}</option>`;
  html += cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  filterCategory.innerHTML = html;
  if (cats.includes(cur)) filterCategory.value = cur;
  else filterCategory.value = 'all';
}

function renderList() {
  const all = getTransactions();
  const list = applyFilters(all, getFilters());

  if (all.length === 0) {
    emptyEl.hidden = false;
    emptyEl.dataset.i18n = 'emptyList';
    emptyEl.textContent = t('emptyList');
    listEl.innerHTML = '';
    return;
  }

  if (list.length === 0) {
    emptyEl.hidden = false;
    emptyEl.dataset.i18n = 'emptyFilter';
    emptyEl.textContent = t('emptyFilter');
    listEl.innerHTML = '';
    return;
  }

  emptyEl.hidden = true;
  listEl.innerHTML = list
    .map((tx) => {
      const open = editingId === tx.id;
      return `
        <li class="tx-block" data-id="${tx.id}">
          <div class="tx-row ${tx.type}">
            <div>
              <b>${esc(tx.category)}</b>
              <span class="muted">${formatDate(tx.date)}${tx.comment ? ' · ' + esc(tx.comment) : ''}</span>
            </div>
            <div class="tx-row-end">
              <span class="sum">${tx.type === 'income' ? '+' : '−'}${money(tx.amount)}</span>
              <button type="button" data-action="edit" data-id="${tx.id}">${t('edit')}</button>
              <button type="button" data-action="delete" data-id="${tx.id}">${t('del')}</button>
            </div>
          </div>
          ${open ? `<div class="inline-wrap">${inlineForm(tx)}</div>` : ''}
        </li>`;
    })
    .join('');
}

export async function renderDashboard() {
  await Promise.all([loadTransactions(), loadCustomCategories()]);
  document.getElementById('dashboard-username').textContent = getCurrentUser();
  applyI18n(dashboardScreen);
  fillFilterCategories();
  renderMonthStats();
  renderList();
}

export function initDashboard() {
  loadUserPrefs();
  resetNewForm();

  initSettingsModal(() => {
    applyPrefs();
    renderDashboard();
    if (newTxScreen.classList.contains('active')) applyI18n(newTxScreen);
  });

  document.getElementById('open-new-tx').addEventListener('click', () => {
    showNewTxPage();
  });

  document.getElementById('back-dashboard').addEventListener('click', () => {
    showDashboardHome();
  });

  const typeSel = newTxForm.querySelector('[name="type"]');

  typeSel.addEventListener('change', () => {
    setCats(newCatSelect, typeSel.value);
    toggleCreateBlock(newCatSelect, newCreateWrap);
  });

  newCatSelect.addEventListener('change', () => {
    toggleCreateBlock(newCatSelect, newCreateWrap);
  });

  document.getElementById('new-create-cat').addEventListener('click', () => {
    createCatFromForm(newTxForm);
  });

  newTxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const parsed = readTxForm(newTxForm);
    if (parsed.err) {
      alert(parsed.err);
      return;
    }
    await addTransaction(parsed.tx);
    await showDashboardHome();
  });

  [filterType, filterCategory, filterSort].forEach((el) => {
    el.addEventListener('change', () => {
      renderDashboard();
    });
  });

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'create-cat') {
      const form = btn.closest('.inline-edit');
      if (form) await createCatFromForm(form);
      return;
    }

    const id = btn.dataset.id;

    if (btn.dataset.action === 'delete') {
      if (confirm(t('deleteTx'))) {
        await deleteTransaction(id);
        if (editingId === id) editingId = null;
        await renderDashboard();
      }
      return;
    }

    if (btn.dataset.action === 'edit') {
      editingId = editingId === id ? null : id;
      renderList();
      return;
    }

    if (btn.dataset.action === 'cancel-edit') {
      editingId = null;
      renderList();
    }
  });

  listEl.addEventListener('change', (e) => {
    if (e.target.name !== 'category') return;
    const form = e.target.closest('.inline-edit');
    if (!form) return;
    const wrap = form.querySelector('.create-block');
    if (wrap) toggleCreateBlock(e.target, wrap);
  });

  listEl.addEventListener('submit', async (e) => {
    const form = e.target.closest('.inline-edit');
    if (!form) return;
    e.preventDefault();

    const block = form.closest('.tx-block');
    const id = block?.dataset.id;
    if (!id) return;

    const parsed = readTxForm(form);
    if (parsed.err) {
      alert(parsed.err);
      return;
    }

    await updateTransaction(id, parsed.tx);
    editingId = null;
    await renderDashboard();
  });
}

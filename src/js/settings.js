import {
  getCurrentUser,
  isLoggedIn,
  getCurrentSettings,
  saveUserSettings,
} from './auth.js';
import { setLang, applyI18n, t } from './i18n.js';
import { getPrefs, savePrefsRaw } from './prefs.js';
import {
  loadCustomCategories,
  getUserCustomCategories,
  deleteCustomCategory,
  renameCustomCategory,
} from './categories.js';
import { loadTransactions } from './transactions.js';

export function savePrefs(prefs) {
  const merged = savePrefsRaw(prefs);
  applyPrefs(merged);
  return merged;
}

export function loadUserPrefs() {
  if (!isLoggedIn()) return getPrefs();
  const remote = getCurrentSettings();
  if (remote) return savePrefs(remote);
  return getPrefs();
}

export async function persistPrefs(prefs) {
  const saved = savePrefs(prefs);
  if (isLoggedIn()) await saveUserSettings(saved);
  return saved;
}

export function applyPrefs(prefs = getPrefs()) {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.lang = prefs.lang;
  setLang(prefs.lang);
  applyI18n();
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function renderCustomCats() {
  const box = document.getElementById('custom-cats-list');
  if (!box || !isLoggedIn()) return;

  const cats = getUserCustomCategories();
  const rows = [];

  ['expense', 'income'].forEach((type) => {
    const label = type === 'expense' ? t('expenseType') : t('incomeType');
    cats[type].forEach((name) => {
      rows.push(`
        <li class="cat-row" data-type="${type}" data-name="${esc(name)}">
          <span class="cat-name">${esc(name)} <small class="muted">(${label})</small></span>
          <span class="cat-btns">
            <button type="button" data-cat-action="rename">${t('edit')}</button>
            <button type="button" data-cat-action="delete">${t('del')}</button>
          </span>
        </li>`);
    });
  });

  box.innerHTML = rows.length
    ? `<ul class="cat-list">${rows.join('')}</ul>`
    : `<p class="muted">${t('noCustomCats')}</p>`;
}

function openRenameRow(row) {
  const type = row.dataset.type;
  const name = row.dataset.name;
  const label = type === 'expense' ? t('expenseType') : t('incomeType');

  row.innerHTML = `
    <div class="cat-rename">
      <small class="muted">${esc(name)} (${label})</small>
      <input type="text" class="cat-rename-input" value="${esc(name)}" />
      <span class="cat-btns">
        <button type="button" class="btn ok tiny" data-cat-action="save-rename">${t('save')}</button>
        <button type="button" class="btn tiny" data-cat-action="cancel-rename">${t('cancel')}</button>
      </span>
    </div>`;

  row.querySelector('.cat-rename-input').focus();
}

export function initSettingsModal(onChange) {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('open-settings');
  const closeBtn = document.getElementById('close-settings');
  const themeSel = document.getElementById('setting-theme');
  const langSel = document.getElementById('setting-lang');
  const catsList = document.getElementById('custom-cats-list');

  const prefs = loadUserPrefs();
  themeSel.value = prefs.theme;
  langSel.value = prefs.lang;
  applyPrefs(prefs);

  openBtn.addEventListener('click', async () => {
    const p = getPrefs();
    themeSel.value = p.theme;
    langSel.value = p.lang;
    await loadCustomCategories();
    renderCustomCats();
    applyI18n(modal);
    modal.hidden = false;
  });

  closeBtn.addEventListener('click', () => {
    modal.hidden = true;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  themeSel.addEventListener('change', async () => {
    await persistPrefs({ theme: themeSel.value, lang: langSel.value });
    onChange?.();
  });

  langSel.addEventListener('change', async () => {
    await persistPrefs({ theme: themeSel.value, lang: langSel.value });
    await loadCustomCategories();
    renderCustomCats();
    onChange?.();
  });

  catsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cat-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-cat-action');
    const row = btn.closest('.cat-row');
    if (!row) return;

    const type = row.dataset.type;
    const name = row.dataset.name;

    if (action === 'delete') {
      if (confirm(t('deleteCat'))) {
        await deleteCustomCategory(type, name);
        await loadTransactions();
        renderCustomCats();
        onChange?.();
      }
      return;
    }

    if (action === 'rename') {
      openRenameRow(row);
      return;
    }

    if (action === 'cancel-rename') {
      renderCustomCats();
      return;
    }

    if (action === 'save-rename') {
      const input = row.querySelector('.cat-rename-input');
      const newName = input?.value.trim();
      if (!newName || newName === name) {
        renderCustomCats();
        return;
      }
      const res = await renameCustomCategory(type, name, newName);
      if (!res.ok) {
        alert(res.msg);
        return;
      }
      await loadTransactions();
      renderCustomCats();
      onChange?.();
    }
  });
}

export { getPrefs };

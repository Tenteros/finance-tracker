import { supabase } from './supabase.js';
import { getUserId } from './auth.js';
import { getDefaultExpenseCats, getDefaultIncomeCats, t } from './i18n.js';

const CREATE_NEW = '__create__';
const OTHER = '__other__';

let catCache = { income: [], expense: [] };

export async function loadCustomCategories() {
  const userId = getUserId();
  catCache = { income: [], expense: [] };
  if (!userId) return catCache;

  const { data, error } = await supabase
    .from('custom_categories')
    .select('type, name')
    .eq('user_id', userId);

  if (error) {
    console.error(error);
    return catCache;
  }

  data?.forEach((row) => {
    catCache[row.type].push(row.name);
  });

  return catCache;
}

export function getCategoryList(type) {
  const custom = catCache[type] || [];
  const base = type === 'income' ? getDefaultIncomeCats() : getDefaultExpenseCats();
  return [...base, ...custom];
}

export function getUserCustomCategories() {
  return {
    income: [...catCache.income],
    expense: [...catCache.expense],
  };
}

export async function addCustomCategory(type, name) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, msg: t('badCategory') };

  const userId = getUserId();
  if (!userId) return { ok: false, msg: t('badCategory') };

  const taken = [...getCategoryList(type), t('other')];
  if (taken.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, msg: t('catExists') };
  }

  const { error } = await supabase.from('custom_categories').insert({
    user_id: userId,
    type,
    name: trimmed,
  });

  if (error) {
    console.error(error);
    return { ok: false, msg: t('catExists') };
  }

  catCache[type].push(trimmed);
  return { ok: true, name: trimmed };
}

export async function deleteCustomCategory(type, name) {
  const userId = getUserId();
  if (!userId) return;

  const fallback = t('other');

  await supabase
    .from('transactions')
    .update({ category: fallback })
    .eq('user_id', userId)
    .eq('type', type)
    .eq('category', name);

  await supabase
    .from('custom_categories')
    .delete()
    .eq('user_id', userId)
    .eq('type', type)
    .eq('name', name);

  catCache[type] = catCache[type].filter((c) => c !== name);
}

export async function renameCustomCategory(type, oldName, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, msg: t('badCategory') };

  const userId = getUserId();
  if (!userId) return { ok: false, msg: t('badCategory') };

  const i = catCache[type].indexOf(oldName);
  if (i === -1) return { ok: false, msg: t('badCategory') };

  const taken = getCategoryList(type).filter((c) => c !== oldName);
  if (taken.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, msg: t('catExists') };
  }

  const { error: catErr } = await supabase
    .from('custom_categories')
    .update({ name: trimmed })
    .eq('user_id', userId)
    .eq('type', type)
    .eq('name', oldName);

  if (catErr) {
    console.error(catErr);
    return { ok: false, msg: t('badCategory') };
  }

  await supabase
    .from('transactions')
    .update({ category: trimmed })
    .eq('user_id', userId)
    .eq('type', type)
    .eq('category', oldName);

  catCache[type][i] = trimmed;
  return { ok: true, name: trimmed };
}

export function buildCategoryOptions(type, selected = '') {
  const cats = getCategoryList(type);
  let html = cats
    .map((c) => `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`)
    .join('');

  html += `<option value="${CREATE_NEW}"${selected === CREATE_NEW ? ' selected' : ''}>${t('createCategory')}</option>`;
  html += `<option value="${OTHER}"${selected === OTHER ? ' selected' : ''}>${t('other')}</option>`;

  if (selected && !cats.includes(selected) && selected !== CREATE_NEW && selected !== OTHER) {
    html += `<option value="${selected}" selected>${selected}</option>`;
  }

  return html;
}

export function isCreateNewValue(val) {
  return val === CREATE_NEW;
}

export function isOtherValue(val) {
  return val === OTHER;
}

export function resolveCategoryValue(val) {
  if (isOtherValue(val)) return t('other');
  if (isCreateNewValue(val)) return '';
  return val;
}

export { CREATE_NEW, OTHER };

import { supabase } from './supabase.js';
import { getUserId } from './auth.js';
import { filterByMonth } from './dates.js';

let txCache = [];

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    date: row.date,
    comment: row.comment || '',
  };
}

export async function loadTransactions() {
  const userId = getUserId();
  if (!userId) {
    txCache = [];
    return txCache;
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount, category, date, comment')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error(error);
    txCache = [];
    return txCache;
  }

  txCache = (data || []).map(mapRow);
  return txCache;
}

export function getTransactions() {
  return txCache;
}

export async function addTransaction(tx) {
  const userId = getUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      date: tx.date,
      comment: tx.comment || '',
    })
    .select('id, type, amount, category, date, comment')
    .single();

  if (error) {
    console.error(error);
    return;
  }

  txCache.unshift(mapRow(data));
}

export async function updateTransaction(id, tx) {
  const userId = getUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from('transactions')
    .update({
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      date: tx.date,
      comment: tx.comment || '',
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, type, amount, category, date, comment')
    .single();

  if (error) {
    console.error(error);
    return;
  }

  const i = txCache.findIndex((t) => t.id === id);
  if (i !== -1) txCache[i] = mapRow(data);
}

export async function deleteTransaction(id) {
  const userId = getUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error(error);
    return;
  }

  txCache = txCache.filter((t) => t.id !== id);
}

export function getAllCategories() {
  return [...new Set(txCache.map((t) => t.category))].sort();
}

export function applyFilters(list, filters) {
  return list
    .filter((tx) => {
      if (filters.type !== 'all' && tx.type !== filters.type) return false;
      if (filters.category !== 'all' && tx.category !== filters.category) return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === 'asc') return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
}

export function calcTotals(list) {
  return list.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.income += tx.amount;
      else acc.expense += tx.amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, balance: 0 }
  );
}

export function getMonthTotals() {
  return calcTotals(filterByMonth(txCache));
}

export function getTotals(filters = { type: 'all', category: 'all', sort: 'desc' }) {
  return calcTotals(applyFilters(txCache, filters));
}

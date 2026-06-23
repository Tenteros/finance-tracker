export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function parseDateInput(str) {
  const clean = str.trim();
  const m = clean.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(iso);
  if (
    check.getFullYear() !== year ||
    check.getMonth() + 1 !== month ||
    check.getDate() !== day
  ) {
    return null;
  }

  return iso;
}

export function todayStr() {
  const n = new Date();
  const d = String(n.getDate()).padStart(2, '0');
  const m = String(n.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${n.getFullYear()}`;
}

export function isThisMonth(dateIso) {
  const now = new Date();
  const [y, m] = dateIso.split('-').map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1;
}

export function filterByMonth(list) {
  return list.filter((tx) => isThisMonth(tx.date));
}

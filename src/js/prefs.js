const PREFS_KEY = 'aft_prefs';

const defaults = { theme: 'dark', lang: 'ru' };

export function getPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function savePrefsRaw(prefs) {
  const merged = { ...getPrefs(), ...prefs };
  localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  return merged;
}

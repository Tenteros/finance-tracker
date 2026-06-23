import { supabase } from './supabase.js';
import { getPrefs } from './prefs.js';

const EMAIL_SUFFIX = '@aft.com';

let currentUser = null;
let currentUserId = null;
let currentSettings = null;

function loginToEmail(username) {
  return `${username.trim().toLowerCase()}${EMAIL_SUFFIX}`;
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, settings')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

async function applySession(session) {
  if (!session?.user) {
    currentUser = null;
    currentUserId = null;
    currentSettings = null;
    return;
  }

  currentUserId = session.user.id;
  const profile = await loadProfile(session.user.id);
  currentUser = profile?.username || null;
  currentSettings = profile?.settings || getPrefs();
}

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  await applySession(data.session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session);
  });
}

export function getUserId() {
  return currentUserId;
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentSettings() {
  return currentSettings;
}

export function isLoggedIn() {
  return currentUser !== null;
}

export async function registerUser(username, password) {
  const login = username.trim().toLowerCase();

  if (login.length < 3) return { ok: false, code: 'errLoginShort' };
  if (password.length < 6) return { ok: false, code: 'errPassShort' };

  const { data: free, error: rpcError } = await supabase.rpc('is_username_available', {
    p_username: login,
  });

  if (rpcError || free === false) return { ok: false, code: 'errLoginTaken' };

  const { error } = await supabase.auth.signUp({
    email: loginToEmail(login),
    password,
    options: { data: { username: login } },
  });

  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      return { ok: false, code: 'errLoginTaken' };
    }
    return { ok: false, code: 'errAuth' };
  }

  return { ok: true };
}

export async function loginUser(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(username),
    password,
  });

  if (error || !data.session) return { ok: false, code: 'errAuth' };

  await applySession(data.session);
  return { ok: true, settings: currentSettings };
}

export async function logoutUser() {
  await supabase.auth.signOut();
  currentUser = null;
  currentUserId = null;
  currentSettings = null;
}

export async function saveUserSettings(settings) {
  if (!currentUserId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ settings })
    .eq('id', currentUserId);

  if (!error) currentSettings = settings;
}

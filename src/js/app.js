import {
  initAuth,
  registerUser,
  loginUser,
  logoutUser,
  isLoggedIn,
} from './auth.js';
import { initDashboard, showDashboardHome } from './dashboard.js';
import { applyPrefs, loadUserPrefs, savePrefs } from './settings.js';
import { t, applyI18n } from './i18n.js';
import { supabaseConfigured } from './supabase.js';

const loginScreen = document.getElementById('login-screen');
const registerScreen = document.getElementById('register-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const newTxScreen = document.getElementById('new-tx-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

function hideAll() {
  loginScreen.classList.remove('active');
  registerScreen.classList.remove('active');
  dashboardScreen.classList.remove('active');
  newTxScreen.classList.remove('active');
}

async function showScreen(name) {
  hideAll();
  if (name === 'login') loginScreen.classList.add('active');
  if (name === 'register') registerScreen.classList.add('active');
  if (name === 'dashboard') await showDashboardHome();
}

function showError(el, text) {
  el.textContent = text;
  el.hidden = false;
}

function hideError(el) {
  el.textContent = '';
  el.hidden = true;
}

async function checkAuth() {
  if (isLoggedIn()) await showScreen('dashboard');
  else showScreen('login');
}

document.getElementById('go-register').addEventListener('click', () => {
  hideError(loginError);
  showScreen('register');
});

document.getElementById('go-login').addEventListener('click', () => {
  hideError(registerError);
  showScreen('login');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);

  if (!supabaseConfigured) {
    showError(loginError, 'Нет .env с ключами Supabase');
    return;
  }

  const data = new FormData(loginForm);
  const result = await loginUser(data.get('username'), data.get('password'));

  if (!result.ok) {
    showError(loginError, t(result.code));
    return;
  }

  if (result.settings) savePrefs(result.settings);
  applyPrefs();
  loginForm.reset();
  await showScreen('dashboard');
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(registerError);

  if (!supabaseConfigured) {
    showError(registerError, 'Нет .env с ключами Supabase');
    return;
  }

  const data = new FormData(registerForm);
  const pass = data.get('password');
  const pass2 = data.get('passwordConfirm');

  if (pass !== pass2) {
    showError(registerError, t('passMismatch'));
    return;
  }

  const result = await registerUser(data.get('username'), pass);

  if (!result.ok) {
    showError(registerError, t(result.code));
    return;
  }

  registerForm.reset();
  showScreen('login');
  showError(loginError, t('accountCreated'));
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await logoutUser();
  showScreen('login');
});

async function boot() {
  applyPrefs(loadUserPrefs());
  applyI18n();
  initDashboard();
  await initAuth();
  await checkAuth();
}

boot();

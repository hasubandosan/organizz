// Адрес вашего задеплоенного backend (db-connector). Поменяйте, если домен другой.
const API_BASE = 'https://organizz.onrender.com';
const APP_SLUG = 'app_1';

const authBox = document.getElementById('authBox');
const appBox = document.getElementById('appBox');
const authError = document.getElementById('authError');

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const userEmailEl = document.getElementById('userEmail');
const itemsList = document.getElementById('itemsList');
const itemForm = document.getElementById('itemForm');
const logoutBtn = document.getElementById('logoutBtn');

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}
function clearError() {
  authError.classList.add('hidden');
}

// --- переключение вкладок Вход/Регистрация ---
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  clearError();
});
tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  clearError();
});

// --- регистрация ---
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, appSlug: APP_SLUG }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.formErrors?.[0] || data.error || 'Ошибка регистрации');
    onAuthSuccess(data.token, data.user.email);
  } catch (err) {
    showError(err.message);
  }
});

// --- вход ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    onAuthSuccess(data.token, data.user.email);
  } catch (err) {
    showError(err.message);
  }
});

// --- после успешного логина/регистрации ---
async function onAuthSuccess(token, email) {
  localStorage.setItem('token', token);
  localStorage.setItem('email', email);

  // Если пришли из другого модуля (?app=projects) — выдаём роль и там тоже,
  // без повторной регистрации (один логин работает везде).
  const params = new URLSearchParams(location.search);
  // Без ?app= заходят напрямую — ведём в хаб, который работает с модулем projects
  const appSlug = params.get('app') || 'projects';
  const redirect = params.get('redirect');

  // Роль выдаём сразу во всех модулях LifeOS (повторный join безопасен): модули читают
  // и пишут друг в друга (общие теги в 'shared', хаб читает покупки и т.д.).
  const ALL_MODULES = ['projects', 'shared', 'purchases', 'meals', 'cosplays'];
  const toJoin = new Set([...ALL_MODULES, appSlug]);
  for (const slug of toJoin) {
    if (slug === APP_SLUG) continue;
    try {
      await fetch(`${API_BASE}/auth/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appSlug: slug }),
      });
    } catch { /* модуль не найден в registry — не критично, просто не даём роль */ }
  }

  // Возвращаемся туда, откуда редиректнуло; если пришли напрямую — в хаб
  window.location.href = redirect || '/hub/';
}

function showApp(token, email) {
  authBox.classList.add('hidden');
  appBox.classList.remove('hidden');
  userEmailEl.textContent = email;
  loadItems(token);
}

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  appBox.classList.add('hidden');
  authBox.classList.remove('hidden');
  loginForm.reset();
  registerForm.reset();
});

// --- данные приложения (app_1/items) ---
async function loadItems(token) {
  try {
    const res = await fetch(`${API_BASE}/${APP_SLUG}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Не удалось загрузить данные');
    const items = await res.json();
    renderItems(items);
  } catch (err) {
    itemsList.innerHTML = `<li>${err.message}</li>`;
  }
}

function renderItems(items) {
  itemsList.innerHTML = '';
  if (items.length === 0) {
    itemsList.innerHTML = '<li>Пока пусто</li>';
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item.title;
    itemsList.appendChild(li);
  }
}

itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const titleInput = document.getElementById('itemTitle');
  const title = titleInput.value;

  try {
    const res = await fetch(`${API_BASE}/${APP_SLUG}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Не удалось добавить запись');
    titleInput.value = '';
    loadItems(token);
  } catch (err) {
    alert(err.message);
  }
});

// --- автовход, если токен уже есть в localStorage ---
const savedToken = localStorage.getItem('token');
const savedEmail = localStorage.getItem('email');
if (savedToken && savedEmail) {
  const back = new URLSearchParams(location.search).get('redirect');
  window.location.href = back || '/hub/';
}

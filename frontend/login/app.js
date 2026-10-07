// LifeOS — страница входа. Один логин на все модули; после входа токен уезжает обратно на модуль в #fragment.
// Адрес задеплоенного backend. Поменяйте, если домен другой.
const API_BASE = 'https://organizz.onrender.com';
const APP_SLUG = 'app_1';   // slug, который backend ждёт при регистрации

const $ = (id) => document.getElementById(id);
const authError = $('authError'), authInfo = $('authInfo');
const tabLogin = $('tabLogin'), tabRegister = $('tabRegister');
const loginForm = $('loginForm'), registerForm = $('registerForm');
const verifyForm = $('verifyForm'), forgotForm = $('forgotForm'), resetForm = $('resetForm');
const ALL_FORMS = [loginForm, registerForm, verifyForm, forgotForm, resetForm];
let pendingEmail = '';   // почта, на которую ушёл код (регистрация / сброс пароля)

// Модули (для заголовка и акцентного цвета «куда вы идёте»)
const MODULES = {
  hub: ['🏠', 'LifeOS'], projects: ['📋', 'Проекты'], meals: ['🍽', 'Питание'],
  purchases: ['🛒', 'Покупки'], cosplays: ['🎭', 'Косплеи'], admin: ['🛠', 'Админка'],
};
function targetModule() {
  const q = new URLSearchParams(location.search);
  const fromRedirect = (() => {
    try { return (new URL(q.get('redirect') || '').hostname.match(/^organizz-([a-z]+)\.pages\.dev$/) || [])[1]; } catch { return null; }
  })();
  const slug = q.get('app') || fromRedirect;
  return MODULES[slug] ? slug : 'hub';
}
(function brand() {
  const slug = targetModule();
  document.documentElement.dataset.module = slug;
  $('lgMark').textContent = MODULES[slug][0];
  if (slug !== 'hub') $('lgSub').textContent = `Вход в «${MODULES[slug][1]}»`;
})();

function showError(msg) { authError.textContent = msg; authError.classList.remove('hidden'); }
function clearError() { authError.classList.add('hidden'); authInfo.classList.add('hidden'); }
function showInfo(msg) { authInfo.textContent = msg; authInfo.classList.remove('hidden'); }

// Текст ошибки из ответа backend (строка или zod-объект)
function errText(data, fallback) {
  const e = data && data.error;
  if (typeof e === 'string') return e;
  if (e && e.formErrors && e.formErrors[0]) return e.formErrors[0];
  if (e && e.fieldErrors) { const f = Object.values(e.fieldErrors).flat()[0]; if (f) return f; }
  return fallback;
}

// --- вкладки Вход / Регистрация и экраны с кодом ---
function showForm(form, focusId) {
  ALL_FORMS.forEach((f) => f.classList.toggle('hidden', f !== form));
  const inTabs = form === loginForm || form === registerForm;
  document.querySelector('.lg-tabs').classList.toggle('hidden', !inTabs);
  tabRegister.classList.toggle('active', form === registerForm); tabLogin.classList.toggle('active', form === loginForm);
  clearError();
  if (focusId) $(focusId).focus();
}
function setTab(reg) { showForm(reg ? registerForm : loginForm, reg ? 'registerEmail' : 'loginEmail'); }
tabLogin.addEventListener('click', () => setTab(false));
tabRegister.addEventListener('click', () => setTab(true));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => setTab(false)));
$('forgotLink').addEventListener('click', () => { $('forgotEmail').value = $('loginEmail').value; showForm(forgotForm, 'forgotEmail'); });

// --- показать / скрыть пароль ---
document.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
  const inp = $(b.dataset.eye), show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b.classList.toggle('on', show);
  b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
}));

// --- отправка формы: блокировка кнопки, подсказка про «спящий» сервер (бесплатный хостинг просыпается ~30–60 с) ---
async function submit(btn, busyText, path, body, fallbackError, onOk) {
  clearError();
  const idle = btn.textContent;
  btn.disabled = true; btn.textContent = busyText;
  const wake = setTimeout(() => { btn.textContent = 'Сервер просыпается, подождите…'; }, 4000);
  try {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new Error('Нет связи с сервером. Если он «спал», подождите минуту и повторите.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errText(data, fallbackError));
    if (onOk) onOk(data); else await onAuthSuccess(data.token, data.user.email);
  } catch (err) {
    showError(err.message);
    btn.disabled = false; btn.textContent = idle;
  } finally {
    clearTimeout(wake);
    if (onOk) { btn.disabled = false; btn.textContent = idle; }
  }
}

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('registerEmail').value.trim(), password = $('registerPassword').value;
  if (password.length < 8) return showError('Пароль — минимум 8 символов');
  submit($('registerBtn'), 'Отправляем код…', '/auth/register', { email, password, appSlug: APP_SLUG }, 'Ошибка регистрации', () => {
    pendingEmail = email; $('verifyCode').value = '';
    $('verifyHint').textContent = `Мы отправили код на ${email}. Если письма нет — проверьте «Спам».`;
    showForm(verifyForm, 'verifyCode');
  });
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submit($('loginBtn'), 'Входим…', '/auth/login', { email: $('loginEmail').value.trim(), password: $('loginPassword').value }, 'Неверный email или пароль');
});

verifyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submit($('verifyBtn'), 'Проверяем…', '/auth/verify', { email: pendingEmail, code: $('verifyCode').value.trim() }, 'Неверный код');
});

// повторная отправка кода (сервер пускает не чаще раза в минуту)
$('resendBtn').addEventListener('click', async () => {
  clearError();
  const btn = $('resendBtn'); btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/auth/resend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pendingEmail }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errText(data, 'Не удалось отправить код'));
    showInfo('Новый код отправлен.');
  } catch (err) { showError(err.message); }
  setTimeout(() => { btn.disabled = false; }, 5000);
});

// забыли пароль: шаг 1 — почта, шаг 2 — код и новый пароль
forgotForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('forgotEmail').value.trim();
  submit($('forgotBtn'), 'Отправляем…', '/auth/forgot', { email }, 'Не удалось отправить код', () => {
    pendingEmail = email; $('resetCode').value = ''; $('resetPassword').value = '';
    showForm(resetForm, 'resetCode');
  });
});
resetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = $('resetPassword').value;
  if (password.length < 8) return showError('Пароль — минимум 8 символов');
  submit($('resetBtn'), 'Сохраняем…', '/auth/reset', { email: pendingEmail, code: $('resetCode').value.trim(), password }, 'Не удалось сменить пароль', () => {
    $('loginEmail').value = pendingEmail; $('loginPassword').value = '';
    showForm(loginForm, 'loginPassword');
    showInfo('Пароль изменён. Войдите с новым паролем.');
  });
});

// --- возврат на модуль (модули на разных доменах → токен едет в #fragment) ---
const HUB_URL = 'https://organizz-hub.pages.dev/';
// Токен отдаём ТОЛЬКО на наши модули (иначе ?redirect=чужой-сайт украл бы токен)
const ALLOWED_RETURN = /^https:\/\/organizz-(hub|projects|purchases|meals|cosplays|admin)\.pages\.dev$/;
function returnUrl(token, email) {
  const raw = new URLSearchParams(location.search).get('redirect');
  let u;
  try { u = new URL(raw || HUB_URL); } catch { u = new URL(HUB_URL); }
  if (!ALLOWED_RETURN.test(u.origin)) u = new URL(HUB_URL);
  const p = new URLSearchParams({ lifeos_token: token, lifeos_email: email });
  if (u.hash) p.set('h', u.hash.slice(1));
  u.hash = p.toString();
  return u.toString();
}
function go(url) { window.location.href = url; }

// --- после успешного логина/регистрации ---
async function onAuthSuccess(token, email) {
  localStorage.setItem('token', token);
  localStorage.setItem('email', email);

  // Роль выдаём сразу во всех модулях LifeOS (повторный join безопасен): модули читают
  // и пишут друг в друга (общие теги в 'shared', хаб читает покупки и т.д.).
  const appSlug = new URLSearchParams(location.search).get('app') || 'projects';
  const ALL_MODULES = ['projects', 'shared', 'purchases', 'meals', 'cosplays'];
  for (const slug of new Set([...ALL_MODULES, appSlug])) {
    if (slug === APP_SLUG) continue;
    try {
      await fetch(`${API_BASE}/auth/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appSlug: slug }),
      });
    } catch { /* модуль не найден в registry — не критично, просто не даём роль */ }
  }
  go(returnUrl(token, email));   // туда, откуда редиректнуло; если пришли напрямую — в хаб
}

// --- автовход, если токен уже есть; выход / протухшая сессия — показываем форму ---
(function autoLogin() {
  const q = new URLSearchParams(location.search);
  if (q.get('logout') || q.get('expired')) {
    localStorage.removeItem('token'); localStorage.removeItem('email');
    showInfo(q.get('expired') ? 'Сессия истекла — войдите снова.' : 'Вы вышли из аккаунта.');
  } else {
    const t = localStorage.getItem('token'), e = localStorage.getItem('email');
    if (t && e) return go(returnUrl(t, e));
  }
  $('loginEmail').focus();
})();

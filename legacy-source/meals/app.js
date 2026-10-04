/* ══════════════════════════════════════════════
   app.js — bootstrap, auth gate, routing
   Исправлено: нет бесконечной загрузки,
   поддержка DEMO_MODE (без Supabase).
══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {

  // Fallback: через 3 секунды убираем загрузку в любом случае
  const fallbackTimer = setTimeout(() => {
    const container = document.getElementById('app-content');
    if (container && (container.textContent.includes('Загрузка') || container.querySelector('.spinner,.loading-center'))) {
      container.innerHTML = '<div class="screen"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Приложение не загрузилось</div><div class="empty-desc">Попробуйте обновить страницу или проверьте консоль (F12)</div></div></div>';
    }
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.remove('hidden');
    const header = document.getElementById('app-header');
    if (header) header.classList.remove('hidden');
  }, 3000);

  // ── Инициализация LifeOS core DB ──
  if (window.lifeosInit) {
    await lifeosInit().catch(e => console.warn('[LifeOS]', e));
  }

  // ── DEMO MODE: Supabase не настроен ──────────────
  if (window.DEMO_MODE) {
    console.info('[МенюПлан] Запуск в demo-режиме');
    if (typeof seedDemoData === 'function') {
      await seedDemoData().catch(e => console.warn('[МенюПлан] seedDemoData error:', e));
    }
    await initApp();
    clearTimeout(fallbackTimer);
    return;
  }

  // ── Auth gate (с таймаутом чтобы не висеть вечно) ─
  let inited = false;

  Auth.onAuthChange(async (event, session) => {
    if (inited) return;
    if (session?.user) {
      inited = true;
      Auth._user = session.user;
      await initApp();
      clearTimeout(fallbackTimer);
    } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
      inited = true;
      showAuthScreen();
      clearTimeout(fallbackTimer);
    }
  });

  try {
    const sessionPromise = sb.auth.getSession();
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('timeout')), 5000)
    );
    const { data: { session } } = await Promise.race([sessionPromise, timeout]);

    if (!inited) {
      inited = true;
      if (session?.user) {
        Auth._user = session.user;
        await initApp();
      } else {
        showAuthScreen();
      }
      clearTimeout(fallbackTimer);
    }
  } catch (e) {
    if (!inited) {
      inited = true;
      console.warn('[МенюПлан] Supabase недоступен:', e.message);
      showOfflineScreen();
      clearTimeout(fallbackTimer);
    }
  }
});

/* ── DEMO BANNER ────────────────────────────── */
function showDemoBanner() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9999;
    background:rgba(240,192,64,.15);border-bottom:1px solid rgba(240,192,64,.3);
    padding:8px 16px;font-size:11px;font-weight:700;color:#f0c040;
    display:flex;align-items:center;justify-content:space-between;
    font-family:var(--m,monospace);
  `;
  banner.innerHTML = `
    <span>⚠ Demo: Supabase не настроен. Вставь URL и KEY в db.js</span>
    <button onclick="this.parentElement.remove()" style="color:inherit;font-size:15px;opacity:.7">✕</button>
  `;
  document.body.appendChild(banner);
}

/* ── AUTH SCREEN ────────────────────────────── */
function showAuthScreen() {
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('app-header').classList.add('hidden');
  document.getElementById('app-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80dvh;padding:32px;text-align:center">
      <div style="font-size:72px;margin-bottom:16px">🍽️</div>
      <h1 style="font-family:var(--f);font-size:28px;font-weight:800;color:var(--accent);margin-bottom:8px">МенюПлан</h1>
      <p style="color:var(--text2);font-size:15px;max-width:280px;line-height:1.6;margin-bottom:32px">
        Планируйте питание, считайте БЖУ и составляйте списки покупок
      </p>
      <button onclick="Auth.signInWithGoogle()" style="
        display:flex;align-items:center;justify-content:center;gap:10px;
        width:100%;max-width:280px;padding:14px;border-radius:10px;
        background:var(--accent);color:#fff;font-size:14px;font-weight:800;
        font-family:var(--f);transition:.15s;
      ">
        <img src="https://www.google.com/favicon.ico" style="width:18px;height:18px;border-radius:2px"> Войти через Google
      </button>
      <p style="margin-top:16px;font-size:11px;color:var(--text3);line-height:1.6;">
        Данные хранятся в вашем аккаунте.<br>Работает на всех устройствах.
      </p>
    </div>`;
}

/* ── OFFLINE / ERROR SCREEN ─────────────────── */
function showOfflineScreen() {
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('app-header').classList.add('hidden');
  document.getElementById('app-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80dvh;padding:32px;text-align:center;gap:12px">
      <div style="font-size:56px">📡</div>
      <div style="font-size:17px;font-weight:800">Нет соединения</div>
      <div style="font-size:13px;color:var(--text3);max-width:260px;line-height:1.6">
        Не удалось подключиться к Supabase.<br>Проверь интернет или настрой URL/KEY в db.js.
      </div>
      <button onclick="location.reload()" style="
        margin-top:8px;padding:12px 24px;border-radius:10px;
        background:var(--bg3);border:1px solid var(--border2);
        font-size:13px;font-weight:700;color:var(--text2);
        font-family:var(--f);
      ">🔄 Попробовать снова</button>
    </div>`;
}

/* ── INIT APP ───────────────────────────────── */
async function initApp() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  document.getElementById('app-header').classList.remove('hidden');

  // Регистрируем роуты
  Router.register('menu',            MenuScreen);
  Router.register('recipes',         RecipesScreen);
  Router.register('recipe.view',     RecipeViewScreen);
  Router.register('recipe.edit',     RecipeEditScreen);
  Router.register('recipe.cook',     RecipeCookScreen);
  Router.register('recipe.new',      RecipeEditScreen);
  Router.register('products',        ProductsScreen);
  Router.register('product.new',     ProductEditScreen);
  Router.register('product.edit',    ProductEditScreen);
  Router.register('shopping',        ShoppingScreen);
  Router.register('profile',         ProfileScreen);
  Router.register('profile.diets',   DietsScreen);
  Router.register('collections',     CollectionsScreen);
  Router.register('collection.view', CollectionViewScreen);
  Router.register('templates',       TemplatesScreen);
  Router.register('mealprep',        MealPrepScreen);

  // Навигация
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => Router.go(btn.dataset.route));
  });

  // Gemini key из настроек (не критично если упадёт)
  try {
    const key = await Settings.get('geminiKey', '');
    if (window.AIConfig && key) AIConfig._key = key;
  } catch(e) {}

  await Router.go('menu');
}
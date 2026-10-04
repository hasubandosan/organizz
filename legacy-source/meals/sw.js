/* ══════════════════════════════════════════════
   sw.js — Service Worker (PWA)
   МенюПлан / LifeOS Nutrition Module

   Кэшируем статику (JS, CSS, HTML).
   Supabase + Google — всегда network-only.
   LifeOS core (db.js, ui.js, styles.css) — кэшируются.
══════════════════════════════════════════════ */
const CACHE = 'lifeos-menuplan-v2.1.1';

const STATIC = [
  './',
  './index.html',
  './menuplan-local.css',
  '../core/shopping-bridge.js',
  './db.js',
  './utils.js',
  './router.js',
  './components.js',
  './app.js',
  './ai-import.js',
  './manifest.json',
  './screens/menu.js',
  './screens/recipes.js',
  './screens/products.js',
  './screens/shopping.js',
  './screens/profile.js',
  './screens/collections.js',
  './screens/templates.js',
  './screens/mealprep.js',
  // LifeOS core (относительные пути из /menuplan/)
  '../core/styles.css',
  '../core/db.js',
  '../core/ui.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC.map(url => {
        // Для relative paths создаём Request вручную
        return new Request(url, { cache: 'reload' });
      })))
      .catch(err => {
        // Если core файлы недоступны — кэшируем только menuplan
        console.warn('[SW] Partial cache (core files may not be available):', err.message);
        const localOnly = STATIC.filter(u => !u.startsWith('../'));
        return caches.open(CACHE).then(c => c.addAll(localOnly));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase, Google, Gemini — всегда network
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('generativelanguage') ||
    url.hostname.includes('fonts.g') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    return; // браузер сам
  }

  // Статика — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});

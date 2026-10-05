/* ══════════════════════════════════════════════
   ai-import.js — импорт рецепта через ИИ
   Вызов ИИ идёт через backend: POST /ai/recipe (ключ Gemini хранится только на сервере).
   Если вставить готовый JSON рецепта, он сохранится без обращения к ИИ.

   Формат JSON (все поля, кроме name, необязательные):
   {
     "name": "Сырники",                  // строка, обязательно
     "emoji": "🥞",                       // 1 эмодзи
     "description": "Короткое описание",
     "portions": 4,                      // число
     "cookTimeMin": 30,                  // минуты, число
     "difficulty": 1,                    // 1..3
     "tags": ["завтрак", "быстро"],      // ИМЕНА тегов; сопоставляются с существующими, неизвестные пропускаются
     "recommendedMeals": ["Завтрак"],    // из: Завтрак, Обед, Ужин, Перекус
     "ingredients": [ { "name": "Творог", "qty": 500, "unit": "г" } ],
     "steps": [ { "text": "Смешать...", "timerMin": 0, "tip": "" } ],   // или просто строки
     "sourceUrl": "https://..."          // если рецепт взят по ссылке
   }
══════════════════════════════════════════════ */
'use strict';

const AIImport = {
  // Backend: вход { text | url, tags }, выход { recipe } — JSON рецепта выше.
  async parse(input) {
    const tags = (await mealTagOptions()).map(t => t.name);
    try {
      const r = await DB.api('/ai/recipe', { ...input, tags });
      return r.recipe;
    } catch (e) {
      if (e.status === 503) throw new Error('ИИ-разбор ещё не включён на сервере.');
      throw e;
    }
  },

  open() {
    this.close();
    const el = document.createElement('div');
    el.className = 'modal-overlay open'; el.id = 'ai-import-modal';
    el.onclick = e => { if (e.target === el) this.close(); };
    el.innerHTML = `<div class="modal">
      <div class="modal-header"><div class="modal-title">🤖 Импорт рецепта через ИИ</div><button class="modal-close" onclick="AIImport.close()">✕</button></div>
      <div class="modal-body">
        <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Вставьте текст рецепта или ссылку на него.</p>
        <textarea id="ai-text" rows="10" style="width:100%" placeholder="Текст рецепта или https://..."></textarea>
        <div id="ai-msg" style="font-size:12px;color:var(--text3);margin-top:8px"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="AIImport.close()">Отмена</button>
        <button class="btn btn-primary" id="ai-go" onclick="AIImport.run()">Разобрать и сохранить</button></div></div>`;
    document.body.appendChild(el);
  },

  close() { document.getElementById('ai-import-modal')?.remove(); },

  async run() {
    const text = document.getElementById('ai-text').value.trim();
    const msg = document.getElementById('ai-msg'), btn = document.getElementById('ai-go');
    if (!text) { msg.textContent = 'Вставьте текст или ссылку.'; return; }
    btn.disabled = true; msg.style.color = 'var(--text3)'; msg.textContent = 'Обрабатываю… (до 30 секунд, сервер может просыпаться)';
    try {
      let json = this._tryJson(text);
      if (!json) json = await this.parse(/^https?:\/\/\S+$/.test(text) ? { url: text } : { text });
      const saved = await this.saveRecipe(json);
      this.close(); toast('Рецепт добавлен');
      Router.go('recipe.view', { id: saved.id });
    } catch (e) {
      msg.textContent = e.message; msg.style.color = 'var(--red)'; btn.disabled = false;
    }
  },

  _tryJson(text) {
    const t = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    if (t[0] !== '{') return null;
    try { return JSON.parse(t); } catch (e) { throw new Error('Не удалось прочитать JSON: ' + e.message); }
  },

  // JSON рецепта -> запись в БД через Recipes.save (DB.*)
  async saveRecipe(raw) {
    const [tags, products] = await Promise.all([mealTagOptions(), Products.list()]);
    return Recipes.save(this.normalize(raw, tags, products));
  },

  normalize(raw, tags = [], products = []) {
    if (!raw || typeof raw !== 'object' || !String(raw.name || '').trim()) throw new Error('В рецепте нет названия (поле name).');
    const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
    const lc = s => String(s || '').trim().toLowerCase();
    const tagByName = new Map(tags.map(t => [lc(t.name), t.id]));
    const prodByName = new Map(products.map(p => [lc(p.name), p.id]));
    const meals = new Map(MEAL_TYPES.map(m => [lc(m), m]));
    return {
      name: String(raw.name).trim(),
      emoji: raw.emoji || '🍽️',
      description: String(raw.description || ''),
      portions: num(raw.portions) || 4,
      cookTimeMin: Math.round(num(raw.cookTimeMin)),
      difficulty: Math.min(3, Math.max(1, Math.round(num(raw.difficulty)) || 1)),
      tagIds: [...new Set((raw.tags || []).map(t => tagByName.get(lc(t))).filter(Boolean))],
      recommendedMeals: (raw.recommendedMeals || []).map(m => meals.get(lc(m))).filter(Boolean),
      sourceUrl: /^https?:\/\//.test(raw.sourceUrl || '') ? raw.sourceUrl : '',
      ingredients: (raw.ingredients || []).map(i => {
        const o = typeof i === 'string' ? { name: i } : i;
        return { name: String(o.name || '').trim(), qty: num(o.qty), unit: o.unit || '', productId: prodByName.get(lc(o.name)) || null };
      }).filter(i => i.name),
      steps: (raw.steps || []).map(s => typeof s === 'string' ? { text: s } : s).filter(s => s && s.text),
    };
  },
};

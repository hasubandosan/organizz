// МенюПлан — screens/diets.js (режимы питания и генерация)
'use strict';

const DietsScreen = {
  async render(container) {
    const settings = await Settings.getAll();
    const diets = settings.diets || [];
    const activeDietId = settings.activeDietId || 'none';

    let html = '<div class="screen">';
    html += '<div class="re-header"><button class="icon-btn" onclick="Router.back()">←</button><h2>Режимы питания</h2></div>';

    // ── Готовые режимы ──
    html += '<div class="ds-section"><h3>📋 Готовые режимы</h3>';
    const presetDiets = [
      { id: 'none', name: 'Без режима', desc: 'Любые блюда, без ограничений', emoji: '🍽️' },
      { id: 'balanced', name: 'Сбалансированное', desc: 'Б:Ж:У = 30:25:45, ~2000 ккал', emoji: '⚖️' },
      { id: 'high_protein', name: 'Высокобелковое', desc: 'Б:Ж:У = 40:25:35, ~1800 ккал', emoji: '💪' },
      { id: 'low_carb', name: 'Низкоуглеводное', desc: 'Б:Ж:У = 35:45:20, ~1600 ккал', emoji: '🥩' },
      { id: 'vegetarian', name: 'Вегетарианское', desc: 'Без мяса, Б:Ж:У = 25:30:45', emoji: '🥦' },
      { id: 'vegan', name: 'Веганское', desc: 'Без продуктов животного происхождения', emoji: '🌱' },
      { id: 'mediterranean', name: 'Средиземноморское', desc: 'Рыба, овощи, оливковое масло', emoji: '🫒' },
    ];

    for (const d of presetDiets) {
      const active = activeDietId === d.id ? ' style="border-color:var(--accent);background:rgba(240,192,64,.08)"' : '';
      const check = activeDietId === d.id ? ' ✓' : '';
      html += `<div class="ds-card"${active} onclick="DietsScreen._selectPreset('${d.id}')">
        <div class="ds-emoji">${d.emoji}</div>
        <div class="ds-body">
          <div class="ds-name">${d.name}${check}</div>
          <div class="ds-desc">${d.desc}</div>
        </div>
      </div>`;
    }
    html += '</div>';

    // ── Кастомные режимы ──
    html += '<div class="ds-section"><h3>🎯 Кастомные режимы</h3>';
    if (diets.length === 0) {
      html += '<div class="empty" style="padding:16px"><div class="empty-icon">📝</div><div class="empty-title">Нет кастомных режимов</div></div>';
    } else {
      for (const d of diets) {
        const active = activeDietId === d.id ? ' style="border-color:var(--accent);background:rgba(240,192,64,.08)"' : '';
        html += `<div class="ds-card"${active} onclick="DietsScreen._selectCustom('${d.id}')">
          <div class="ds-emoji">${d.emoji || '🎯'}</div>
          <div class="ds-body">
            <div class="ds-name">${d.name}</div>
            <div class="ds-desc">Б:${d.protein || 0}% Ж:${d.fat || 0}% У:${d.carbs || 0}% · ${d.kcal || 0} ккал</div>
          </div>
        </div>`;
      }
    }
    html += `<button class="menu-action-btn" style="margin:12px 16px" onclick="DietsScreen._createCustom()">➕ Создать кастомный режим</button>`;
    html += '</div>';

    // ── Личные предпочтения ──
    html += '<div class="ds-section"><h3>👤 Личные предпочтения</h3>';
    html += '<div class="ds-form">';
    html += '<div class="ds-row"><label>Ккал в день</label><input type="number" id="ds-kcal" value="' + (settings.genFilters?.kcal || 2000) + '" min="500" max="5000"></div>';
    html += '<div class="ds-row"><label>Белки (%)</label><input type="number" id="ds-protein" value="' + (settings.genFilters?.protein || 30) + '" min="5" max="60"></div>';
    html += '<div class="ds-row"><label>Жиры (%)</label><input type="number" id="ds-fat" value="' + (settings.genFilters?.fat || 25) + '" min="5" max="60"></div>';
    html += '<div class="ds-row"><label>Углеводы (%)</label><input type="number" id="ds-carbs" value="' + (settings.genFilters?.carbs || 45) + '" min="5" max="60"></div>';
    html += '<div class="ds-row"><label>Исключить продукты</label><input type="text" id="ds-exclude" value="' + ((settings.genFilters?.exclude || []).join(', ')) + '" placeholder="через запятую"></div>';
    html += `<button class="menu-action-btn" onclick="DietsScreen._savePrefs()">💾 Сохранить предпочтения</button>`;
    html += '</div></div>';

    // ── Кнопка генерации ──
    html += '<div style="padding:16px">';
    html += `<button class="menu-action-btn" style="width:100%;padding:16px;font-size:16px" onclick="DietsScreen._generate()">✨ Сгенерировать план на неделю</button>`;
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = 'Режимы питания';
    document.getElementById('header-icon').textContent = '🥗';
  },

  async _selectPreset(id) {
    await Settings.set('activeDietId', id);
    if (typeof toast === 'function') toast('✅ Режим выбран');
    await this.render(document.getElementById('app-content'));
  },

  async _selectCustom(id) {
    await Settings.set('activeDietId', id);
    if (typeof toast === 'function') toast('✅ Кастомный режим выбран');
    await this.render(document.getElementById('app-content'));
  },

  _createCustom() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    let html = '<div class="modal" style="max-width:380px">';
    html += '<div class="modal-header"><span>🎯 Новый режим</span><button class="icon-btn" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="ds-form">';
    html += '<div class="ds-row"><label>Название</label><input type="text" id="cd-name" placeholder="Мой режим"></div>';
    html += '<div class="ds-row"><label>Эмодзи</label><input type="text" id="cd-emoji" value="🎯" maxlength="2" style="width:60px;text-align:center;font-size:20px"></div>';
    html += '<div class="ds-row"><label>Ккал</label><input type="number" id="cd-kcal" value="2000" min="500" max="5000"></div>';
    html += '<div class="ds-row"><label>Белки %</label><input type="number" id="cd-protein" value="30" min="5" max="60"></div>';
    html += '<div class="ds-row"><label>Жиры %</label><input type="number" id="cd-fat" value="25" min="5" max="60"></div>';
    html += '<div class="ds-row"><label>Углеводы %</label><input type="number" id="cd-carbs" value="45" min="5" max="60"></div>';
    html += '</div>';
    html += `<button class="menu-action-btn" style="margin-top:12px;width:100%" onclick="DietsScreen._saveCustom()">💾 Сохранить</button>`;
    html += '</div></div>';
    overlay.innerHTML = html;
    document.getElementById('modal-root').appendChild(overlay);
  },

  async _saveCustom() {
    const name = document.getElementById('cd-name').value.trim();
    if (!name) { alert('Введи название'); return; }
    const diet = {
      id: 'custom-' + Date.now(),
      name,
      emoji: document.getElementById('cd-emoji').value || '🎯',
      kcal: parseInt(document.getElementById('cd-kcal').value) || 2000,
      protein: parseInt(document.getElementById('cd-protein').value) || 30,
      fat: parseInt(document.getElementById('cd-fat').value) || 25,
      carbs: parseInt(document.getElementById('cd-carbs').value) || 45,
    };
    const settings = await Settings.getAll();
    const diets = [...(settings.diets || []), diet];
    await Settings.set('diets', diets);
    await Settings.set('activeDietId', diet.id);
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    if (typeof toast === 'function') toast('✅ Режим "' + name + '" создан');
    await this.render(document.getElementById('app-content'));
  },

  async _savePrefs() {
    const filters = {
      kcal: parseInt(document.getElementById('ds-kcal').value) || 2000,
      protein: parseInt(document.getElementById('ds-protein').value) || 30,
      fat: parseInt(document.getElementById('ds-fat').value) || 25,
      carbs: parseInt(document.getElementById('ds-carbs').value) || 45,
      exclude: document.getElementById('ds-exclude').value.split(',').map(s => s.trim()).filter(Boolean),
    };
    await Settings.set('genFilters', filters);
    if (typeof toast === 'function') toast('✅ Предпочтения сохранены');
  },

  async _generate() {
    const settings = await Settings.getAll();
    const filters = settings.genFilters || {};
    const activeDietId = settings.activeDietId || 'none';
    const allRecipes = await Recipes.list();
    const mts = await Settings.get('mealTypes', DEFAULT_MEAL_TYPES);

    // Фильтруем рецепты по режиму
    let candidates = [...allRecipes];
    if (activeDietId === 'vegetarian') {
      // Исключаем рецепты с мясом/рыбой
      const meatProducts = ['Куриная грудка', 'Лосось'];
      candidates = candidates.filter(r => !(r.ingredients || []).some(ing => meatProducts.includes(ing.name)));
    }
    if (activeDietId === 'vegan') {
      const animalProducts = ['Куриная грудка', 'Лосось', 'Яйца', 'Молоко', 'Сметана', 'Творог'];
      candidates = candidates.filter(r => !(r.ingredients || []).some(ing => animalProducts.includes(ing.name)));
    }

    if (candidates.length === 0) {
      if (typeof toast === 'function') toast('❌ Нет подходящих рецептов для этого режима', 4000);
      return;
    }

    // Генерируем план: случайные рецепты на каждый слот
    const weekKey = WeekDB.currentKey();
    const week = await WeekDB.get(weekKey);
    week.days = {};

    for (const day of DAYS) {
      week.days[day] = {};
      for (const mt of mts) {
        const suitable = candidates.filter(r =>
          !r.recommendedMeals || r.recommendedMeals.length === 0 || r.recommendedMeals.includes(mt)
        );
        const pool = suitable.length > 0 ? suitable : candidates;
        const picks = [];
        const count = mt === 'Завтрак' ? 1 : (mt === 'Обед' ? 2 : 1);
        for (let i = 0; i < count && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          picks.push(pool[idx].id);
          pool.splice(idx, 1);
        }
        week.days[day][mt] = picks;
      }
    }

    await WeekDB.save(week);
    if (typeof toast === 'function') toast('✨ План сгенерирован!');
    Router.go('menu');
  },
};
// МенюПлан — screens/recipe-edit.js
'use strict';

const RecipeEditScreen = {
  async render(container, recipe) {
    const r = recipe ? { ...recipe } : {
      name: '', emoji: '🍽️', description: '', portions: 4, cookTimeMin: 30, difficulty: 1,
      tags: [], recommendedMeals: ['Обед'], ingredients: [], steps: [],
    };
    const isNew = !recipe || !recipe.id;
    const products = await Products.list();

    let html = '<div class="screen recipe-edit">';
    html += '<div class="re-header">';
    html += `<button class="icon-btn" onclick="Router.back()">←</button>`;
    html += `<h2>${isNew ? 'Новый рецепт' : 'Редактировать'}</h2>`;
    html += `<button class="icon-btn" onclick="RecipeEditScreen._save()">💾</button>`;
    html += '</div>';

    html += '<div class="re-form">';

    // Эмодзи
    html += '<div class="re-row"><label>Эмодзи</label><input type="text" id="re-emoji" value="' + (r.emoji || '🍽️') + '" maxlength="2" style="font-size:24px;width:60px;text-align:center"></div>';

    // Название
    html += '<div class="re-row"><label>Название</label><input type="text" id="re-name" value="' + (r.name || '') + '" placeholder="Название рецепта"></div>';

    // Описание
    html += '<div class="re-row"><label>Описание</label><textarea id="re-desc" rows="2" placeholder="Краткое описание">' + (r.description || '') + '</textarea></div>';

    // Мета: время, порции, сложность
    html += '<div class="re-row re-row-group">';
    html += '<div><label>Время (мин)</label><input type="number" id="re-time" value="' + (r.cookTimeMin || 30) + '" min="1"></div>';
    html += '<div><label>Порции</label><input type="number" id="re-portions" value="' + (r.portions || 4) + '" min="1"></div>';
    html += '<div><label>Сложность 1-3</label><input type="number" id="re-difficulty" value="' + (r.difficulty || 1) + '" min="1" max="3"></div>';
    html += '</div>';

    // Теги
    html += '<div class="re-row"><label>Теги (через запятую)</label><input type="text" id="re-tags" value="' + ((r.tags || []).join(', ')) + '" placeholder="завтрак, пп, быстро"></div>';

    // Рекомендуемые приёмы
    html += '<div class="re-row"><label>Рекомендуется для</label>';
    const allMts = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];
    html += '<div class="re-checkbox-group">';
    for (const mt of allMts) {
      const checked = (r.recommendedMeals || []).includes(mt) ? ' checked' : '';
      html += `<label class="re-checkbox${checked}"><input type="checkbox" value="${mt}"${checked} onchange="this.parentElement.classList.toggle('checked')"> ${mt}</label>`;
    }
    html += '</div></div>';

    // Ингредиенты
    html += '<div class="re-section"><h3>🧂 Ингредиенты</h3><div id="re-ingredients">';
    for (let i = 0; i < (r.ingredients || []).length; i++) {
      const ing = r.ingredients[i];
      html += RecipeEditScreen._ingredientRow(i, ing, products);
    }
    html += '</div>';
    html += `<button class="re-add-btn" onclick="RecipeEditScreen._addIngredient()">+ Добавить ингредиент</button>`;
    html += '</div>';

    // Шаги
    html += '<div class="re-section"><h3>📝 Шаги</h3><div id="re-steps">';
    for (let i = 0; i < (r.steps || []).length; i++) {
      const s = r.steps[i];
      html += RecipeEditScreen._stepRow(i, s);
    }
    html += '</div>';
    html += `<button class="re-add-btn" onclick="RecipeEditScreen._addStep()">+ Добавить шаг</button>`;
    html += '</div>';

    html += '</div>'; // re-form
    html += '</div>'; // screen

    // ID для сохранения
    if (r.id) html += `<div id="re-id" style="display:none">${r.id}</div>`;

    container.innerHTML = html;
    document.getElementById('header-title').textContent = isNew ? 'Новый рецепт' : '✏️ Редактировать';
    document.getElementById('header-icon').textContent = '✏️';
  },

  _ingredientRow(i, ing, products) {
    const prodOpts = products.map(p =>
      `<option value="${p.id}" ${p.id === (ing.productId || '') ? 'selected' : ''}>${p.emoji || '🛒'} ${p.name}</option>`
    ).join('');
    return `<div class="ing-row" data-idx="${i}">
      <select class="ing-product" onchange="RecipeEditScreen._updateIng(${i})">
        <option value="">— выбери продукт —</option>
        ${prodOpts}
      </select>
      <input type="number" class="ing-qty" value="${ing.qty || 100}" min="0.1" step="1" onchange="RecipeEditScreen._updateIng(${i})" style="width:70px">
      <input type="text" class="ing-unit" value="${ing.unit || 'г'}" style="width:40px" onchange="RecipeEditScreen._updateIng(${i})">
      <span class="ing-remove" onclick="RecipeEditScreen._removeIng(${i})">✕</span>
    </div>`;
  },

  _stepRow(i, s) {
    const text = typeof s === 'string' ? s : (s.text || '');
    const timer = s.timerMin || 0;
    const tip = s.tip || '';
    return `<div class="step-row" data-idx="${i}">
      <span class="step-num">${i + 1}</span>
      <textarea class="step-text" rows="2" placeholder="Описание шага" onchange="RecipeEditScreen._updateStep(${i})">${text}</textarea>
      <input type="number" class="step-timer" value="${timer}" min="0" placeholder="мин" onchange="RecipeEditScreen._updateStep(${i})" style="width:60px">
      <input type="text" class="step-tip" value="${tip}" placeholder="💡 совет" onchange="RecipeEditScreen._updateStep(${i})">
      <span class="step-remove" onclick="RecipeEditScreen._removeStep(${i})">✕</span>
    </div>`;
  },

  _getData() {
    const data = {
      id: (document.getElementById('re-id')?.textContent || '').trim() || null,
      emoji: document.getElementById('re-emoji').value || '🍽️',
      name: document.getElementById('re-name').value.trim(),
      description: document.getElementById('re-desc').value.trim(),
      cookTimeMin: parseInt(document.getElementById('re-time').value) || 30,
      portions: parseInt(document.getElementById('re-portions').value) || 4,
      difficulty: parseInt(document.getElementById('re-difficulty').value) || 1,
      tags: document.getElementById('re-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      recommendedMeals: Array.from(document.querySelectorAll('.re-checkbox input:checked')).map(cb => cb.value),
      ingredients: [],
      steps: [],
    };

    // Ингредиенты
    document.querySelectorAll('.ing-row').forEach(row => {
      const sel = row.querySelector('.ing-product');
      const qty = parseFloat(row.querySelector('.ing-qty').value) || 0;
      const unit = row.querySelector('.ing-unit').value || 'г';
      const productId = sel.value;
      if (productId) {
        const prodName = sel.options[sel.selectedIndex]?.text?.replace(/^[^\s]+\s/, '') || 'Продукт';
        data.ingredients.push({ productId, name: prodName, qty, unit });
      }
    });

    // Шаги
    document.querySelectorAll('.step-row').forEach(row => {
      const text = row.querySelector('.step-text').value.trim();
      if (text) {
        data.steps.push({
          text,
          timerMin: parseInt(row.querySelector('.step-timer').value) || 0,
          tip: row.querySelector('.step-tip').value.trim() || '',
        });
      }
    });

    return data;
  },

  async _save() {
    const data = this._getData();
    if (!data.name) { alert('Введи название рецепта'); return; }
    try {
      await Recipes.save(data);
      if (typeof toast === 'function') toast('✅ Рецепт сохранён');
      Router.back();
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  },

  _addIngredient() {
    const container = document.getElementById('re-ingredients');
    const i = container.children.length;
    container.insertAdjacentHTML('beforeend', '<div style="color:var(--text3);font-size:12px;padding:8px">Обнови страницу чтобы выбрать продукт из списка (заглушка)</div>');
  },

  _removeIng(i) {
    const row = document.querySelector(`.ing-row[data-idx="${i}"]`);
    if (row) row.remove();
  },

  _addStep() {
    const container = document.getElementById('re-steps');
    const i = container.children.length;
    const s = { text: '', timerMin: 0, tip: '' };
    container.insertAdjacentHTML('beforeend', this._stepRow(i, s));
  },

  _removeStep(i) {
    const row = document.querySelector(`.step-row[data-idx="${i}"]`);
    if (row) row.remove();
    // Перенумеровать
    document.querySelectorAll('.step-row .step-num').forEach((el, idx) => el.textContent = idx + 1);
  },

  _updateIng(i) {},
  _updateStep(i) {},
};
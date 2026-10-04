// МенюПлан — screens/recipe-edit.js: создание/редактирование рецепта (с фото)
'use strict';

const RecipeEditScreen = {
  _r: null, _tags: [], _newImage: null, _removeImage: false, _saving: false,

  async render(container, data) {
    const r = data?.id ? await Recipes.get(data.id) : null;
    if (data?.id && !r) { container.innerHTML = '<div class="empty"><div class="empty-title">Рецепт не найден</div></div>'; return; }
    const isNew = !r;
    this._r = r || { name: '', emoji: '🍽️', description: '', portions: 4, cookTimeMin: 30, difficulty: 1, tagIds: [], recommendedMeals: ['Обед'], ingredients: [], steps: [], collectionId: null, imageId: null };
    this._newImage = null; this._removeImage = false; this._saving = false;
    const [products, collections, tags] = await Promise.all([Products.list(), Collections.list(), mealTagOptions()]);
    this._tags = tags;
    const x = this._r;

    let h = '<div class="screen recipe-edit"><div class="re-header">';
    h += '<button class="icon-btn" onclick="Router.back()">←</button>';
    h += `<h2>${isNew ? 'Новый рецепт' : 'Редактировать'}</h2>`;
    h += '<button class="icon-btn" id="re-save" onclick="RecipeEditScreen._save()">💾</button></div><div class="re-form">';

    h += '<div class="re-row"><label>Фото</label><div id="re-photo"></div>';
    h += '<input type="file" id="re-file" accept="image/*" style="display:none" onchange="RecipeEditScreen._pick(this)"></div>';
    h += `<div class="re-row"><label>Эмодзи (если нет фото)</label><input type="text" id="re-emoji" value="${esc(x.emoji)}" maxlength="4" style="font-size:24px;width:80px;text-align:center"></div>`;
    h += `<div class="re-row"><label>Название</label><input type="text" id="re-name" value="${esc(x.name)}" placeholder="Название рецепта"></div>`;
    h += `<div class="re-row"><label>Описание</label><textarea id="re-desc" rows="2" placeholder="Краткое описание">${esc(x.description)}</textarea></div>`;
    h += '<div class="re-row re-row-group">';
    h += `<div><label>Время (мин)</label><input type="number" id="re-time" value="${+x.cookTimeMin || 0}" min="0"></div>`;
    h += `<div><label>Порции</label><input type="number" id="re-portions" value="${+x.portions || 4}" min="1"></div>`;
    h += `<div><label>Сложность 1-3</label><input type="number" id="re-difficulty" value="${+x.difficulty || 1}" min="1" max="3"></div></div>`;

    h += '<div class="re-row"><label>Коллекция</label><select id="re-collection"><option value="">— без коллекции —</option>';
    for (const c of collections) h += `<option value="${esc(c.id)}"${c.id === x.collectionId ? ' selected' : ''}>${esc(c.emoji || '📚')} ${esc(c.name)}</option>`;
    h += '</select></div>';

    h += '<div class="re-row"><label>Теги</label><div class="mp-chips" id="re-tags"></div></div>';

    h += '<div class="re-row"><label>Рекомендуется для</label><div class="re-checkbox-group">';
    for (const mt of MEAL_TYPES) {
      const on = (x.recommendedMeals || []).includes(mt);
      h += `<label class="re-checkbox${on ? ' checked' : ''}"><input type="checkbox" value="${mt}"${on ? ' checked' : ''} onchange="this.parentElement.classList.toggle('checked')"> ${mt}</label>`;
    }
    h += '</div></div>';

    h += '<datalist id="re-products">' + products.map(p => `<option value="${esc(p.name)}">`).join('') + '</datalist>';
    h += '<div class="re-section"><h3>🧂 Ингредиенты</h3><div id="re-ingredients">';
    for (const i of x.ingredients || []) h += this._ingRow(i);
    h += '</div><button class="re-add-btn" onclick="RecipeEditScreen._addIng()">+ Ингредиент</button></div>';

    h += '<div class="re-section"><h3>📝 Шаги</h3><div id="re-steps">';
    (x.steps || []).forEach(s => { h += this._stepRow(s); });
    h += '</div><button class="re-add-btn" onclick="RecipeEditScreen._addStep()">+ Шаг</button></div>';
    h += '</div></div>';

    container.innerHTML = h;
    document.getElementById('header-title').textContent = isNew ? 'Новый рецепт' : 'Редактирование';
    document.getElementById('header-icon').textContent = '✏️';
    this._renderPhoto(); this._renderTags(); this._renumber();
  },

  /* ── фото ── */
  _renderPhoto() {
    const box = document.getElementById('re-photo');
    const has = this._newImage || (this._r.imageId && !this._removeImage);
    let h = '';
    if (this._newImage) h += `<img class="re-photo" src="${this._newImage}" alt="">`;
    else if (has) h += `<img class="re-photo" data-img="${esc(this._r.imageId)}" alt="">`;
    h += '<div><button class="re-add-btn" onclick="document.getElementById(\'re-file\').click()">' + (has ? '🔄 Заменить фото' : '📷 Добавить фото') + '</button>';
    if (has) h += ' <button class="re-add-btn" onclick="RecipeEditScreen._dropPhoto()">✕ Убрать</button>';
    h += '</div>';
    box.innerHTML = h; loadImages(box);
  },
  async _pick(input) {
    const f = input.files && input.files[0]; if (!f) return;
    try { this._newImage = await fileToResizedDataUrl(f); this._removeImage = false; this._renderPhoto(); }
    catch (e) { toast(e.message, 'err'); }
    input.value = '';
  },
  _dropPhoto() { this._newImage = null; this._removeImage = true; this._renderPhoto(); },

  /* ── теги (из общего каталога, хранятся только tagIds) ── */
  _renderTags() {
    const sel = new Set(this._r.tagIds || []);
    const box = document.getElementById('re-tags');
    box.innerHTML = this._tags.map(t => `<span class="mp-chip${sel.has(t.id) ? ' on' : ''}" data-id="${esc(t.id)}">${esc(t.name)}</span>`).join('')
      + '<span class="mp-chip" id="re-newtag">+ новый тег</span>';
    box.querySelectorAll('.mp-chip[data-id]').forEach(el => el.addEventListener('click', () => {
      el.classList.toggle('on');
      const ids = new Set(this._r.tagIds || []);
      el.classList.contains('on') ? ids.add(el.dataset.id) : ids.delete(el.dataset.id);
      this._r.tagIds = [...ids];
    }));
    document.getElementById('re-newtag').addEventListener('click', async () => {
      const name = (prompt('Название тега:') || '').trim(); if (!name) return;
      try {
        const t = await DB.create('tags', { name, kind: 'tag', scope: ['meals'] }, 'shared');
        this._tags = await mealTagOptions();
        this._r.tagIds = [...(this._r.tagIds || []), t.id];
        this._renderTags();
      } catch (e) { toast('Не удалось создать тег: ' + e.message, 'err'); }
    });
  },

  /* ── ингредиенты и шаги ── */
  _ingRow(i = {}) {
    return `<div class="ing-row"><input type="text" class="ing-name" list="re-products" value="${esc(i.name || '')}" placeholder="Продукт">
      <input type="number" class="ing-qty" value="${i.qty || ''}" min="0" step="any" placeholder="кол-во">
      <input type="text" class="ing-unit" value="${esc(i.unit || 'г')}" placeholder="ед.">
      <span class="ing-remove" onclick="this.parentElement.remove()">✕</span></div>`;
  },
  _stepRow(s = {}) {
    return `<div class="step-row"><span class="step-num"></span>
      <textarea class="step-text" rows="2" placeholder="Описание шага">${esc(s.text || '')}</textarea>
      <input type="number" class="step-timer" value="${s.timerMin || ''}" min="0" placeholder="мин">
      <input type="text" class="step-tip" value="${esc(s.tip || '')}" placeholder="💡 совет">
      <span class="step-remove" onclick="this.parentElement.remove();RecipeEditScreen._renumber()">✕</span></div>`;
  },
  _addIng() { document.getElementById('re-ingredients').insertAdjacentHTML('beforeend', this._ingRow()); },
  _addStep() { document.getElementById('re-steps').insertAdjacentHTML('beforeend', this._stepRow()); this._renumber(); },
  _renumber() { document.querySelectorAll('#re-steps .step-num').forEach((el, n) => { el.textContent = n + 1; }); },

  /* ── сохранение ── */
  async _collect() {
    const products = await Products.list();
    const byName = new Map(products.map(p => [(p.name || '').toLowerCase(), p.id]));
    const val = id => document.getElementById(id).value;
    const ingredients = [...document.querySelectorAll('#re-ingredients .ing-row')].map(row => {
      const name = row.querySelector('.ing-name').value.trim();
      return { name, qty: parseFloat(row.querySelector('.ing-qty').value) || 0, unit: row.querySelector('.ing-unit').value.trim(), productId: byName.get(name.toLowerCase()) || null };
    }).filter(i => i.name);
    const steps = [...document.querySelectorAll('#re-steps .step-row')].map(row => ({
      text: row.querySelector('.step-text').value.trim(), timerMin: parseInt(row.querySelector('.step-timer').value) || 0, tip: row.querySelector('.step-tip').value.trim(),
    })).filter(s => s.text);
    return {
      id: this._r.id || null, name: val('re-name').trim(), emoji: val('re-emoji') || '🍽️', description: val('re-desc').trim(),
      cookTimeMin: parseInt(val('re-time')) || 0, portions: parseInt(val('re-portions')) || 4, difficulty: parseInt(val('re-difficulty')) || 1,
      collectionId: val('re-collection') || null, tagIds: this._r.tagIds || [],
      recommendedMeals: [...document.querySelectorAll('.re-checkbox input:checked')].map(c => c.value),
      sourceUrl: this._r.sourceUrl || '', ingredients, steps,
    };
  },

  async _save() {
    if (this._saving) return;
    const data = await this._collect();
    if (!data.name) { toast('Введите название рецепта', 'err'); return; }
    this._saving = true;
    const btn = document.getElementById('re-save'); btn.disabled = true; btn.textContent = '⏳';
    try {
      const oldImage = this._r.imageId || null;
      let imageId = oldImage;
      if (this._newImage) imageId = await DB.saveImage(this._newImage, { kind: 'recipe' });
      else if (this._removeImage) imageId = null;
      const saved = await Recipes.save({ ...data, imageId });
      if (oldImage && oldImage !== imageId) await DB.deleteImage(oldImage).catch(() => {});
      toast('Рецепт сохранён');
      if (data.id) Router.back(); else Router.go('recipe.view', { id: saved.id }, { replace: true });
    } catch (e) {
      console.error(e); toast('Ошибка: ' + e.message, 'err');
      this._saving = false; btn.disabled = false; btn.textContent = '💾';
    }
  },
};

// МенюПлан — screens/product-edit.js: продукт = название, эмодзи, категория, единица
'use strict';

const ProductEditScreen = {
  _id: null,
  async render(container, data) {
    const p = data?.id ? await Products.get(data.id) : null;
    if (data?.id && !p) { container.innerHTML = '<div class="empty"><div class="empty-title">Продукт не найден</div></div>'; return; }
    this._id = p ? p.id : null;
    const x = p || { name: '', emoji: '🥕', category: '', unit: 'г' };
    const cats = ['Мясо', 'Рыба', 'Молочные', 'Овощи', 'Фрукты', 'Крупы', 'Бакалея', 'Напитки', 'Соусы', 'Прочее'];
    const units = ['г', 'кг', 'мл', 'л', 'шт', 'ч.л', 'ст.л', 'стакан'];
    let h = '<div class="screen product-edit"><div class="pe-header"><button class="icon-btn" onclick="Router.back()">←</button>';
    h += `<h2>${p ? 'Редактировать' : 'Новый продукт'}</h2><button class="icon-btn" onclick="ProductEditScreen._save()">💾</button>`;
    if (p) h += '<button class="icon-btn" onclick="ProductEditScreen._del()">🗑</button>';
    h += '</div><div class="pe-form">';
    h += `<div class="pe-row"><label>Эмодзи</label><input id="pe-emoji" value="${esc(x.emoji)}" maxlength="4" style="font-size:24px;width:80px;text-align:center"></div>`;
    h += `<div class="pe-row"><label>Название</label><input id="pe-name" value="${esc(x.name)}" placeholder="Название продукта"></div>`;
    h += '<div class="pe-row"><label>Категория</label><select id="pe-category"><option value="">—</option>' + cats.map(c => `<option${c === x.category ? ' selected' : ''}>${c}</option>`).join('') + '</select></div>';
    h += '<div class="pe-row"><label>Единица</label><select id="pe-unit">' + units.map(u => `<option${u === (x.unit || 'г') ? ' selected' : ''}>${u}</option>`).join('') + '</select></div>';
    container.innerHTML = h + '</div></div>';
    document.getElementById('header-title').textContent = p ? p.name : 'Новый продукт';
    document.getElementById('header-icon').textContent = '🥕';
  },
  async _save() {
    const name = document.getElementById('pe-name').value.trim();
    if (!name) { toast('Введите название', 'err'); return; }
    try {
      await Products.save({ id: this._id, name, emoji: document.getElementById('pe-emoji').value || '🥕', category: document.getElementById('pe-category').value, unit: document.getElementById('pe-unit').value });
      toast('Продукт сохранён'); Router.back();
    } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
  async _del() {
    if (!confirm('Удалить продукт? В рецептах останется его название.')) return;
    try { await Products.del(this._id); Router.back(); } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

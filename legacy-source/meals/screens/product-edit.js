// МенюПлан — screens/product-edit.js
'use strict';

const ProductEditScreen = {
  async render(container, product) {
    const p = product ? { ...product } : {
      name: '', emoji: '🥕', category: '', unit: 'г',
      protein: 0, fat: 0, carbs: 0, kcal: 0,
      price: 0, packageSize: 100,
      tags: [], props: [],
    };
    const isNew = !product || !product.id;

    const allCategories = ['Мясо', 'Рыба', 'Молочные', 'Овощи', 'Фрукты', 'Крупы', 'Бакалея', 'Напитки', 'Соусы', 'Прочее'];
    const allProps = [
      { id: 'gluten', label: 'Без глютена' },
      { id: 'lactose', label: 'Без лактозы' },
      { id: 'vegan', label: 'Веганский' },
      { id: 'raw', label: 'Сырой продукт' },
      { id: 'frozen', label: 'Замороженный' },
      { id: 'bio', label: 'Био/Органик' },
      { id: 'local', label: 'Местный' },
      { id: 'seasonal', label: 'Сезонный' },
    ];

    let html = '<div class="screen product-edit">';
    html += '<div class="pe-header">';
    html += `<button class="icon-btn" onclick="Router.back()">←</button>`;
    html += `<h2>${isNew ? 'Новый продукт' : 'Редактировать'}</h2>`;
    html += `<button class="icon-btn" onclick="ProductEditScreen._save()">💾</button>`;
    html += '</div>';

    html += '<div class="pe-form">';
    html += '<div class="pe-row"><label>Эмодзи</label><input type="text" id="pe-emoji" value="' + (p.emoji || '🥕') + '" maxlength="2" style="font-size:24px;width:60px;text-align:center"></div>';
    html += '<div class="pe-row"><label>Название</label><input type="text" id="pe-name" value="' + (p.name || '') + '" placeholder="Название продукта"></div>';

    html += '<div class="pe-row"><label>Категория</label><select id="pe-category">';
    for (const cat of allCategories) {
      html += `<option value="${cat}" ${(p.category || '') === cat ? 'selected' : ''}>${cat}</option>`;
    }
    html += '</select></div>';

    html += '<div class="pe-row"><label>Единица измерения</label><select id="pe-unit">';
    for (const u of ['г', 'кг', 'мл', 'л', 'шт', 'ч.л', 'ст.л', 'стакан']) {
      html += `<option value="${u}" ${(p.unit || 'г') === u ? 'selected' : ''}>${u}</option>`;
    }
    html += '</select></div>';

    html += '<div class="pe-row pe-row-group">';
    html += '<div><label>Белки (на 100г)</label><input type="number" id="pe-protein" value="' + (p.protein || 0) + '" step="0.1" min="0"></div>';
    html += '<div><label>Жиры</label><input type="number" id="pe-fat" value="' + (p.fat || 0) + '" step="0.1" min="0"></div>';
    html += '<div><label>Углеводы</label><input type="number" id="pe-carbs" value="' + (p.carbs || 0) + '" step="0.1" min="0"></div>';
    html += '</div>';

    html += '<div class="pe-row"><label>Калории (на 100г)</label><input type="number" id="pe-kcal" value="' + (p.kcal || 0) + '" step="1" min="0"></div>';

    html += '<div class="pe-row pe-row-group">';
    html += '<div><label>Цена (₽)</label><input type="number" id="pe-price" value="' + (p.price || 0) + '" step="1" min="0"></div>';
    html += '<div><label>Размер упаковки</label><input type="number" id="pe-package" value="' + (p.packageSize || 100) + '" step="1" min="1"><span class="pe-unit-label">' + ((p.unit === 'шт' || p.unit === 'л' || p.unit === 'кг') ? p.unit : 'г') + '</span></div>';
    html += '</div>';

    // Свойства
    html += '<div class="pe-section"><h3>🏷️ Свойства</h3><div class="pe-checkbox-group">';
    const currentProps = (p.props || []).map(x => typeof x === 'string' ? x : x.id || x);
    for (const prop of allProps) {
      const checked = currentProps.includes(prop.id) ? ' checked' : '';
      html += `<label class="pe-checkbox${checked}"><input type="checkbox" value="${prop.id}"${checked} onchange="this.parentElement.classList.toggle('checked')"> ${prop.label}</label>`;
    }
    html += '</div></div>';

    html += '</div>'; // pe-form
    html += '</div>'; // screen

    if (p.id) html += `<div id="pe-id" style="display:none">${p.id}</div>`;

    container.innerHTML = html;
    document.getElementById('header-title').textContent = isNew ? 'Новый продукт' : '✏️ ' + p.name;
    document.getElementById('header-icon').textContent = '🥕';
  },

  _getData() {
    return {
      id: (document.getElementById('pe-id')?.textContent || '').trim() || null,
      emoji: document.getElementById('pe-emoji').value || '🥕',
      name: document.getElementById('pe-name').value.trim(),
      category: document.getElementById('pe-category').value,
      unit: document.getElementById('pe-unit').value,
      protein: parseFloat(document.getElementById('pe-protein').value) || 0,
      fat: parseFloat(document.getElementById('pe-fat').value) || 0,
      carbs: parseFloat(document.getElementById('pe-carbs').value) || 0,
      kcal: parseFloat(document.getElementById('pe-kcal').value) || 0,
      price: parseFloat(document.getElementById('pe-price').value) || 0,
      packageSize: parseInt(document.getElementById('pe-package').value) || 100,
      props: Array.from(document.querySelectorAll('.pe-checkbox input:checked')).map(cb => cb.value),
    };
  },

  async _save() {
    const data = this._getData();
    if (!data.name) { alert('Введи название продукта'); return; }
    try {
      await Products.save(data);
      if (typeof toast === 'function') toast('✅ Продукт сохранён');
      Router.back();
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  },
};
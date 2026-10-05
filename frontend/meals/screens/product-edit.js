// МенюПлан — screens/product-edit.js: предложить новый продукт / правку (модерация, не прямая запись)
'use strict';

const ProductEditScreen = {
  _id: null,
  async render(container, data) {
    const p = data?.id ? await Products.get(data.id) : null;
    if (data?.id && !p) { container.innerHTML = '<div class="empty"><div class="empty-title">Продукт не найден</div></div>'; return; }
    this._id = p ? p.id : null;
    const x = p || { name: '', category: '', unit: 'г' };
    const cats = ['Мясо', 'Рыба', 'Молочные', 'Овощи', 'Фрукты', 'Крупы', 'Бакалея', 'Напитки', 'Соусы', 'Прочее'];
    const units = ['г', 'кг', 'мл', 'л', 'шт', 'ч.л', 'ст.л', 'стакан'];
    let h = '<div class="screen product-edit"><div class="pe-header"><button class="icon-btn" onclick="Router.back()">←</button>';
    h += `<h2>${p ? 'Предложить правку' : 'Предложить продукт'}</h2><button class="icon-btn" onclick="ProductEditScreen._submit()">✅</button>`;
    h += '</div><div class="pe-form">';
    h += '<div class="pe-note">Продукт появится в каталоге после одобрения админом. Другие пользователи видят вашу заявку в «Предложке» и могут за неё проголосовать.</div>';
    h += `<div class="pe-row"><label>Название</label><input id="pe-name" value="${esc(x.name)}" placeholder="Название продукта"></div>`;
    h += '<div class="pe-row"><label>Категория</label><select id="pe-category"><option value="">—</option>' + cats.map(c => `<option${c === x.category ? ' selected' : ''}>${c}</option>`).join('') + '</select></div>';
    h += '<div class="pe-row"><label>Единица</label><select id="pe-unit">' + units.map(u => `<option${u === (x.unit || 'г') ? ' selected' : ''}>${u}</option>`).join('') + '</select></div>';
    container.innerHTML = h + '</div></div>';
    LifeShell.update({ title: p ? 'Предложить правку' : 'Предложить продукт' });
  },
  async _submit() {
    const name = document.getElementById('pe-name').value.trim();
    if (!name) { toast('Введите название', 'err'); return; }
    const payload = { name, category: document.getElementById('pe-category').value, unit: document.getElementById('pe-unit').value };
    try {
      if (this._id) await Products.suggestEdit(this._id, payload);
      else await Products.suggestNew(payload);
      toast('Заявка отправлена на модерацию');
      Router.back();
    } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

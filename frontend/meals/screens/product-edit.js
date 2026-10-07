// Кухня — screens/product-edit.js: предложить новый продукт / правку (модерация, не прямая запись)
'use strict';

const ProductEditScreen = {
  _id: null, _raw: null,
  async render(container, data) {
    const raw = data?.id ? await Products.get(data.id) : null;
    if (data?.id && !raw) { container.innerHTML = '<div class="empty"><div class="empty-title">Продукт не найден</div></div>'; return; }
    this._id = raw ? raw.id : null; this._raw = raw;
    const x = raw ? normProduct(raw) : { name: '', emoji: '🥕', category: '', unit: 'г', protein: 0, fat: 0, carbs: 0, kcal: 0, price: 0, packageSize: 100, props: [] };
    const units = ['г', 'кг', 'мл', 'л', 'шт', 'ч.л', 'ст.л', 'стакан'];
    const num = (id, label, v, step) => `<div><label>${label}</label><input type="number" id="${id}" value="${v || ''}" step="${step}" min="0" placeholder="0"></div>`;
    let h = '<div class="screen product-edit"><div class="pe-form">';
    h += '<div class="pe-note">Изменения попадут в общий каталог после одобрения админом. Заявку видно в «Предложке», за неё можно проголосовать.</div>';
    h += `<div class="pe-row pe-row-group"><div style="flex:0 0 76px"><label>Эмодзи</label><input id="pe-emoji" maxlength="4" value="${esc(x.emoji)}" style="text-align:center;font-size:22px"></div>
      <div><label>Название</label><input id="pe-name" value="${esc(x.name)}" placeholder="Название продукта"></div></div>`;
    h += '<div class="pe-row pe-row-group"><div><label>Категория</label><select id="pe-category"><option value="">—</option>'
      + PRODUCT_CATS.map(c => `<option${c === x.category ? ' selected' : ''}>${c}</option>`).join('') + '</select></div>';
    h += '<div><label>Единица</label><select id="pe-unit">' + units.map(u => `<option${u === x.unit ? ' selected' : ''}>${u}</option>`).join('') + '</select></div></div>';
    h += '<div class="pe-sec">КБЖУ на 100 г / мл</div><div class="pe-row pe-row-group">'
      + num('pe-protein', 'Белки', x.protein, 0.1) + num('pe-fat', 'Жиры', x.fat, 0.1) + num('pe-carbs', 'Углеводы', x.carbs, 0.1) + num('pe-kcal', 'Ккал', x.kcal, 1) + '</div>';
    h += '<div class="pe-sec">Цена</div><div class="pe-row pe-row-group">' + num('pe-price', 'Цена упаковки, ₽', x.price, 1) + num('pe-package', 'Размер упаковки', x.packageSize, 1) + '</div>';
    h += '<div class="pe-sec">Свойства</div><div class="re-checkbox-group">'
      + PRODUCT_PROPS.map(p => { const on = x.props.includes(p.id); return `<label class="re-checkbox${on ? ' checked' : ''}"><input type="checkbox" value="${p.id}"${on ? ' checked' : ''} onchange="this.parentElement.classList.toggle('checked')"> ${p.label}</label>`; }).join('') + '</div>';
    h += '<button class="kt-main" id="pe-send" onclick="ProductEditScreen._submit()">Отправить на модерацию</button>';
    container.innerHTML = h + '</div></div>';
    LifeShell.update({ title: raw ? 'Предложить правку' : 'Предложить продукт' });
  },

  async _submit() {
    const v = id => document.getElementById(id).value;
    const name = v('pe-name').trim();
    if (!name) { toast('Введите название', 'err'); return; }
    let protein = +v('pe-protein') || 0, fat = +v('pe-fat') || 0, carbs = +v('pe-carbs') || 0, kcal = +v('pe-kcal') || 0;
    if (!kcal && (protein || fat || carbs)) kcal = Math.round(protein * 4 + carbs * 4 + fat * 9);   // ккал не указаны — считаем по БЖУ
    const data = {
      ...((this._raw && this._raw.data) || {}),
      emoji: v('pe-emoji').trim() || '🥕', protein, fat, carbs, kcal,
      price: +v('pe-price') || 0, packageSize: +v('pe-package') || 100,
      props: [...document.querySelectorAll('.re-checkbox input:checked')].map(c => c.value),
    };
    const payload = { name, category: v('pe-category'), unit: v('pe-unit'), data };
    const btn = document.getElementById('pe-send'); btn.disabled = true;
    try {
      if (this._id) await Products.suggestEdit(this._id, payload);
      else await Products.suggestNew(payload);
      toast('Заявка отправлена на модерацию');
      Router.back();
    } catch (e) { btn.disabled = false; toast('Ошибка: ' + e.message, 'err'); }
  },
};

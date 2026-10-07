// МенюПлан — screens/suggestions.js: предложка каталога продуктов (голосование)
'use strict';

const SuggestionsScreen = {
  _all: [],
  async render(container) {
    container.innerHTML = '<div class="screen"><div class="screen-title">Предложка</div><div id="sg-list">Загрузка…</div></div>';
    LifeShell.update({ title: 'Предложка' });
    try {
      this._all = await Suggestions.list('pending');
    } catch (e) {
      document.getElementById('sg-list').innerHTML = `<div class="empty"><div class="empty-title">Ошибка: ${esc(e.message)}</div></div>`;
      return;
    }
    this._draw();
  },
  _draw() {
    const el = document.getElementById('sg-list');
    if (!this._all.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🗳</div><div class="empty-title">Пока нет заявок на модерацию</div></div>';
      return;
    }
    el.innerHTML = this._all.map(s => {
      const label = s.type === 'new_product' ? 'Новый продукт' : 'Правка продукта';
      return `<div class="product-row">
        <div class="product-body">
          <div class="product-name">${esc(s.payload?.name || '')}</div>
          <div class="product-meta">${label}${s.payload?.category ? ' · ' + esc(s.payload.category) : ''}${s.payload?.unit ? ' · ' + esc(s.payload.unit) : ''}${s.payload?.data?.kcal ? ' · ' + (+s.payload.data.kcal) + ' ккал' : ''}${s.payload?.data?.price ? ' · ' + (+s.payload.data.price) + ' ₽' : ''}</div>
        </div>
        <button class="icon-btn${s.myVote ? ' active' : ''}" onclick="SuggestionsScreen._toggleVote('${esc(s.id)}', ${s.myVote})">
          👍 ${s.voteCount || 0}
        </button>
      </div>`;
    }).join('');
  },
  async _toggleVote(id, currentlyVoted) {
    try {
      if (currentlyVoted) await Suggestions.unvote(id);
      else await Suggestions.vote(id);
      this._all = await Suggestions.list('pending');
      this._draw();
    } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

// МенюПлан — screens/menu.js (упрощённая версия без зависаний)
'use strict';

const MenuScreen = {
  _weekKey: null,

  async render(container) {
    try {
      this._weekKey = WeekDB.currentKey();
      const week = await WeekDB.get(this._weekKey);
      const mts = await Settings.get('mealTypes', DEFAULT_MEAL_TYPES);
      const allRecipes = await Recipes.list();

      let html = '<div class="screen">';

      // Неделя — простой select вместо календаря
      html += '<div class="week-nav">';
      html += '<select id="week-select">';
      for (let i = -4; i <= 4; i++) {
        const key = WeekDB.shiftKey(this._weekKey, i);
        const selected = i === 0 ? ' selected' : '';
        html += `<option value="${key}"${selected}>${WeekDB.label(key)}</option>`;
      }
      html += '</select>';
      html += '</div>';

      // Кнопки
      html += '<div style="display:flex;gap:8px;padding:8px 16px 4px;flex-wrap:wrap">';
      html += '<button class="menu-action-btn" onclick="window.MenuScreen._saveTemplate()">💾 Шаблон</button>';
      html += '<button class="menu-action-btn" onclick="window.MenuScreen._buildShopping()">🛒 Список</button>';
      html += '</div>';

      // Сетка
      html += '<div class="week-grid">';
      for (const day of DAYS) {
        html += '<div class="day-col">';
        html += `<div class="day-header">${day}</div>`;
        for (const mt of mts) {
          const recipeIds = (week.days && week.days[day] && week.days[day][mt]) || [];
          html += `<div class="meal-slot">`;
          html += `<div class="meal-type-label">${mt}</div>`;
          for (let i = 0; i < recipeIds.length; i++) {
            const r = allRecipes.find(x => x.id === recipeIds[i]);
            if (r) {
              html += `<span class="recipe-chip" onclick="window.MenuScreen._viewRecipe('${r.id}')">${r.emoji || '🍽️'} ${r.name} <span class="chip-remove" onclick="event.stopPropagation();window.MenuScreen._removeRecipe('${day}','${mt}',${i})">✕</span></span>`;
            }
          }
          html += `<div class="add-meal-btn" onclick="window.MenuScreen._addDialog('${day}','${mt}')">+</div>`;
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';

      container.innerHTML = html;
      LifeShell.update({ title: 'Меню' });
      
      // Навешиваем обработчик смены недели
      document.getElementById('week-select').onchange = function() {
        window.MenuScreen._weekKey = this.value;
        window.MenuScreen.render(document.getElementById('app-content'));
      };
    } catch (e) {
      console.error('[Menu] render error:', e);
      container.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Ошибка загрузки меню</div><div class="empty-desc">Попробуйте обновить страницу</div></div>';
    }
  },

  _viewRecipe(id) {
    Router.go('recipe.view', id);
  },

  async _removeRecipe(day, mt, idx) {
    try {
      await WeekDB.removeRecipe(this._weekKey, day, mt, idx);
      this.render(document.getElementById('app-content'));
    } catch (e) {
      console.error('[Menu] remove error:', e);
    }
  },

  async _addDialog(day, mt) {
    try {
      const allRecipes = await Recipes.list();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

      let html = '<div class="modal" style="max-width:400px">';
      html += '<div class="modal-header"><span>➕ Добавить — ' + day + ', ' + mt + '</span><button class="icon-btn" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
      html += '<div class="modal-body" style="max-height:50vh;overflow-y:auto">';
      html += '<input class="search-input" placeholder="Поиск рецепта..." id="add-search" autofocus>';
      html += '<div id="add-list">';
      if (allRecipes.length === 0) {
        html += '<div style="padding:16px;color:var(--text3)">Нет рецептов</div>';
      } else {
        for (const r of allRecipes) {
          html += `<div class="add-recipe-row" data-rid="${r.id}">${r.emoji || '🍽️'} ${r.name}</div>`;
        }
      }
      html += '</div></div></div>';

      overlay.innerHTML = html;
      document.getElementById('modal-root').appendChild(overlay);
      
      // Поиск
      const searchInput = document.getElementById('add-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          const q = this.value.toLowerCase();
          document.querySelectorAll('#add-list .add-recipe-row').forEach(function(el) {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        });
      }
      
      // Клик по рецепту — добавляем
      document.getElementById('add-list').addEventListener('click', function(e) {
        const row = e.target.closest('.add-recipe-row');
        if (row) {
          overlay.remove();
          window.MenuScreen._pickRecipe(row.dataset.rid, day, mt);
        }
      });
    } catch (e) {
      console.error('[Menu] add dialog error:', e);
    }
  },

  async _pickRecipe(id, day, mt) {
    try {
      await WeekDB.addRecipe(this._weekKey, day, mt, id);
      this.render(document.getElementById('app-content'));
    } catch (e) {
      console.error('[Menu] pick error:', e);
    }
  },

  async _saveTemplate() {
    try {
      const week = await WeekDB.get(this._weekKey);
      const name = prompt('Название шаблона:', 'Неделя ' + WeekDB.label(this._weekKey));
      if (!name) return;
      await Templates.save({ name, days: week.days || {} });
    } catch (e) {
      console.error('[Menu] template error:', e);
    }
  },

  async _buildShopping() {
    try {
      const c = document.getElementById('app-content');
      c.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
      await ShoppingDB.build(this._weekKey);
      Router.go('shopping');
    } catch (e) {
      console.error('[Menu] shopping error:', e);
    }
  },
};

// Глобальная привязка для inline-обработчиков
window.MenuScreen = MenuScreen;
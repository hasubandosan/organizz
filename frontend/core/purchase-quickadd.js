/**
 * LifeOS — core/purchase-quickadd.js
 * Лёгкий виджет "быстро добавить покупку" для встраивания в любой модуль
 * (косплеи, проекты и т.д.), без перехода в модуль Покупки.
 *
 * Подключать ПОСЛЕ core/db.js.
 *
 * Использование:
 *   PurchaseQuickAdd.open({
 *     sourceType: 'cosplay',            // manual | task | project | cosplay | wishlist | meal_plan
 *     projectId:  someProjectId,        // необязательно
 *     cosplayId:  someCosplayId,        // необязательно
 *     category:   'Косплей',            // необязательно, предзаполнить категорию
 *     onSaved:    (purchase, variant) => { ... }  // покупка и её первый вариант (или null)
 *   });
 *
 * Форма: только название покупки обязательно. Остальное (фото, бренд, цена,
 * комментарий) — опционально и уходит в один вариант покупки.
 * Кнопки: «Отмена», «+ Ещё вариант» (сохраняет текущий черновик варианта
 * и открывает пустой следующий, покупка при этом ещё не создаётся),
 * «Добавить» (создаёт покупку + все накопленные варианты разом).
 */
'use strict';

const PurchaseQuickAdd = (() => {

  let injected = false;
  let draftVariants = [];   // варианты, подтверждённые кнопкой "+ Ещё вариант"
  let opts = {};
  let pqaImgData = null;    // pending photo (base64) for the variant currently being drafted

  function injectDom() {
    if (injected) return;
    injected = true;
    const wrap = document.createElement('div');
    wrap.id = 'pqaRoot';
    wrap.innerHTML = `
      <style>
        #pqaOverlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.75);
          z-index: 9990; display: none; align-items: flex-end; justify-content: center;
          backdrop-filter: blur(6px);
        }
        #pqaOverlay.on { display: flex; }
        #pqaSheet {
          width: 100%; max-width: 480px; background: var(--bg2, #111118);
          border: 1px solid var(--border2, #2e2e3a); border-top: 1px solid var(--border2, #2e2e3a);
          border-radius: 16px 16px 0 0; padding: 18px; max-height: 90dvh; overflow-y: auto;
          font-family: var(--f, sans-serif); color: var(--text, #e8e8f0);
        }
        @media (min-width: 640px) {
          #pqaOverlay { align-items: center; }
          #pqaSheet { border-radius: 14px; }
        }
        #pqaSheet h3 { margin: 0 0 14px; font-size: 16px; font-weight: 800; }
        .pqa-fg { margin-bottom: 10px; }
        .pqa-fl { display: block; font-size: 10px; font-weight: 700; color: var(--text3, #55556a); text-transform: uppercase; letter-spacing: .7px; margin-bottom: 4px; }
        .pqa-fi {
          width: 100%; box-sizing: border-box; padding: 9px 11px; background: var(--bg3, #18181f);
          border: 1px solid var(--border2, #2e2e3a); border-radius: 8px; font-size: 14px; color: inherit;
        }
        .pqa-fi:focus { outline: none; border-color: var(--accent, #5b6ef5); }
        .pqa-row { display: flex; gap: 8px; }
        .pqa-chips { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
        .pqa-chip {
          display: flex; justify-content: space-between; align-items: center;
          background: var(--bg3, #18181f); border: 1px solid var(--border2, #2e2e3a);
          border-radius: 8px; padding: 7px 10px; font-size: 12px;
        }
        .pqa-chip button { background: none; border: none; color: var(--text3, #55556a); font-size: 14px; cursor: pointer; }
        .pqa-actions { display: flex; gap: 8px; margin-top: 14px; }
        .pqa-btn {
          flex: 1; padding: 11px; border-radius: 8px; font-size: 13px; font-weight: 700;
          border: 1px solid var(--border2, #2e2e3a); background: var(--bg3, #18181f); color: inherit; cursor: pointer;
        }
        .pqa-btn.primary { background: var(--accent, #5b6ef5); border-color: var(--accent, #5b6ef5); color: #fff; }
        .pqa-btn.ghost   { color: var(--text3, #55556a); }
        .pqa-photo-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
        .pqa-thumb {
          width: 52px; height: 52px; border-radius: 8px; flex-shrink: 0;
          background: var(--bg3, #18181f); border: 1px dashed var(--border2, #2e2e3a);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          font-size: 16px; color: var(--text3, #55556a); cursor: pointer; position: relative;
        }
        .pqa-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .pqa-thumb input[type=file] { display: none; }
        .pqa-chip-thumb { width: 26px; height: 26px; border-radius: 6px; object-fit: cover; margin-right: 7px; flex-shrink: 0; }
        .pqa-chip-left { display: flex; align-items: center; min-width: 0; }
      </style>
      <div id="pqaOverlay">
        <div id="pqaSheet">
          <h3>Быстро добавить покупку</h3>
          <div class="pqa-fg">
            <label class="pqa-fl">Название *</label>
            <input id="pqaName" class="pqa-fi" type="text" placeholder="Что купить?"/>
          </div>
          <div class="pqa-photo-row">
            <div class="pqa-thumb" id="pqaThumb" title="Фото варианта">
              <span id="pqaThumbIcon">📷</span>
              <img id="pqaThumbImg" style="display:none"/>
              <input type="file" id="pqaImgInput" accept="image/*"/>
            </div>
            <div style="flex:1">
              <label class="pqa-fl">Бренд / точное название (необязательно)</label>
              <input id="pqaBrand" class="pqa-fi" type="text" placeholder="Например, конкретная модель"/>
            </div>
          </div>
          <div class="pqa-row">
            <div class="pqa-fg" style="flex:1">
              <label class="pqa-fl">Цена</label>
              <input id="pqaPrice" class="pqa-fi" type="number" placeholder="₽"/>
            </div>
          </div>
          <div class="pqa-fg">
            <label class="pqa-fl">Комментарий</label>
            <input id="pqaNotes" class="pqa-fi" type="text" placeholder="Необязательно"/>
          </div>
          <div class="pqa-chips" id="pqaChips"></div>
          <div class="pqa-actions">
            <button class="pqa-btn ghost" id="pqaCancel">Отмена</button>
            <button class="pqa-btn" id="pqaAddVariant">+ Ещё вариант</button>
            <button class="pqa-btn primary" id="pqaSave">Добавить</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('pqaOverlay').addEventListener('click', e => {
      if (e.target.id === 'pqaOverlay') close();
    });
    document.getElementById('pqaCancel').addEventListener('click', close);
    document.getElementById('pqaAddVariant').addEventListener('click', stashCurrentDraftVariant);
    document.getElementById('pqaSave').addEventListener('click', save);
    document.getElementById('pqaThumb').addEventListener('click', () => document.getElementById('pqaImgInput').click());
    document.getElementById('pqaImgInput').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        pqaImgData = ev.target.result;
        document.getElementById('pqaThumbImg').src = pqaImgData;
        document.getElementById('pqaThumbImg').style.display = 'block';
        document.getElementById('pqaThumbIcon').style.display = 'none';
      };
      r.readAsDataURL(f);
    });
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function readDraftVariant() {
    const title = document.getElementById('pqaBrand').value.trim();
    const price = document.getElementById('pqaPrice').value;
    const notes = document.getElementById('pqaNotes').value.trim();
    if (!title && !price && !notes && !pqaImgData) return null;
    return {
      title: title || null,
      price: price !== '' ? Number(price) : null,
      notes: notes || null,
      _imgData: pqaImgData || null,
    };
  }

  function clearDraftFields() {
    document.getElementById('pqaBrand').value = '';
    document.getElementById('pqaPrice').value = '';
    document.getElementById('pqaNotes').value = '';
    pqaImgData = null;
    document.getElementById('pqaThumbImg').style.display = 'none';
    document.getElementById('pqaThumbIcon').style.display = '';
    document.getElementById('pqaImgInput').value = '';
  }

  function renderChips() {
    const el = document.getElementById('pqaChips');
    el.innerHTML = draftVariants.map((v, i) => `
      <div class="pqa-chip">
        <span class="pqa-chip-left">
          ${v._imgData ? `<img class="pqa-chip-thumb" src="${v._imgData}"/>` : ''}
          <span>${esc(v.title || 'Вариант')}${v.price != null ? ' — ' + Number(v.price).toLocaleString('ru-RU') + ' ₽' : ''}</span>
        </span>
        <button data-i="${i}">✕</button>
      </div>`).join('');
    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => { draftVariants.splice(+btn.dataset.i, 1); renderChips(); });
    });
  }

  function stashCurrentDraftVariant() {
    const v = readDraftVariant();
    if (v) draftVariants.push(v);
    clearDraftFields();
    renderChips();
  }

  async function save() {
    const name = document.getElementById('pqaName').value.trim();
    if (!name) { alert('Введи название покупки'); return; }

    // Fold whatever is currently typed into the variant list too.
    const trailing = readDraftVariant();
    if (trailing) draftVariants.push(trailing);

    const purchase = await DB.create('purchases', {
      name,
      status: 'wish',
      priority: 0,
      sourceType: opts.sourceType || 'manual',
      category: opts.category || null,
      projectId: opts.projectId || null,
      cosplayId: opts.cosplayId || null,
    });

    let firstVariant = null;
    for (let i = 0; i < draftVariants.length; i++) {
      const v = draftVariants[i];
      let imageIds = [];
      if (v._imgData) {
        const imgId = await DB.saveImage(v._imgData, { name: 'variant-photo' });
        imageIds = [imgId];
      }
      const rec = await DB.create('purchase_variants', {
        purchaseId: purchase.id,
        title: v.title || null,
        price: v.price ?? null,
        shopId: null,
        url: null,
        notes: v.notes || null,
        isPrimary: i === 0,
        imageIds,
      });
      if (i === 0) firstVariant = rec;
    }

    close();
    if (typeof opts.onSaved === 'function') opts.onSaved(purchase, firstVariant);
  }

  function close() {
    document.getElementById('pqaOverlay').classList.remove('on');
    document.body.style.overflow = '';
  }

  return {
    open(o = {}) {
      injectDom();
      opts = o;
      draftVariants = [];
      document.getElementById('pqaName').value = '';
      clearDraftFields();
      renderChips();
      document.getElementById('pqaOverlay').classList.add('on');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('pqaName').focus(), 50);
    },
  };
})();

window.PurchaseQuickAdd = PurchaseQuickAdd;

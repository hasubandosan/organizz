/**
 * LifeOS — core/shopping-bridge.js
 * Мост: МенюПлан → LifeOS purchases
 *
 * Подключать ПОСЛЕ core/db.js, ДО menuplan/db.js
 * Работает с любым Storage Driver (JSON, IDB, Supabase).
 */
'use strict';

const ShoppingBridge = {

  /**
   * Синхронизировать список покупок недели из МенюПлана в LifeOS purchases.
   * Вызывается автоматически из ShoppingDB.build() в menuplan/db.js.
   */
  async syncToLifeOS(weekKey, items) {
    if (!window.DB) return;
    if (!Array.isArray(items) || !items.length) return;
    try {
      // Удаляем старые позиции этой недели (вместе с их вариантами)
      const all = await DB.getAll('purchases');
      const old = all.filter(i => i.sourceType === 'meal_plan' && i.weekKey === weekKey);
      const allVariants = await DB.getAll('purchase_variants');
      for (const e of old) {
        for (const v of allVariants.filter(v => v.purchaseId === e.id)) await DB.delete('purchase_variants', v.id);
        await DB.delete('purchases', e.id);
      }

      // Записываем новые (покупка + один основной вариант с ценой)
      for (const item of items) {
        const purchase = await DB.create('purchases', {
          name:       item.name || 'Продукт',
          category:   item.category || 'Питание',
          status:     item.checked ? 'in_stock' : 'wish',
          priority:   0,
          sourceType: 'meal_plan',
          sourceId:   weekKey,
          weekKey,
          notes:      `${item.qty ?? ''} ${item.unit ?? ''}`.trim() || null,
          tags:       [],
          metadata: {
            productId:    item.productId,
            qty:          item.qty,
            unit:         item.unit,
            fromMenuPlan: true,
          },
        });
        await DB.create('purchase_variants', {
          purchaseId: purchase.id,
          title:      null,
          price:      item.cost || null,
          shopId:     null,
          url:        null,
          notes:      `${item.qty ?? ''} ${item.unit ?? ''}`.trim() || null,
          isPrimary:  true,
        });
      }
      console.info(`[ShoppingBridge] ✓ ${items.length} позиций → purchases (${weekKey})`);
    } catch (err) {
      console.warn('[ShoppingBridge] syncToLifeOS error:', err);
    }
  },

  /**
   * Отразить toggle (checked/unchecked) в LifeOS при тапе в МенюПлане.
   */
  async toggleInLifeOS(weekKey, productId, checked) {
    if (!window.DB) return;
    try {
      const all   = await DB.getAll('purchases');
      const match = all.find(
        i => i.sourceType === 'meal_plan' &&
             i.weekKey === weekKey &&
             i.metadata?.productId === productId
      );
      if (match) {
        await DB.update('purchases', match.id, {
          status: checked ? 'in_stock' : 'wish',
        });
      }
    } catch (err) {
      console.warn('[ShoppingBridge] toggleInLifeOS error:', err);
    }
  },

  /** Очистить позиции недели (перед регенерацией). */
  async clearWeek(weekKey) {
    if (!window.DB) return;
    try {
      const all = await DB.getAll('purchases');
      const old = all.filter(i => i.sourceType === 'meal_plan' && i.weekKey === weekKey);
      const allVariants = await DB.getAll('purchase_variants');
      for (const e of old) {
        for (const v of allVariants.filter(v => v.purchaseId === e.id)) await DB.delete('purchase_variants', v.id);
        await DB.delete('purchases', e.id);
      }
    } catch (err) {
      console.warn('[ShoppingBridge] clearWeek error:', err);
    }
  },
};

window.ShoppingBridge = ShoppingBridge;

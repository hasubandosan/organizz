/**
 * Массовый импорт продуктов в catalog.products.
 * Используется один раз для сидирования базы (или позже для добора из
 * внешних источников вроде Open Food Facts — формат JSON тот же).
 *
 * Запуск:
 *   cd backend
 *   npx tsx scripts/import-catalog-products.ts scripts/seed-products.json
 *
 * Принимает: массив [{name, category?, unit?, data?}] ИЛИ бэкап МенюПлана (легаси, «Экспорт»):
 * {products:[{name, emoji, category, unit, protein, fat, carbs, kcal, price, package_size, props}]} —
 * КБЖУ, цена, упаковка и свойства переносятся в data.
 * Идемпотентно: продукт с тем же name не дублируется; если он уже есть, но data пустая —
 * данные дописываются (существующие данные не перезаписываются).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { products } from '../src/db/schema/catalog.js';

type SeedProduct = { name: string; category?: string; unit?: string; data?: Record<string, unknown> };

// Строка легаси-бэкапа (плоские поля) -> формат каталога (данные в data)
function fromLegacy(p: any): SeedProduct {
  return {
    name: String(p.name || '').trim(),
    category: p.category || undefined,
    unit: p.unit || undefined,
    data: {
      emoji: p.emoji || undefined,
      protein: +p.protein || 0, fat: +p.fat || 0, carbs: +p.carbs || 0, kcal: +p.kcal || 0,
      price: +p.price || 0, packageSize: +(p.package_size ?? p.packageSize) || 100,
      props: Array.isArray(p.props) ? p.props.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean) : [],
    },
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Использование: npx tsx scripts/import-catalog-products.ts <путь-к-json>');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  const items: SeedProduct[] = (Array.isArray(raw) ? raw : (raw.products || []).map(fromLegacy)).filter((i: SeedProduct) => i.name);
  let inserted = 0;
  let skipped = 0;
  let filled = 0;

  for (const item of items) {
    const existing = await db.select({ id: products.id, data: products.data }).from(products).where(eq(products.name, item.name)).limit(1);
    if (existing[0]) {
      if (item.data && Object.keys((existing[0].data as object) || {}).length === 0) {
        await db.update(products).set({ data: item.data, updatedAt: new Date() }).where(eq(products.id, existing[0].id));
        filled++;
      } else skipped++;
      continue;
    }
    await db.insert(products).values({ name: item.name, category: item.category, unit: item.unit, data: item.data ?? {} });
    inserted++;
  }

  console.log(`Готово: добавлено ${inserted}, дополнено данными ${filled}, пропущено (уже есть) ${skipped}, всего в файле ${items.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Ошибка импорта:', e);
  process.exit(1);
});

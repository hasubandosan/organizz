/**
 * Массовый импорт продуктов в catalog.products.
 * Используется один раз для сидирования базы (или позже для добора из
 * внешних источников вроде Open Food Facts — формат JSON тот же).
 *
 * Запуск:
 *   cd backend
 *   npx tsx scripts/import-catalog-products.ts scripts/seed-products.json
 *
 * Идемпотентно: существующий продукт с тем же name пропускается, не дублируется.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { products } from '../src/db/schema/catalog.js';

type SeedProduct = { name: string; category?: string; unit?: string };

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Использование: npx tsx scripts/import-catalog-products.ts <путь-к-json>');
    process.exit(1);
  }

  const items: SeedProduct[] = JSON.parse(readFileSync(file, 'utf-8'));
  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await db.select({ id: products.id }).from(products).where(eq(products.name, item.name)).limit(1);
    if (existing[0]) {
      skipped++;
      continue;
    }
    await db.insert(products).values({ name: item.name, category: item.category, unit: item.unit });
    inserted++;
  }

  console.log(`Готово: добавлено ${inserted}, пропущено (уже есть) ${skipped}, всего в файле ${items.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Ошибка импорта:', e);
  process.exit(1);
});

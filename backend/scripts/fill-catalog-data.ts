/**
 * Заполнение данных продуктов каталога через Gemini: КБЖУ на 100 г/мл, размер и цена упаковки,
 * вес штуки (для шт), эмодзи, свойства. Значения ПРИБЛИЗИТЕЛЬНЫЕ (ставится data.source = 'ai'),
 * цены — средняя оценка в рублях; уточняются через заявки в «Энциклопедии».
 *
 * Запуск (нужен backend/.env с DATABASE_URL и GEMINI_API_KEY):
 *   cd backend
 *   npx tsx scripts/fill-catalog-data.ts --dry     # показать, что будет записано, ничего не менять
 *   npx tsx scripts/fill-catalog-data.ts           # заполнить продукты без данных
 *   npx tsx scripts/fill-catalog-data.ts --force   # перезаписать и тем, у кого данные уже есть (кроме source != ai)
 *
 * Безопасно перезапускать: уже заполненные продукты пропускаются; ручные данные (source не 'ai') не трогаются.
 */
import 'dotenv/config';

const BATCH = 15;
const PROPS = ['gluten', 'lactose', 'vegan', 'raw'];
const MODELS = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']
  .filter((m, i, a): m is string => !!m && a.indexOf(m) === i);

const PROMPT = `Ты нутрициолог-справочник. Тебе дают нумерованный список продуктов (название, единица учёта: g|ml|pcs|...).
Для КАЖДОГО верни объект JSON, всего массив той же длины:
{"n": <номер из списка>, "emoji": "<один эмодзи>", "protein": <г белка на 100 г/мл>, "fat": <г жира на 100 г/мл>, "carbs": <г углеводов на 100 г/мл>,
 "kcal": <ккал на 100 г/мл>, "packageSize": <типовая розничная упаковка в единице учёта: для g граммы, для ml миллилитры, для pcs штуки в упаковке>,
 "price": <средняя цена такой упаковки в рублях в России, целое число>, "unitWeight": <только для pcs: вес одной штуки в граммах, иначе 0>,
 "props": [<подмножество ${JSON.stringify(PROPS)}: gluten = не содержит глютен, lactose = не содержит лактозу, vegan = без продуктов животного происхождения, raw = сырой/необработанный>]}
Значения — для продукта в том виде, в каком он указан в названии (сырой, если не сказано иное). Типичные справочные значения, без выдумок.
Ответ — ТОЛЬКО JSON-массив.`;

type Item = { n: number; emoji?: string; protein: number; fat: number; carbs: number; kcal: number; packageSize: number; price: number; unitWeight?: number; props?: string[] };

const num = (v: unknown, max: number) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : 0; };
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Проверка и починка ответа ИИ; null — ответ непригоден */
export function sanitize(it: Item, unit: string): Record<string, unknown> | null {
  let protein = num(it.protein, 100), fat = num(it.fat, 100), carbs = num(it.carbs, 100), kcal = num(it.kcal, 900);
  if (protein + fat + carbs > 101) return null;
  const calc = protein * 4 + carbs * 4 + fat * 9;
  if (!kcal || Math.abs(kcal - calc) > Math.max(25, calc * 0.25)) kcal = Math.round(calc);   // ккал не сходятся с БЖУ — считаем сами
  const pieces = unit === 'pcs' || unit === 'шт';
  const out: Record<string, unknown> = {
    emoji: typeof it.emoji === 'string' && it.emoji.trim() ? [...it.emoji.trim()].slice(0, 2).join('') : '🥕',
    protein: round1(protein), fat: round1(fat), carbs: round1(carbs), kcal: Math.round(kcal),
    packageSize: Math.round(num(it.packageSize, 100000)) || (pieces ? 1 : 100),
    price: Math.round(num(it.price, 20000)),
    props: (Array.isArray(it.props) ? it.props : []).filter((p) => PROPS.includes(p)),
    source: 'ai',
  };
  if (pieces) out.unitWeight = Math.round(num(it.unitWeight, 5000)) || 50;
  return out;
}

async function ask(list: { n: number; name: string; unit: string }[]): Promise<Item[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Нет GEMINI_API_KEY в backend/.env');
  const text = list.map((p) => `${p.n}. ${p.name} (${p.unit})`).join('\n');
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const model of MODELS) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      }).catch(() => null);
      if (!res || res.status === 404 || res.status === 429 || res.status >= 500) continue;   // другая модель / подождать
      if (!res.ok) throw new Error(`Gemini ${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const data: any = await res.json();
      const out = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
      const m = out.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim().match(/\[[\s\S]*\]/);
      try { if (m) return JSON.parse(m[0]); } catch { /* пробуем дальше */ }
    }
    await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));   // лимиты бесплатного ключа — ждём
  }
  throw new Error('ИИ не ответил (лимит/перегрузка). Запустите позже: уже записанное сохранится');
}

async function main() {
  const dry = process.argv.includes('--dry'), force = process.argv.includes('--force');
  const { db } = await import('../src/db/client.js');
  const { products } = await import('../src/db/schema/catalog.js');
  const { eq } = await import('drizzle-orm');

  const rows = await db.select().from(products).orderBy(products.name);
  const todo = rows.filter((r) => {
    const d = (r.data as Record<string, any>) || {};
    if (!force) return !d.kcal && !d.protein && !d.fat && !d.carbs;
    return !d.source || d.source === 'ai';   // ручные данные (source не ai) не трогаем
  });
  console.log(`Продуктов: ${rows.length}, к заполнению: ${todo.length}${dry ? ' (dry-run, в БД не пишем)' : ''}`);

  let done = 0, bad = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const list = chunk.map((r, k) => ({ n: k + 1, name: r.name, unit: r.unit || 'g' }));
    let items: Item[];
    try { items = await ask(list); } catch (e) { console.error(String((e as Error).message)); break; }
    for (const it of items) {
      const row = chunk[Number(it?.n) - 1];
      if (!row) continue;
      const data = sanitize(it, row.unit || 'g');
      if (!data) { bad++; console.warn('  пропущен (непригодный ответ):', row.name); continue; }
      if (dry) console.log(`  ${row.name}:`, JSON.stringify(data));
      else await db.update(products).set({ data: { ...((row.data as object) || {}), ...data }, updatedAt: new Date() }).where(eq(products.id, row.id));
      done++;
    }
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    await new Promise((r) => setTimeout(r, 4000));   // не упираемся в лимит запросов в минуту
  }
  console.log(`Готово: заполнено ${done}, пропущено ${bad}, осталось ${todo.length - done - bad}`);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].includes('fill-catalog-data')) {
  main().catch((e) => { console.error('Ошибка:', e); process.exit(1); });
}

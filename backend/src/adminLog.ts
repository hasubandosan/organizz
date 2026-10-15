import { db } from './db/client.js';
import { adminLog } from './db/schema/catalog.js';
import type { AuthedRequest } from './middleware/auth.js';

/** Записать действие админа в журнал. Никогда не бросает: сбой журнала не должен ломать само действие. */
export async function logAdmin(req: AuthedRequest, action: string, target?: string | null, details?: unknown): Promise<void> {
  try {
    await db.insert(adminLog).values({
      userId: req.userId ?? null, email: req.email ?? null, action,
      target: target ? String(target).slice(0, 200) : null,
      details: details === undefined ? null : (details as object),
    });
  } catch (e) { console.error('adminLog: не записалось', action, e); }
}

const SKIP = new Set(['priceUpdatedAt', 'source', 'priceRegion']);

/** Что изменилось между двумя версиями продукта/режима: [{ field, old, new }] (data разворачивается по ключам). */
export function diffRecord(before: any, after: any): { field: string; old: unknown; new: unknown }[] {
  const flat = (r: any) => {
    const o: Record<string, unknown> = {};
    if (!r) return o;
    for (const [k, v] of Object.entries(r)) {
      if (k === 'data' && v && typeof v === 'object') { for (const [dk, dv] of Object.entries(v as object)) if (!SKIP.has(dk)) o[dk] = dv; }
      else if (['name', 'category', 'unit'].includes(k)) o[k] = v;
    }
    return o;
  };
  const a = flat(before), b = flat(after), out: { field: string; old: unknown; new: unknown }[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ field: k, old: a[k] ?? null, new: b[k] ?? null });
  }
  return out;
}

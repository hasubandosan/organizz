import { and, eq } from 'drizzle-orm';
import { db } from './client.js';
import { apps } from './schema/registry.js';
import { roles, userAppRoles } from './schema/auth.js';

/**
 * Возвращает код роли пользователя в приложении (по его slug) или null,
 * если пользователь не зарегистрирован в этом приложении.
 */
export async function getUserRole(userId: string, appSlug: string): Promise<string | null> {
  const rows = await db
    .select({ roleCode: roles.code })
    .from(userAppRoles)
    .innerJoin(apps, eq(apps.id, userAppRoles.appId))
    .innerJoin(roles, eq(roles.id, userAppRoles.roleId))
    .where(and(eq(userAppRoles.userId, userId), eq(apps.slug, appSlug)))
    .limit(1);

  return rows[0]?.roleCode ?? null;
}

/** admin проходит любую проверку роли, иначе роль должна совпадать точно. */
export async function hasAccess(userId: string, appSlug: string, requiredRole: string): Promise<boolean> {
  const role = await getUserRole(userId, appSlug);
  if (!role) return false;
  return role === 'admin' || role === requiredRole;
}

/** Выдаёт пользователю роль в приложении. Используется при первой регистрации в app. */
export async function grantRole(userId: string, appSlug: string, roleCode: string): Promise<void> {
  const app = await db.select({ id: apps.id }).from(apps).where(eq(apps.slug, appSlug)).limit(1);
  if (!app[0]) throw new Error(`Приложение '${appSlug}' не найдено в registry.apps`);

  const role = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleCode)).limit(1);
  if (!role[0]) throw new Error(`Роль '${roleCode}' не найдена в auth.roles`);

  await db.insert(userAppRoles).values({ userId, appId: app[0].id, roleId: role[0].id }).onConflictDoNothing();
}

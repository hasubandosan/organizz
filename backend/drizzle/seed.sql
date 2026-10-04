-- Базовые роли. Выполнить один раз после применения миграций.
INSERT INTO auth.roles (code) VALUES
  ('admin'),
  ('moderator'),
  ('user')
ON CONFLICT (code) DO NOTHING;

-- Регистрируем первое реальное приложение в реестре.
-- Без этой записи grantRole() в auth/routes.ts упадёт с ошибкой "приложение не найдено".
INSERT INTO registry.apps (slug, name, db_schema, is_guest, status) VALUES
  ('app_1', 'Моё первое приложение', 'app_1', false, 'active'),
  ('projects', 'LifeOS: Проекты и задачи', 'projects', false, 'active'),
  ('meals', 'LifeOS: Питание', 'meals', false, 'active'),
  ('purchases', 'LifeOS: Покупки', 'purchases', false, 'active'),
  ('cosplays', 'LifeOS: Косплеи', 'cosplays', false, 'active'),
  ('shared', 'LifeOS: Общие теги и зоны', 'shared', false, 'active'),
  ('catalog', 'LifeOS: Каталог продуктов', 'catalog', false, 'active')
ON CONFLICT (slug) DO NOTHING;

-- Выдать себе admin в каталоге продуктов (нужно для модерации заявок).
-- Выполнить ОДИН раз вручную, подставив свой email:
--
-- INSERT INTO auth.user_app_roles (user_id, app_id, role_id)
-- SELECT u.id, a.id, r.id
-- FROM auth.users u, registry.apps a, auth.roles r
-- WHERE u.email = 'ваш-email@example.com' AND a.slug = 'catalog' AND r.code = 'admin'
-- ON CONFLICT DO NOTHING;

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
  ('cosplays', 'LifeOS: Косплеи', 'cosplays', false, 'active')
ON CONFLICT (slug) DO NOTHING;

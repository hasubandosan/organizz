import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/db/schema/registry.ts',
    './src/db/schema/auth.ts',
    './src/db/schema/app_1.ts',
    './src/db/schema/projects.ts',
  ],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Заполняется из .env — connection string к единственному Neon-проекту
    url: process.env.DATABASE_URL as string,
  },
  // Когда добавляете app_2, app_3... — дописывайте сюда их пути и slug ниже
  schemaFilter: ['registry', 'auth', 'app_1', 'projects'],
});

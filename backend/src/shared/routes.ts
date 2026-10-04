import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SYSTEM_TAGS } from './systemTags.js';

// GET /shared/system-tags — встроенные категории и теги (одинаковы у всех, только чтение)
export const systemTagsRouter = Router();
systemTagsRouter.get('/', requireAuth, (_req, res) => {
  res.json({ items: SYSTEM_TAGS.filter(t => !t.hidden) });
});

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

/**
 * Хранилище файлов (S3-совместимое: Backblaze B2 / Cloudflare R2 / любое другое).
 * Секреты живут только здесь (env), в браузер уходят лишь временные ссылки.
 *
 * Env: S3_ENDPOINT (https://s3.eu-central-003.backblazeb2.com), S3_REGION (eu-central-003),
 *      S3_BUCKET, S3_KEY_ID, S3_APP_KEY
 */
const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_KEY_ID, S3_APP_KEY } = process.env;

const UPLOAD_TTL = 300;   // сек: ссылка на загрузку живёт 5 минут
const READ_TTL   = 3600;  // сек: ссылка на просмотр живёт 1 час
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

let client: S3Client | null = null;
function s3(): S3Client {
  if (!S3_ENDPOINT || !S3_REGION || !S3_BUCKET || !S3_KEY_ID || !S3_APP_KEY) {
    throw new Error('Хранилище не настроено (нет S3_* переменных)');
  }
  client ??= new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: { accessKeyId: S3_KEY_ID, secretAccessKey: S3_APP_KEY },
    // новые версии SDK добавляют checksum-параметры, с которыми B2 не дружит
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return client;
}

/** Ключ принадлежит пользователю, только если начинается с его префикса. */
const ownKey = (userId: string, key: unknown): key is string =>
  typeof key === 'string' && key.startsWith(`${userId}/`) && !key.includes('..');

export const storageRouter = Router();
storageRouter.use(requireAuth);

// POST /storage/upload-url  { contentType } -> { key, uploadUrl }
storageRouter.post('/upload-url', async (req: AuthedRequest, res) => {
  try {
    const contentType = String(req.body?.contentType ?? '');
    if (!ALLOWED.has(contentType)) return res.status(400).json({ error: 'Допустимы только изображения (jpeg/png/webp/gif)' });
    const key = `${req.userId}/${randomUUID()}`;
    const uploadUrl = await getSignedUrl(
      s3(), new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }), { expiresIn: UPLOAD_TTL });
    res.json({ key, uploadUrl });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// POST /storage/read-url  { key } -> { url }
storageRouter.post('/read-url', async (req: AuthedRequest, res) => {
  try {
    if (!ownKey(req.userId!, req.body?.key)) return res.status(403).json({ error: 'Нет доступа к файлу' });
    const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: S3_BUCKET, Key: req.body.key }), { expiresIn: READ_TTL });
    res.json({ url });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// DELETE /storage  { key }
storageRouter.delete('/', async (req: AuthedRequest, res) => {
  try {
    if (!ownKey(req.userId!, req.body?.key)) return res.status(403).json({ error: 'Нет доступа к файлу' });
    await s3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: req.body.key }));
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

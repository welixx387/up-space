// POST /api/save — store edited texts, door code and new photos in the repository.
// Vercel rebuilds the site from the new commit, so changes go live in about a minute.
const { readContent, commitFiles, checkPassword, send, httpError, CONTENT_PATH } = require('../lib/github');
const { sanitize } = require('../lib/content');

const KEY = /^[a-z0-9][a-z0-9._-]{0,60}$/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_IMAGE = 3 * 1024 * 1024;

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Только POST' });
    await checkPassword(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const text = body.text || {}, images = body.images || {};

    const content = await readContent();
    content.text = content.text || {};
    content.images = content.images || {};
    const files = [];
    const changed = [];

    for (const [key, value] of Object.entries(text)) {
      if (!KEY.test(key)) throw httpError(400, 'Неверный ключ текста: ' + key);
      content.text[key] = sanitize(value);
      changed.push(key);
    }

    if (body.code !== undefined) {
      const code = String(body.code).trim().replace(/\s+/g, '').toUpperCase();
      if (!/^[0-9A-Za-zА-Яа-яЁё#*]{1,12}$/.test(code)) throw httpError(400, 'Код двери: только цифры и буквы, до 12 знаков');
      content.code = code;
      changed.push('code');
    }

    const stamp = Date.now().toString(36);
    for (const [key, img] of Object.entries(images)) {
      if (!KEY.test(key)) throw httpError(400, 'Неверный ключ фото: ' + key);
      const ext = TYPES[img && img.type];
      if (!ext) throw httpError(400, 'Фото должно быть JPG, PNG или WEBP');
      const buf = Buffer.from(String(img.data || ''), 'base64');
      if (!buf.length || buf.length > MAX_IMAGE) throw httpError(400, 'Фото слишком большое (максимум 3 МБ)');
      const path = `img/uploads/${key.replace(/\./g, '-')}-${stamp}.${ext}`;
      files.push({ path, content: buf });
      content.images[key] = path;
      changed.push(key);
    }

    if (!changed.length) return send(res, 400, { error: 'Нет изменений' });
    content.updatedAt = new Date().toISOString();
    files.push({ path: CONTENT_PATH, content: Buffer.from(JSON.stringify(content, null, 2) + '\n') });

    const sha = await commitFiles(files, 'Правки через админку: ' + changed.slice(0, 6).join(', ') + (changed.length > 6 ? ` и ещё ${changed.length - 6}` : ''));
    send(res, 200, { ok: true, commit: sha, images: Object.fromEntries(Object.keys(images).map(k => [k, content.images[k]])) });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

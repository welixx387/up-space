// POST /api/save — store the whole site document and any new photos in one commit.
// Body: { data?: object, images?: { id: { type, data(base64) } }, base?: updatedAt the editor started from }
// Vercel rebuilds the site from the new commit, so changes go live in about a minute.
const { readContent, commitFiles, checkPassword, send, httpError, CONTENT_PATH } = require('../lib/github');
const { normalize } = require('../lib/schema');

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_IMAGE = 3 * 1024 * 1024;

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Только POST' });
    await checkPassword(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const files = [], paths = {};

    for (const [id, img] of Object.entries(body.images || {})) {
      if (!/^[a-z0-9]{6,32}$/.test(id)) throw httpError(400, 'Неверный номер фото');
      const ext = TYPES[img && img.type];
      if (!ext) throw httpError(400, 'Фото должно быть JPG, PNG или WEBP');
      const buf = Buffer.from(String(img.data || ''), 'base64');
      if (!buf.length || buf.length > MAX_IMAGE) throw httpError(400, 'Фото слишком большое (максимум 3 МБ)');
      paths[id] = `img/uploads/${id}.${ext}`;
      files.push({ path: paths[id], content: buf });
    }

    let updatedAt = null;
    if (body.data) {
      const current = await readContent();
      if (body.base !== undefined && (current.updatedAt || null) !== (body.base || null)) {
        throw httpError(409, 'Сайт уже сохранили в другом окне. Обновите страницу, чтобы не затереть те изменения.');
      }
      // photos uploaded in this request are referenced as "upload:<id>"
      const json = JSON.stringify(body.data).replace(/"upload:([a-z0-9]{6,32})"/g, (m, id) => paths[id] ? JSON.stringify(paths[id]) : '""');
      const data = normalize(JSON.parse(json));
      if (!data.practices.length && !data.masters.length && !data.hero.title) throw httpError(400, 'Похоже, документ пустой. Сохранение отменено.');
      updatedAt = new Date().toISOString();
      data.updatedAt = updatedAt;
      files.push({ path: CONTENT_PATH, content: Buffer.from(JSON.stringify(data, null, 2) + '\n') });
    }

    if (!files.length) return send(res, 400, { error: 'Нет изменений' });
    const what = body.data ? 'правки сайта' + (Object.keys(paths).length ? ' и фото' : '') : 'фото';
    const commit = await commitFiles(files, 'Админка: ' + what);
    send(res, 200, { ok: true, commit, paths, updatedAt });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

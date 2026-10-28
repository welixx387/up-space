// GET /api/content — current saved content (also used to check the password on login).
const { readContent, checkPassword, send } = require('../lib/github');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Только GET' });
    await checkPassword(req);
    send(res, 200, { content: await readContent() });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

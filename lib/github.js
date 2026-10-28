// Minimal GitHub client for storing site content in this repository.
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'welixx387/up-space';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const CONTENT_PATH = 'content/site.json';

async function gh(path, opts = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw httpError(500, 'На сервере не задан GITHUB_TOKEN');
  const res = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'up-space-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw httpError(502, 'GitHub ответил ' + res.status + ': ' + body.slice(0, 200));
  }
  return res.json();
}

async function readContent() {
  const file = await gh(`/repos/${REPO}/contents/${CONTENT_PATH}?ref=${BRANCH}`);
  if (!file) return {};
  try { return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')); } catch { return {}; }
}

/** Write several files in one commit. files: [{path, content: Buffer}] */
async function commitFiles(files, message) {
  const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
  if (!ref) throw httpError(500, 'Не найдена ветка ' + BRANCH);
  const head = await gh(`/repos/${REPO}/git/commits/${ref.object.sha}`);
  const tree = [];
  for (const f of files) {
    const blob = await gh(`/repos/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: f.content.toString('base64'), encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await gh(`/repos/${REPO}/git/trees`, {
    method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });
  const commit = await gh(`/repos/${REPO}/git/commits`, {
    method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }),
  });
  await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

/** Constant-time password check against ADMIN_PASSWORD. */
async function checkPassword(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw httpError(500, 'На сервере не задан ADMIN_PASSWORD');
  const given = String(req.headers['x-admin-password'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    await new Promise(r => setTimeout(r, 800));
    throw httpError(401, 'Неверный пароль');
  }
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

module.exports = { gh, readContent, commitFiles, checkPassword, send, httpError, CONTENT_PATH };

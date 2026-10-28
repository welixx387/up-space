// Shared helpers: cleaning text from the editor and applying saved content to index.html.

const ALLOWED = new Set(['b', 'strong', 'i', 'em', 's', 'mark', 'span', 'br']);

/** Keep only simple formatting tags; everything else becomes plain text. Tags are rebalanced. */
function sanitize(input) {
  let s = String(input == null ? '' : input).slice(0, 6000);
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|iframe|object|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');
  const out = [];
  const stack = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    out.push(escapeText(s.slice(last, m.index)));
    last = re.lastIndex;
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (tag === 'div' || tag === 'p') { if (!closing && out.length) out.push('<br>'); continue; }
    if (!ALLOWED.has(tag)) continue;
    if (tag === 'br') { if (!closing) out.push('<br>'); continue; }
    if (closing) {
      const i = stack.lastIndexOf(tag);
      if (i === -1) continue;
      while (stack.length > i) out.push('</' + stack.pop() + '>');
      continue;
    }
    let open = '<' + tag;
    if (tag === 'span') {
      if (/\bclass\s*=\s*["']?[^"'>]*\bsmall\b/i.test(m[2])) open += ' class="small"';
      if (/\bdata-code\b/i.test(m[2])) open += ' data-code=""';
    }
    out.push(open + '>');
    stack.push(tag);
  }
  out.push(escapeText(s.slice(last)));
  while (stack.length) out.push('</' + stack.pop() + '>');
  return out.join('').replace(/(<br>\s*)+$/, '').replace(/^(\s*<br>)+/, '').trim();
}

/** Text between tags: keep entities that are already escaped, escape stray < and >. */
function escapeText(t) {
  return t.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function telHref(text) {
  let d = String(text).replace(/<[^>]*>/g, '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d.length >= 10 ? 'tel:+' + d : null;
}

/** Find the element whose start tag carries attr="key"; returns positions of start tag and its matching close. */
function findElement(html, attr, key) {
  const startRe = new RegExp('<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\s' + attr + '="' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>');
  const m = startRe.exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const innerStart = m.index + m[0].length;
  const tagRe = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
  tagRe.lastIndex = innerStart;
  let depth = 1, t;
  while ((t = tagRe.exec(html))) {
    if (t[1] === '/') depth--; else if (!/\/>$/.test(t[0])) depth++;
    if (depth === 0) return { tag, start: m.index, startTag: m[0], innerStart, innerEnd: t.index };
  }
  return null;
}

function applyContent(html, content) {
  content = content || {};
  const text = content.text || {};
  for (const key of Object.keys(text)) {
    const el = findElement(html, 'data-edit', key);
    if (!el) continue;
    const value = sanitize(text[key]);
    let startTag = el.startTag;
    if (el.tag === 'a' && /href="tel:/.test(startTag)) {
      const href = telHref(value);
      if (href) startTag = startTag.replace(/href="tel:[^"]*"/, 'href="' + href + '"');
    }
    html = html.slice(0, el.start) + startTag + value + html.slice(el.innerEnd);
  }
  const images = content.images || {};
  for (const key of Object.keys(images)) {
    const el = findElement(html, 'data-img', key);
    if (!el || !/^img\/[a-zA-Z0-9/_.-]+$/.test(images[key])) continue;
    const inner = html.slice(el.innerStart, el.innerEnd).replace(/(<img\b[^>]*?\ssrc=")[^"]*(")/, '$1' + images[key] + '$2');
    html = html.slice(0, el.innerStart) + inner + html.slice(el.innerEnd);
  }
  if (content.code && /^[0-9A-Za-z#*]{1,12}$/.test(content.code)) {
    const code = content.code;
    html = html.replace(/(<(span|tspan)\b[^>]*data-code=""[^>]*>)[^<]*(<\/\2>)/g, '$1' + code + '$3');
    html = html.replace(/(<div\b[^>]*data-code-boxes=""[^>]*>)[\s\S]*?(<\/div>)/,
      '$1' + code.split('').map(ch => '<i>' + ch + '</i>').join('') + '$2');
  }
  return html;
}

module.exports = { sanitize, applyContent, telHref };

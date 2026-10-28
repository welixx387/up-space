/* Renders the site from content/site.json into site.template.html.
   Used by build.js (Node) and by the admin preview (browser), so both always match. */
(function (root) {
  'use strict';

  var DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

  function str(v) { return v == null ? '' : String(v); }
  function esc(v) {
    return str(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /** Plain text → safe HTML. Supports **bold**, ~~strike~~, ==highlight== and line breaks. */
  function fmt(v) {
    return esc(str(v).trim())
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
      .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
      .replace(/\r?\n/g, '<br>');
  }
  /** Paragraphs separated by an empty line. */
  function paras(v, cls) {
    return str(v).split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + fmt(p) + '</p>'; }).join('\n');
  }
  function lines(v) { return (Array.isArray(v) ? v : str(v).split('\n')).map(function (x) { return str(x).trim(); }).filter(Boolean); }
  function telHref(v) {
    var d = str(v).replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return d.length >= 10 ? 'tel:+' + d : '#contacts';
  }
  function url(v) { v = str(v).trim(); return /^https?:\/\//i.test(v) ? esc(v) : '#contacts'; }
  function imgSrc(v, opts) {
    v = str(v);
    if (/^img\/[A-Za-z0-9/_.-]+$/.test(v)) return v;
    if (opts && opts.preview && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
    return '';
  }
  function slug(v) { return str(v).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40); }
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function plural(n, forms) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  function initials(name) {
    var w = str(name).trim().split(/\s+/).filter(function (x) { return /^[A-Za-zА-Яа-яЁё]/.test(x); });
    if (!w.length) return '•';
    if (w.length === 1 || /^[A-Za-z]/.test(w[1])) return w[0][0].toUpperCase();
    return (w[0][0] + w[1][0]).toUpperCase();
  }
  function time(v) {
    var m = /^(\d{1,2})[:.](\d{2})$/.exec(str(v).trim());
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return { h: h + mi / 60, label: (h < 10 ? '0' : '') + h + ':' + m[2] };
  }

  /* ── blocks ── */
  function aboutPoints(d) {
    return (d.about && d.about.points || []).filter(function (p) { return str(p.title).trim() || str(p.text).trim(); })
      .map(function (p) { return '      <div><b>' + fmt(p.title) + '</b><p>' + fmt(p.text) + '</p></div>'; }).join('\n');
  }

  function practice(p, i, opts) {
    var id = slug(p.id) || 'p' + (i + 1);
    var desc = paras(p.text);
    var bullets = lines(p.bullets);
    if (bullets.length) desc += '\n<ul>' + bullets.map(function (b) { return '<li>' + fmt(b) + '</li>'; }).join('') + '</ul>';
    if (str(p.note).trim()) desc += '\n' + paras(p.note, 'small');
    var src = imgSrc(p.photo, opts);
    if (src) desc += '\n<figure class="shot"><img src="' + esc(src) + '" alt="' + esc(p.title) + '" loading="lazy">' +
      (str(p.photoCaption).trim() ? '<figcaption>' + fmt(p.photoCaption) + '</figcaption>' : '') + '</figure>';

    var facts = [];
    if (str(p.when).trim() || str(p.whenNote).trim())
      facts.push('<div><dt>Когда</dt><dd>' + fmt(p.when) + (str(p.whenNote).trim() ? (str(p.when).trim() ? '<br>' : '') + '<span class="small">' + fmt(p.whenNote) + '</span>' : '') + '</dd></div>');
    var prices = (p.prices || []).filter(function (r) { return str(r.label).trim() || str(r.value).trim(); });
    if (prices.length || str(p.priceText).trim()) {
      var pr = '';
      if (prices.length) pr += '<table class="prices">' + prices.map(function (r) { return '<tr><td>' + fmt(r.label) + '</td><td>' + fmt(r.value) + '</td></tr>'; }).join('') + '</table>';
      if (str(p.priceText).trim()) pr += (pr ? '<p>' : '') + fmt(p.priceText) + (pr ? '</p>' : '');
      if (str(p.priceNote).trim()) pr += '<p class="small">' + fmt(p.priceNote) + '</p>';
      facts.push('<div><dt>Стоимость</dt><dd>' + pr + '</dd></div>');
    }
    if (str(p.teacher).trim()) facts.push('<div><dt>Ведёт</dt><dd>' + fmt(p.teacher) + '</dd></div>');
    var call = str(p.phone).trim()
      ? '<div class="call"><span class="small">' + fmt(p.phoneLabel || 'Запись') + '</span><a href="' + telHref(p.phone) + '">' + esc(p.phone) + '</a></div>' : '';

    return '      <details class="row" id="' + id + '"' + (i === 0 ? ' open' : '') + '>\n' +
      '        <summary><h3>' + fmt(p.title) + '</h3><span class="meta"><span class="when">' + fmt(p.format) + '</span><span class="price">' + fmt(p.priceShort) + '</span></span><span class="plus" aria-hidden="true"></span></summary>\n' +
      '        <div class="body">\n          <div class="desc">\n' + desc + '\n          </div>\n' +
      '          <div class="facts">\n            <dl>' + facts.join('') + '</dl>\n            ' + call + '\n          </div>\n        </div>\n      </details>';
  }

  function masters(d, opts) {
    return (d.masters || []).filter(function (m) { return str(m.name).trim(); }).map(function (m) {
      var src = imgSrc(m.photo, opts);
      return '      <article class="mate"><div class="ph"><span aria-hidden="true">' + esc(initials(m.name)) + '</span>' +
        (src ? '<img src="' + esc(src) + '" alt="' + esc(m.name) + '" loading="lazy">' : '') + '</div>' +
        '<div class="txt"><b>' + fmt(m.name) + '</b><p>' + fmt(m.role) + '</p>' +
        (str(m.phone).trim() ? '<a href="' + telHref(m.phone) + '">' + esc(m.phone) + '</a>' : '') + '</div></article>';
    }).join('\n');
  }

  function scheduleJson(d) {
    var ids = {};
    (d.practices || []).forEach(function (p, i) { ids[slug(p.id) || 'p' + (i + 1)] = true; });
    var ev = {};
    (d.schedule || []).forEach(function (s) {
      var day = +s.day, a = time(s.start);
      if (!(day >= 0 && day <= 6) || !a || !str(s.title).trim()) return;
      var b = time(s.end);
      var end = b && b.h > a.h ? b.h : Math.min(a.h + 1, 24);
      var link = slug(s.practice);
      (ev[day] = ev[day] || []).push({
        s: a.h, e: end, l: a.label + (b && b.h > a.h ? '–' + b.label : ''),
        t: str(s.title).trim(), ts: str(s.short).trim() || undefined,
        h: ids[link] ? '#' + link : '#week', r: s.rare ? 1 : undefined
      });
    });
    Object.keys(ev).forEach(function (k) { ev[k].sort(function (x, y) { return x.s - y.s; }); });
    return JSON.stringify(ev).replace(/</g, '\\u003c');
  }

  function codeBoxes(d) {
    var code = str(d.route && d.route.code).trim();
    if (!code) return '';
    return '<div class="code" aria-label="Код двери ' + esc(code) + '">' + code.split('').map(function (c) { return '<i>' + esc(c) + '</i>'; }).join('') + '</div>';
  }

  function routePhoto(d, opts) {
    var r = d.route || {}, src = imgSrc(r.photo, opts);
    if (!src) return '';
    return '          <div class="entry"><figure><img src="' + esc(src) + '" alt="Вход в студию" loading="lazy">' +
      (str(r.photoCaption).trim() ? '<figcaption>' + fmt(r.photoCaption) + '</figcaption>' : '') + '</figure></div>';
  }

  function stats(d) {
    var np = (d.practices || []).filter(function (p) { return str(p.title).trim(); }).length;
    var nm = (d.masters || []).filter(function (m) { return str(m.name).trim(); }).length;
    var h = d.hero || {};
    return '<div><b>' + np + '</b><span>' + plural(np, ['направление', 'направления', 'направлений']) + '</span></div>' +
      '<div><b>' + nm + '</b><span>' + plural(nm, ['мастер', 'мастера', 'мастеров']) + '</span></div>' +
      (str(h.statNum).trim() ? '<div><b>' + fmt(h.statNum) + '</b><span>' + fmt(h.statLabel) + '</span></div>' : '');
  }

  function render(template, data, opts) {
    var d = JSON.parse(JSON.stringify(data || {}));
    var code = str(d.route && d.route.code).trim();
    if (d.contacts) d.contacts.addressNote = str(d.contacts.addressNote).replace(/\[код\]/gi, code);
    var blocks = {
      'about.points': function () { return aboutPoints(d); },
      'practices': function () { return (d.practices || []).filter(function (p) { return str(p.title).trim(); }).map(function (p, i) { return practice(p, i, opts); }).join('\n\n'); },
      'masters': function () { return masters(d, opts); },
      'schedule-json': function () { return scheduleJson(d); },
      'code-boxes': function () { return codeBoxes(d); },
      'route.photo': function () { return routePhoto(d, opts); },
      'stats': function () { return stats(d); }
    };
    var html = template.replace(/<!--@([a-z.-]+)-->/g, function (m, name) { return blocks[name] ? blocks[name]() : ''; });
    return html.replace(/\{\{\s*(?:(tel|url|attr)\s+)?([A-Za-z0-9_.]+)\s*\}\}/g, function (m, kind, path) {
      var v = get(d, path);
      if (kind === 'tel') return telHref(v);
      if (kind === 'url') return url(v);
      if (kind === 'attr') return esc(v);
      return fmt(v);
    });
  }

  var api = { render: render, telHref: telHref, slug: slug, time: time, initials: initials, DAYS: DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SiteRender = api;
})(this);

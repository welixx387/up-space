// Shape of content/site.json. The server normalizes every save to this shape,
// so a broken or hostile request can never put unexpected data into the site.

const S = 's', T = 't', IMG = 'img', URL_ = 'url', ID = 'id', DAY = 'day', BOOL = 'b';

const schema = {
  version: 'n',
  hero: { title: S, subtitle: S, statNum: S, statLabel: S },
  about: { lead: T, points: [{ title: S, text: T }] },
  practicesSection: { title: S, intro: T },
  practices: [{
    id: ID, title: S, format: S, priceShort: S, text: T, bullets: [S], note: T,
    photo: IMG, photoCaption: S, when: T, whenNote: S,
    prices: [{ label: S, value: S }], priceText: T, priceNote: T,
    teacher: S, phoneLabel: S, phone: S,
  }],
  weekSection: { title: S, intro: T },
  schedule: [{ day: DAY, start: S, end: S, title: S, short: S, practice: ID, rare: BOOL }],
  mastersSection: { title: S, intro: T },
  masters: [{ id: ID, name: S, role: T, phone: S, photo: IMG }],
  route: {
    title: S, intro: T, step1Title: S, step1Text: T, step2Title: S, step2Text: T, step3Title: S, step3Text: T,
    code: S, street: S, photo: IMG, photoCaption: S, schemeNote: T,
  },
  contacts: {
    kicker: S, phone: S, address: S, addressNote: T, telegram: URL_, vk: URL_, yandex: URL_, tagline: S,
  },
};

const LIMITS = { [S]: 300, [T]: 5000 };
const MAX_ITEMS = 80;

function norm(spec, v) {
  if (Array.isArray(spec)) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, MAX_ITEMS).map(x => norm(spec[0], x));
  }
  if (spec && typeof spec === 'object') {
    const o = {};
    const src = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    for (const k of Object.keys(spec)) o[k] = norm(spec[k], src[k]);
    return o;
  }
  switch (spec) {
    case S: case T: return (v == null ? '' : String(v)).replace(/\r\n?/g, '\n').slice(0, LIMITS[spec]);
    case IMG: return /^img\/[A-Za-z0-9/_.-]{1,120}$/.test(String(v || '')) ? String(v) : '';
    case URL_: return /^https?:\/\/[^\s"<>]{1,300}$/i.test(String(v || '')) ? String(v) : '';
    case ID: return String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    case DAY: { const n = parseInt(v, 10); return n >= 0 && n <= 6 ? n : 0; }
    case BOOL: return v === true;
    case 'n': return 1;
    default: return '';
  }
}

function normalize(data) {
  const out = norm(schema, data);
  // practice anchors must be unique and non-empty
  const seen = new Set();
  out.practices.forEach((p, i) => {
    let id = p.id || 'p' + (i + 1);
    while (seen.has(id)) id += '-' + (i + 1);
    seen.add(id); p.id = id;
  });
  return out;
}

module.exports = { normalize, schema };

// Merchant list + learning-based format detection.
//
// Detection order:
//   1. If a parser recognised the format, map its `source` -> merchant (seeded).
//   2. Otherwise fingerprint the PDF text and compare to learned examples;
//      the best match above a threshold wins.
//   3. Otherwise unknown — the user picks from the dropdown, which teaches the
//      system (a new learned example is stored).

export const DEFAULT_MERCHANTS = [
  'David Hitchen', 'Activa', 'Secil', 'Krypton 2', 'PDMS', 'PHCHIC',
];

// Seeded knowledge: parser source -> merchant. The k2 / "ORDER #" format is
// Krypton 2 (formerly "LWA"); its PDFs even print "Krypton 2.0".
export const SOURCE_TO_MERCHANT = {
  activa: 'Activa',
  dh: 'David Hitchen',
  pdms: 'PDMS',
  secil: 'Secil',
  k2: 'Krypton 2',
};

// Only generic glue words are filtered — the template label words
// (shipping, products, order, …) are exactly the signal we want to keep.
const STOPWORDS = new Set('the and for you your our with this that from'.split(/\s+/));

// A format fingerprint: the document's structural words — the text BEFORE a
// "label:" and any ALL-CAPS headers. These are stable across different orders
// from the same merchant (the template), while the data (names, cities, which
// are normal Title-case lines) is deliberately excluded.
export function fingerprint(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
  const tokens = new Set();
  for (const line of lines) {
    if (line.includes(':')) {
      const head = line.slice(0, line.indexOf(':'));
      for (const w of head.toLowerCase().match(/[a-z]{3,}/g) || []) tokens.add(w);
    }
    for (const w of line.match(/\b[A-Z]{3,}\b/g) || []) tokens.add(w.toLowerCase());
  }
  return Array.from(tokens).filter((t) => !STOPWORDS.has(t));
}

// Jaccard similarity of two token lists (0..1).
export function similarity(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

// Brand names that share the same "2.0" order template (k2 parser). The format
// alone can't tell them apart, so an explicitly printed brand name wins.
const BRAND_RULES = [
  { re: /\bph[\s.]*chic/i, key: 'phchic', fallback: 'PHCHIC' },
  { re: /\bkrypton\b/i, key: 'krypton', fallback: 'Krypton 2' },
];

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// If the text explicitly names a known brand, return the matching merchant
// (preferring one already in `merchants`, else a canonical fallback). This
// keeps "PhChic 2.0" from being mislabelled Krypton just because of "2.0".
export function detectExplicitMerchant(text, merchants = []) {
  for (const b of BRAND_RULES) {
    if (b.re.test(text)) {
      const match = (merchants || []).find((n) => normName(n).includes(b.key));
      return match || b.fallback;
    }
  }
  return null;
}

// learned: [{ merchant, tokens: [...] }, ...]
export function detectMerchant(text, { source, learned = [], merchants = [], threshold = 0.5 } = {}) {
  // An explicitly printed brand name beats format/learned matching.
  const explicit = detectExplicitMerchant(text, merchants);
  if (explicit) return { merchant: explicit, via: 'name', score: 1 };
  if (source && SOURCE_TO_MERCHANT[source]) {
    return { merchant: SOURCE_TO_MERCHANT[source], via: 'format', score: 1 };
  }
  const tokens = fingerprint(text);
  let best = null;
  for (const ex of learned) {
    const score = similarity(tokens, ex.tokens || []);
    if (!best || score > best.score) best = { merchant: ex.merchant, score };
  }
  if (best && best.score >= threshold) return { merchant: best.merchant, via: 'learned', score: best.score };
  return null;
}

// Build a learnable example from a correction.
export function learnExample(text, merchant, label = '') {
  return { merchant, tokens: fingerprint(text), label };
}

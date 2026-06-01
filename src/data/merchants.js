// Merchant list + learning-based format detection.
//
// Detection order:
//   1. If a parser recognised the format, map its `source` -> merchant (seeded).
//   2. Otherwise fingerprint the PDF text and compare to learned examples;
//      the best match above a threshold wins.
//   3. Otherwise unknown — the user picks from the dropdown, which teaches the
//      system (a new learned example is stored).

export const DEFAULT_MERCHANTS = [
  'David Hitchen', 'Activa', 'Secil', 'LWA', 'PDMS', 'PHCHIC',
];

// Seeded knowledge: parser source -> merchant. (k2 / "ORDER #" is intentionally
// left out — it's learned from the first correction.)
export const SOURCE_TO_MERCHANT = {
  activa: 'Activa',
  dh: 'David Hitchen',
  pdms: 'PDMS',
  secil: 'Secil',
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

// learned: [{ merchant, tokens: [...] }, ...]
export function detectMerchant(text, { source, learned = [], threshold = 0.5 } = {}) {
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

export function detect(text) {
  return /ORDER\s*#\s*\d+/i.test(text) && /Shipping Address/i.test(text);
}

function cleanPhone(raw) {
  return String(raw || '').replace(/[^0-9+]/g, '');
}

function splitIntoOrders(text) {
  const parts = text.split(/(?=ORDER\s*#\s*\d+)/i);
  return parts.filter((p) => /ORDER\s*#\s*\d+/i.test(p));
}

// Pull every numbered product line ("1. …", "2. …") from the region above the
// Shipping Address. The quantity renders inconsistently — sometimes right after
// the "N." marker, sometimes as a trailing number on the first line — so handle
// both. Returns [{ qty, text }, …]; a product may wrap across several lines.
function extractProducts(regionLines) {
  const parts = regionLines.join('\n').split(/(?=^\s*\d+\.\s)/m);
  const items = [];
  for (const part of parts) {
    if (!/^\s*\d+\.\s/.test(part)) continue; // skip header / non-item chunks
    const ls = part
      .replace(/^\s*\d+\.\s*/, '') // drop the "N." marker
      .replace(/□/g, ' ') // drop checkbox glyphs
      .split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!ls.length) continue;

    let qty = '1';
    let first = ls[0];
    let rest = ls.slice(1);
    if (/^\d+$/.test(first)) {
      qty = first; // "N. <qty>" then the product on following lines
    } else {
      const m = first.match(/\s(\d+)\s*$/); // trailing qty on the first line
      if (m) { qty = m[1]; first = first.slice(0, first.length - m[0].length).trim(); }
      rest = [first, ...rest];
    }
    const text = rest.join(' ').replace(/\s+/g, ' ').trim();
    if (text) items.push({ qty, text });
  }
  return items;
}

function parseSingleOrder(block) {
  const idMatch = block.match(/ORDER\s*#\s*(\d+)/i);
  const orderId = idMatch ? idMatch[1] : '';

  const lines = block.split(/\r?\n/).map((l) => l.trim());
  const startIdx = lines.findIndex((l) => /^Shipping Address/i.test(l));
  if (startIdx === -1) return null;
  const slice = lines.slice(startIdx + 1);
  const endIdx = slice.findIndex((l) => /^Marketing Notes:/i.test(l) || /^Shipping note:/i.test(l));
  const block2 = endIdx === -1 ? slice : slice.slice(0, endIdx);

  let name = '', address = '', country = 'US', city = '', state = '', zip = '', phone = '', email = '';
  for (const raw of block2) {
    if (!raw) continue;
    if (/^Name:\s*/i.test(raw)) name = raw.replace(/^Name:\s*/i, '').trim();
    else if (/^Address:\s*/i.test(raw)) address = raw.replace(/^Address:\s*/i, '').trim();
    else if (/^Country:\s*/i.test(raw)) country = raw.replace(/^Country:\s*/i, '').trim();
    else if (/^City:\s*/i.test(raw)) city = raw.replace(/^City:\s*/i, '').trim();
    else if (/^State:\s*/i.test(raw)) state = raw.replace(/^State:\s*/i, '').trim();
    else if (/^Zip:\s*/i.test(raw)) zip = raw.replace(/^Zip:\s*/i, '').trim();
    else if (/^Phone:\s*/i.test(raw)) phone = cleanPhone(raw.replace(/^Phone:\s*/i, ''));
    else if (/^Email:\s*/i.test(raw)) email = raw.replace(/^Email:\s*/i, '').trim();
  }
  if (/united states/i.test(country)) country = 'US';

  // Products live above the Shipping Address block.
  const items = extractProducts(lines.slice(0, startIdx));
  const productLines = items.map((it) => `${it.qty} x ${it.text}`);
  const productText = items.length ? items[0].text : '';

  return {
    source: 'k2',
    orderId,
    recipient: { name, line1: address, line2: '', city, state, postcode: zip, country, phone, email },
    productText,
    productLines,
    rawText: block,
  };
}

export function parse(text) {
  const blocks = splitIntoOrders(text);
  if (!blocks.length) return null;
  const orders = blocks.map(parseSingleOrder).filter(Boolean);
  if (orders.length === 1) return orders[0];
  return { multi: true, orders };
}

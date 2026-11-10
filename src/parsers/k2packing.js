// Parser for K2 packing-slip PDFs (image-only, OCR'd).
// Format: "PACKING SLIP: 353767" header, labeled address fields (no colons),
// product table with columns: Product | Batch Number | Expiry Date | Qty.

export function detect(text) {
  return /PACKING\s+SLIP\s*[:\-]\s*\d+/i.test(text);
}

function cleanPhone(raw) {
  return String(raw || '').replace(/[^0-9+]/g, '');
}

// Extract a labeled field that may or may not have a colon after the key.
// e.g. "Name   Ian M Kahane" or "Name: Ian M Kahane"
function field(text, key) {
  const m = text.match(new RegExp(String.raw`^${key}\s*:?\s+(.+)$`, 'im'));
  return m ? m[1].trim() : '';
}

function parseSlip(block) {
  const slipMatch = block.match(/PACKING\s+SLIP\s*[:\-]\s*(\d+)/i);
  const slipId = slipMatch ? slipMatch[1] : '';

  const orderId = field(block, 'Order');
  const name = field(block, 'Name');
  const address = field(block, 'Address');
  const city = field(block, 'City');
  const state = field(block, 'State');
  const zip = field(block, 'Zip');
  const country = /united states/i.test(field(block, 'Country')) ? 'US' : (field(block, 'Country') || 'US');
  const phone = cleanPhone(field(block, 'Phone'));
  const email = field(block, 'Email');

  // Product table: lines after the header row "Product … Batch Number … Qty"
  // Each product row: "<product text> <batch> <Mon DD, YYYY> <qty>"
  // Strip batch (alphanumeric like D1158C4) and expiry (Mon DD, YYYY) from end,
  // leaving product text + trailing qty.
  const headerIdx = block.search(/Product\s+Batch\s+Number/i);
  const productArea = headerIdx >= 0 ? block.slice(headerIdx) : block;

  // Skip the header line, then collect non-empty non-noise lines until shipping/marketing note
  const tableLines = productArea
    .split(/\r?\n/)
    .slice(1) // drop header
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^(Batch|Product|Expiry|Shipping|Marketing|Packaging|Courier|Weight|Name|Address|City|State|Country|Zip|Phone|Email|Order)\b/i.test(l));

  const items = [];
  for (const line of tableLines) {
    // Strip trailing expiry date  "Mon DD, YYYY" or "Mon DD YYYY"
    const noExpiry = line.replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i, '').trim();
    // Strip batch number (all-caps/digits token like D1158C4, X25118, PV9228)
    const noBatch = noExpiry.replace(/\b[A-Z]{1,3}\d{4,}[A-Z0-9]*\b/, '').trim();
    // The trailing token should be the qty
    const qtyMatch = noBatch.match(/\s+(\d+)\s*$/);
    if (!qtyMatch) continue;
    const qty = qtyMatch[1];
    const productText = noBatch.slice(0, noBatch.length - qtyMatch[0].length).replace(/\s*\*\s*$/, '').trim();
    if (productText.length > 3) items.push({ productText, qty });
  }

  if (!name && !orderId) return null;

  const productText = items.length ? items[0].productText : '';
  const productLines = items.map((it) => `${it.qty} x ${it.productText}`);

  return {
    source: 'k2packing',
    orderId: orderId || slipId,
    recipient: { name, line1: address, line2: '', city, state, postcode: zip, country, phone, email },
    productText,
    productLines,
    rawText: block,
  };
}

export function parse(text) {
  // Split into individual slips on each "PACKING SLIP:" header
  const parts = text.split(/(?=PACKING\s+SLIP\s*[:\-]\s*\d+)/i).filter((p) => /PACKING\s+SLIP/i.test(p));
  if (!parts.length) return null;
  const orders = parts.map(parseSlip).filter(Boolean);
  if (!orders.length) return null;
  if (orders.length === 1) return orders[0];
  return { multi: true, orders };
}

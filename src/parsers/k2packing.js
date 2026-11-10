// Parser for K2 packing-slip PDFs — both text-extracted and OCR'd.
// Header: "PACKING SLIP: N", labeled address fields.
//
// Two column-layout variants of the product table:
//   OCR:          "Product  Batch Number  Expiry Date  Qty" on ONE merged line;
//                 each data row is also a single merged line.
//   Text-based:   "Product" alone on its own line; each column value on its own
//                 line (pdftotext reflow).  Qty may appear after Marketing Notes.

export function detect(text) {
  return /PACKING\s+SLIP\s*[:\-]\s*\d+/i.test(text);
}

function cleanPhone(raw) {
  return String(raw || '').replace(/[^0-9+]/g, '');
}

function fieldVal(block, key) {
  // Matches "Name   Value" (text-extracted) or "Name: Value" (OCR with colon)
  const m = block.match(new RegExp(String.raw`^${key}\s*:?\s+(.+)$`, 'im'));
  return m ? m[1].trim() : '';
}

// Batch token: 0–4 uppercase letters + 4+ digits (e.g. X25118, D1158C4, PV9228, 3049556)
// Also matches "* 3049556" (asterisk prefix in some PDFs)
function isBatch(s) {
  return /^[A-Z]{0,4}\d{4,}[A-Z0-9]*$/i.test(s.replace(/^[\*\s]+/, ''));
}
function isExpiry(s) {
  return /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i.test(s);
}
// Standalone quantity: 1–3 pure digits on their own line
function isQty(s) {
  return /^\d{1,3}$/.test(s);
}
function isNoise(s) {
  return (
    s.length <= 1 ||
    /^(Product|Batch\s+Number|Expiry\s+Date|Qty|Packaging|Courier|Weight|Name|Address|City|State|Country|Zip|Phone|Email|Order|Summary|Total\s+Parcels|Cold\s+Chain|Ambient|Couriers|Products|Warehouser)$/i.test(s) ||
    /^(Shipping\s+note|Marketing\s+Notes)/i.test(s) ||
    /^K2\s*[-–]\s*\d/i.test(s) ||
    /^(Fedex|UPS|DHL|DPD)$/i.test(s)
  );
}

// OCR format: "Product Batch Number Expiry Date Qty" on one merged header line;
// every data row is also a single merged line like:
//   "NABOTA® 200u * X25118 Dec 21, 2028 2"
// Strip batch codes and expiry dates; trailing 1–3-digit number = qty.
function extractProductsOCR(block) {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => /Product\s+Batch\s+Number/i.test(l));
  const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : [];

  return dataLines
    .filter((l) => !/^(Shipping\s+note|Marketing\s+Notes)/i.test(l) && l.length > 10)
    .map((line) => {
      let text = line
        .replace(/\b[A-Z]{0,4}\d{4,}[A-Z0-9]*\b/gi, '')
        .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const qtyMatch = text.match(/\s(\d{1,3})\s*$/);
      const qty = qtyMatch ? qtyMatch[1] : '1';
      text = text
        .replace(/\s*\*\s*$/, '')
        .replace(/\s+\d{1,3}\s*$/, '')
        .trim();
      return { productText: text, qty };
    })
    .filter((item) => item.productText.length > 3);
}

// Text-based format: "Product" alone on one line; each field on its own line.
// Products appear before the first batch code.
// Quantities appear as standalone digits — either inline after each batch group
// (multi-product) or after "Marketing Notes:" (single-product reflow).
function extractProductsTextBased(block) {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => /^Product$/i.test(l));
  const tableLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines;

  const productNames = [];
  const quantities = [];
  let pastFirstBatch = false;

  for (const line of tableLines) {
    // isQty must come first: a single digit like "6" has length 1 and would
    // otherwise be swallowed by the length guard inside isNoise.
    if (isQty(line)) { quantities.push(line); continue; }
    if (isNoise(line)) continue;
    if (isBatch(line)) { pastFirstBatch = true; continue; }
    if (isExpiry(line)) continue;
    if (!pastFirstBatch) productNames.push(line);
  }

  // Merge continuation lines: starts with lowercase or digit (wrapped product name)
  const merged = [];
  for (const name of productNames) {
    if (merged.length > 0 && /^[a-z0-9(]/.test(name)) {
      merged[merged.length - 1] += ' ' + name;
    } else {
      merged.push(name);
    }
  }

  return merged.map((text, i) => ({
    productText: text.replace(/\s*\*\s*$/, '').trim(),
    qty: quantities[i] || '1',
  }));
}

function extractProducts(block) {
  // OCR variant: product table header columns are merged on one line
  if (/Product\s+Batch\s+Number/i.test(block)) {
    return extractProductsOCR(block);
  }
  // Text-extracted variant: each field on its own line
  return extractProductsTextBased(block);
}

function parseSlip(block) {
  const slipMatch = block.match(/PACKING\s+SLIP\s*[:\-]\s*(\d+)/i);
  if (!slipMatch) return null;
  const slipId = slipMatch[1]; // unique packing-slip number per shipment

  const name    = fieldVal(block, 'Name');
  const address = fieldVal(block, 'Address');
  const city    = fieldVal(block, 'City');
  const state   = fieldVal(block, 'State');
  const zip     = fieldVal(block, 'Zip');
  const country = /united states/i.test(fieldVal(block, 'Country')) ? 'US' : (fieldVal(block, 'Country') || 'US');
  const phone   = cleanPhone(fieldVal(block, 'Phone'));
  const email   = fieldVal(block, 'Email');

  if (!name) return null;

  const items = extractProducts(block);
  const productText  = items.length ? items[0].productText : '';
  const productLines = items.map((it) => `${it.qty} x ${it.productText}`);

  return {
    source: 'k2packing',
    orderId: slipId, // slip number is unique; order number may be shared across slips
    recipient: { name, line1: address, line2: '', city, state, postcode: zip, country, phone, email },
    productText,
    productLines,
    rawText: block,
  };
}

export function parse(text) {
  const parts = text
    .split(/(?=PACKING\s+SLIP\s*[:\-]\s*\d+)/i)
    .filter((p) => /PACKING\s+SLIP/i.test(p));
  if (!parts.length) return null;
  const orders = parts.map(parseSlip).filter(Boolean);
  if (!orders.length) return null;
  if (orders.length === 1) return orders[0];
  return { multi: true, orders };
}

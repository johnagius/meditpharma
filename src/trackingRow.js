import { HS_CODES } from './data/hsCodes.js';
import { expandState } from './data/states.js';

// Column headers for the tracking section, in order.
export const TRACKING_HEADERS = [
  'day',
  'Date',
  'Order number',
  'tracking number',
  'Product',
  'quantity',
  'Product description',
  'Destination (city)',
  'Destination (state)',
  'Account',
  'Client',
  'Delivered on',
  'Comments',
  'Direction Remarks',
  'Supplier',
  'PFI',
  'Total Value on invoice',
  'GAP/DDP',
  'Box Dim',
  'From Whom',
  'Shipping Cost',
  'Merchant',
];

// Field keys in the same order as TRACKING_HEADERS.
export const TRACKING_KEYS = [
  'day',
  'date',
  'orderNumber',
  'trackingNumber',
  'product',
  'quantity',
  'productDescription',
  'destCity',
  'destState',
  'account',
  'client',
  'deliveredOn',
  'comments',
  'directionRemarks',
  'supplier',
  'pfi',
  'totalValue',
  'gapDdp',
  'boxDim',
  'fromWhom',
  'shippingCost',
  'merchant',
];

// Account dropdown options.
export const ACCOUNTS = ['Fedex', 'Fedex LPN', 'Fedex PPS', 'Fedex RSW'];

// getDay() is 0=Sunday .. 6=Saturday.
export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function weekdayName(date) {
  return WEEKDAYS[date.getDay()];
}

// "From Whom" defaults to the shipper name for Ph.Chic orders; blank otherwise.
// Stays editable in the UI for every merchant.
export function fromWhomFor(merchant) {
  const norm = String(merchant || '').toLowerCase().replace(/[^a-z]/g, '');
  return norm.startsWith('phchi') ? 'Ph.Chi' : '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// "01.06.26"
export function formatDateDDMMYY(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;
}

// "010626"
export function dateCompact(date) {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${String(date.getFullYear()).slice(-2)}`;
}

// "010626-1"
export function orderNumberFor(date, seq) {
  return `${dateCompact(date)}-${seq}`;
}

// "01062026" — compact date with a 4-digit year, for order-number prefixes.
export function dateCompact4(date) {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${date.getFullYear()}`;
}

export function isActivaMerchant(merchant) {
  return String(merchant || '').trim().toLowerCase() === 'activa';
}

export function isPdmsMerchant(merchant) {
  return String(merchant || '').trim().toLowerCase() === 'pdms';
}

// Merchants whose order number carries a "ddmmyyyy-" date prefix.
//  - Activa: suffix is the PDF order number.
//  - PDMS:   suffix is a generated per-date sequence (computed in app.js).
export function isDatePrefixedMerchant(merchant) {
  return isActivaMerchant(merchant) || isPdmsMerchant(merchant);
}

// Order-number strategy by merchant:
//  - Activa / PDMS: ddmmyyyy-<suffix>   (date-linked; updates with the Date)
//  - others:        <PDF order number>  (no date prefix)
// When no suffix is available, date-prefixed merchants fall back to just the
// date and other merchants to an empty string (filled in manually).
export function orderNumberForMerchant(merchant, orderId, date) {
  const id = String(orderId || '').trim();
  if (isDatePrefixedMerchant(merchant)) {
    return id ? `${dateCompact4(date)}-${id}` : dateCompact4(date);
  }
  return id;
}

// yyyy-mm-dd for <input type="date">
export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Parse a yyyy-mm-dd string into a local Date (no timezone surprises).
export function fromISODate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Move `date` to the given weekday (getDay index) within the same Mon–Sun week.
export function setWeekdayWithinWeek(date, targetDayIdx) {
  const mondayOffset = (date.getDay() + 6) % 7; // 0 when Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() - mondayOffset);
  const targetOffset = (targetDayIdx + 6) % 7; // 0 when Monday
  const out = new Date(monday);
  out.setDate(monday.getDate() + targetOffset);
  return out;
}

// Split "2 x XEO 100IU (ENG) *note*" style lines into { qty, text }.
// Notes wrapped in *asterisks* are stripped from the text.
export function parseProductLines(lines) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const out = [];
  for (const raw of arr) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const m = line.match(/^\s*(\d+)\s*[x×]\s*(.+?)\s*$/i);
    let qty = '1';
    let text = line;
    if (m) {
      qty = m[1];
      text = m[2];
    }
    text = text.replace(/\*[^*]*\*/g, '').replace(/\s{2,}/g, ' ').trim();
    out.push({ qty, text });
  }
  return out;
}

// Pull a dose/strength token from a product line, e.g. "100u", "50u", "100IU",
// "500u", "20mg". Lets same-product, different-dose line items be told apart
// (Botox 100u vs Botox 50u) in the tracking sheet and stock movements.
export function extractDose(text) {
  const m = String(text || '').match(/\b(\d+(?:\.\d+)?)\s*(iu|ius|units?|mcg|mg|ml|u)\b/i);
  if (!m) return '';
  let unit = m[2].toLowerCase();
  if (unit === 'iu' || unit === 'ius') unit = 'IU';
  else if (unit === 'unit' || unit === 'units') unit = 'u';
  return `${m[1]}${unit}`;
}

// Append a product's dose to its label unless the label already carries it, so
// different doses are distinguishable: ("Botox", "BOTOX 100u") -> "Botox 100u".
export function labelWithDose(baseLabel, text) {
  const base = String(baseLabel || '').trim();
  if (!base) return base; // never produce a dose-only label (" 100u")
  const dose = extractDose(text);
  if (!dose || base.toLowerCase().includes(dose.toLowerCase())) return base;
  return `${base} ${dose}`;
}

// Parse a date typed/pasted in any of the common shapes we emit or accept:
// yyyy-mm-dd, dd.mm.yy(yy), dd/mm/yy(yy), dd-mm-yy(yy). Day-first (matches the
// app's dd.mm.yy display). Returns a local Date or null.
export function parseFlexibleDate(value) {
  const t = String(value || '').trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return new Date(y, Number(m[2]) - 1, Number(m[1]));
  }
  return null;
}

// Parse a tab-separated table copied from Excel into an array of field objects
// keyed by TRACKING_KEYS. If the first row's cells match TRACKING_HEADERS it's
// treated as a header row and columns map by name (robust to reordering/subset);
// otherwise columns map positionally to TRACKING_KEYS. Only columns present
// appear in each object, so callers can merge without clobbering other fields.
export function parsePastedTable(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];

  const headerMap = {};
  TRACKING_HEADERS.forEach((h, i) => { headerMap[h.trim().toLowerCase()] = TRACKING_KEYS[i]; });

  const firstCells = lines[0].split('\t').map((c) => c.trim());
  const recognised = firstCells.filter((c) => headerMap[c.toLowerCase()]).length;

  let colKeys;
  let dataLines;
  if (recognised >= 2) {
    colKeys = firstCells.map((c) => headerMap[c.toLowerCase()] || null);
    dataLines = lines.slice(1);
  } else {
    colKeys = TRACKING_KEYS.slice();
    dataLines = lines;
  }

  const out = [];
  for (const line of dataLines) {
    const cells = line.split('\t');
    const obj = {};
    let any = false;
    colKeys.forEach((k, i) => {
      if (!k) return;
      obj[k] = (cells[i] == null ? '' : String(cells[i]).trim());
      any = true;
    });
    if (any) out.push(obj);
  }
  return out;
}

// Split one delimited line, honouring CSV double-quoting; tabs split plainly.
function splitDelimited(line, delim) {
  if (delim === '\t') return line.split('\t');
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i += 1; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Parse a CSV/TSV table (paste or file) into field objects. The first row must
// be headers; each is mapped through aliasMap (lowercased) to a field key.
// Unrecognised columns are ignored; only present columns appear per object.
export function parseRecords(text, aliasMap) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimited(lines[0], delim).map((h) => h.trim().toLowerCase());
  const keys = headers.map((h) => aliasMap[h] || null);
  if (!keys.some(Boolean)) return [];
  const out = [];
  for (const line of lines.slice(1)) {
    const cells = splitDelimited(line, delim);
    const obj = {};
    let any = false;
    keys.forEach((k, i) => {
      if (!k) return;
      obj[k] = (cells[i] == null ? '' : String(cells[i]).trim());
      any = true;
    });
    if (any && Object.values(obj).some((v) => v !== '')) out.push(obj);
  }
  return out;
}

// Build a fully-defaulted tracking row from a parsed order.
//  order: { recipient: {...}, products: [{ qty, label }] }
//  rowIndex: 0-based position (drives the rotating HS description + order seq)
//  date: JS Date used for day/date/order-number defaults
export function buildTrackingRow(order, rowIndex, date = new Date(), hsCodes = HS_CODES) {
  const recipient = order.recipient || {};
  const products = order.products || [];
  const list = (hsCodes && hsCodes.length) ? hsCodes : HS_CODES;
  const hs = list[rowIndex % list.length];

  return {
    day: weekdayName(date),
    date: formatDateDDMMYY(date),
    isoDate: toISODate(date),
    orderNumber: orderNumberForMerchant(order.merchant, order.orderId, date),
    trackingNumber: '',
    product: products.map((p) => p.label).join(', '),
    quantity: products.map((p) => p.qty).join(','),
    productDescription: hs.description,
    destCity: recipient.city || '',
    destState: expandState(recipient.state),
    account: ACCOUNTS[0],
    client: recipient.name || '',
    deliveredOn: '',
    comments: '',
    directionRemarks: '',
    // Krypton-specific invoice fields; blank for other merchants, filled in manually.
    supplier: '',
    pfi: '',
    totalValue: '',
    gapDdp: '',
    boxDim: '',
    fromWhom: fromWhomFor(order.merchant),
    shippingCost: '',
    // Owning merchant — drives the "By Merchant" tab's segregation. Editable.
    merchant: order.merchant || '',
  };
}

// Tab-separated cells (header order) for copy-to-clipboard / spreadsheet paste.
export function trackingRowToCells(row) {
  return TRACKING_KEYS.map((k) => row[k] ?? '');
}

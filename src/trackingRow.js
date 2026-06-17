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

// Order-number strategy by merchant:
//  - Activa:  ddmmyyyy-<PDF order number>  (date-linked; updates with the Date)
//  - others:  <PDF order number>           (no date prefix)
// When the PDF carries no order number, Activa falls back to just the date and
// other merchants to an empty string (filled in manually).
export function orderNumberForMerchant(merchant, orderId, date) {
  const id = String(orderId || '').trim();
  if (isActivaMerchant(merchant)) {
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

// Build a fully-defaulted tracking row from a parsed order.
//  order: { recipient: {...}, products: [{ qty, label }] }
//  rowIndex: 0-based position (drives the rotating HS description + order seq)
//  date: JS Date used for day/date/order-number defaults
export function buildTrackingRow(order, rowIndex, date = new Date()) {
  const recipient = order.recipient || {};
  const products = order.products || [];
  const hs = HS_CODES[rowIndex % HS_CODES.length];

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

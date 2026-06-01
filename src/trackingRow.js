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
    orderNumber: orderNumberFor(date, rowIndex + 1),
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
  };
}

// Tab-separated cells (header order) for copy-to-clipboard / spreadsheet paste.
export function trackingRowToCells(row) {
  return TRACKING_KEYS.map((k) => row[k] ?? '');
}

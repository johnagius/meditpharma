import { COLUMN_KEYS, ROW_CONSTANTS } from './data/columns.js';
import { SENDERS } from './data/senders.js';
import { HS_CODES } from './data/hsCodes.js';
import { ciCommentForProduct } from './data/midCodes.js';

// Generate firstname.lastname@openboxmail.net from a full name
function fakeEmail(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0] + '.' + parts[parts.length - 1] + '@openboxmail.net').toLowerCase();
  return ((parts[0] || 'patient') + '@openboxmail.net').toLowerCase();
}

export function buildRow({ recipient, product, qty }, rowIndex, hsCodes = HS_CODES) {
  const sender = SENDERS[rowIndex % SENDERS.length];
  const list = (hsCodes && hsCodes.length) ? hsCodes : HS_CODES;
  const hs = list[rowIndex % list.length];

  const recipientEmail = recipient?.email || fakeEmail(recipient?.name);

  const row = {
    ...ROW_CONSTANTS,
    senderContactName: sender.name,
    senderEmail: 'mason.river82@proton.me',
    senderLine1: sender.line1,
    senderPostcode: '',
    senderCity: sender.city,
    recipientContactName: recipient?.name || '',
    recipientContactNumber: recipient?.phone || '',
    recipientEmail,
    recipientLine1: recipient?.line1 || '',
    recipientPostcode: recipient?.postcode || '',
    recipientState: recipient?.state || '',
    recipientCity: recipient?.city || '',
    itemDescription: hs.description,
    harmonizedCode: hs.code,
    commodityQuantity: qty ? String(qty) : ROW_CONSTANTS.commodityQuantity,
    manufacturingCountry: product?.country || '',
    ciCommentLine: ciCommentForProduct(product),
  };

  return COLUMN_KEYS.map((key, idx) => {
    if (idx === COLUMN_KEYS.length - 1) return row.serviceType;
    return row[key] ?? '';
  });
}

export function HEADER_ROW() {
  return COLUMN_KEYS.slice();
}

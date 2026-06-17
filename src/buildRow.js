import { COLUMN_KEYS, ROW_CONSTANTS } from './data/columns.js';
import { SENDERS } from './data/senders.js';
import { HS_CODES } from './data/hsCodes.js';
import { ciCommentForProduct } from './data/midCodes.js';

export function buildRow({ recipient, product }, rowIndex, hsCodes = HS_CODES) {
  const sender = SENDERS[rowIndex % SENDERS.length];
  const list = (hsCodes && hsCodes.length) ? hsCodes : HS_CODES;
  const hs = list[rowIndex % list.length];

  const row = {
    ...ROW_CONSTANTS,
    senderContactName: sender.name,
    senderLine1: sender.line1,
    senderPostcode: sender.postcode,
    senderCity: sender.city,
    recipientContactName: recipient?.name || '',
    recipientContactNumber: recipient?.phone || '',
    recipientEmail: recipient?.email || '',
    recipientLine1: recipient?.line1 || '',
    recipientPostcode: recipient?.postcode || '',
    recipientState: recipient?.state || '',
    recipientCity: recipient?.city || '',
    itemDescription: hs.description,
    harmonizedCode: hs.code,
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

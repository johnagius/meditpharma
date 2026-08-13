const CITY_STATE_ZIP = /^([^,]+),\s*([A-Z]{2})\s+([0-9]{5}(?:-[0-9]{4})?)\s*$/;

function normalize(text) {
  return text.replace(/ﬀ|ﬁ|ﬂ|ﬃ|ﬄ|�/g, (ch) => {
    const map = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };
    return map[ch] || ch;
  });
}

// Old format: "OrderID: 123456" + "Shipping Address"
// New format: "Packing Slip: CKRCXV" + "Ship To"
export function detect(text) {
  if (/OrderID:\s*\d+/i.test(text) && /Shipping Address/i.test(text)) return true;
  if (/^Packing Slip:\s*\S+/im.test(text) && /^Ship To/im.test(text)) return true;
  return false;
}

function parseOnePackingSlip(block) {
  const idMatch = block.match(/^Packing Slip:\s*(\S+)/im);
  const orderId = idMatch ? idMatch[1].trim() : '';

  const lines = block.split(/\r?\n/).map((l) => l.trim());
  const start = lines.findIndex((l) => /^Ship To$/i.test(l));
  if (start === -1) return null;

  // Collect address block until "Items"
  const addrBlock = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    if (/^Items$/i.test(lines[i])) break;
    addrBlock.push(lines[i]);
  }

  let name = '', line1 = '', line2 = '', city = '', state = '', zip = '', phone = '', email = '';
  const country = 'US';

  for (const raw of addrBlock) {
    if (/^USA$|^United States$/i.test(raw)) continue;
    if (/^Phone:/i.test(raw)) { phone = raw.replace(/^Phone:\s*/i, '').replace(/[^0-9+]/g, ''); continue; }
    if (/^Email:/i.test(raw)) { email = raw.replace(/^Email:\s*/i, '').trim(); continue; }
    const m = raw.match(CITY_STATE_ZIP);
    if (m) { city = m[1].trim(); state = m[2]; zip = m[3]; continue; }
    if (!name) { name = raw; }
    else if (!line1) { line1 = raw; }
    else if (!line2 && !city) { line2 = raw; }
  }

  // Product: after "Items" + header row, first data line(s)
  const itemsIdx = lines.findIndex((l) => /^Items$/i.test(l));
  let productText = '';
  let productLines = [];
  if (itemsIdx !== -1) {
    const dataLines = lines.slice(itemsIdx + 1).filter(
      (l) => l && !/^Product\s+Qty/i.test(l) && !/^Generated:/i.test(l)
    );
    if (dataLines.length) {
      productText = dataLines[0].replace(/\s+\d+\s+.*$/, '').trim();
      productLines = dataLines.map((l) => {
        const stripped = l.replace(/\s+\d+\s+.*$/, '').trim();
        return stripped ? `1 x ${stripped}` : null;
      }).filter(Boolean);
    }
  }

  return {
    source: 'dh',
    orderId,
    recipient: { name, line1, line2, city, state, postcode: zip, country, phone, email },
    productText,
    productLines,
    rawText: block,
  };
}

function parsePackingSlip(t) {
  // Split on each "Packing Slip:" header to handle multi-slip PDFs
  const blocks = t.split(/(?=^Packing Slip:\s*\S+)/im).filter((b) => /^Packing Slip:/im.test(b));
  if (!blocks.length) return null;
  const orders = blocks.map(parseOnePackingSlip).filter(Boolean);
  if (orders.length === 1) return orders[0];
  return { multi: true, orders };
}

export function parse(text) {
  const t = normalize(text);

  // New packing-slip format
  if (/^Packing Slip:\s*\S+/im.test(t)) return parsePackingSlip(t);

  // Legacy format
  const idMatch = t.match(/OrderID:\s*(\d+)/i);
  const orderId = idMatch ? idMatch[1] : '';

  const lines = t.split(/\r?\n/).map((l) => l.trim());
  const start = lines.findIndex((l) => /^Shipping Address/i.test(l));
  if (start === -1) return null;

  const block = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^Products?\b/i.test(line)) break;
    block.push(line);
  }

  let name = '', line1 = '', line2 = '', city = '', state = '', zip = '', phone = '', email = '';
  const country = 'US';

  for (const raw of block) {
    if (/^USA$|^United States$/i.test(raw)) continue;
    if (/^Phone:/i.test(raw)) { phone = raw.replace(/^Phone:\s*/i, '').replace(/[^0-9+]/g, ''); continue; }
    if (/^Email:/i.test(raw)) { email = raw.replace(/^Email:\s*/i, '').trim(); continue; }
    const m = raw.match(CITY_STATE_ZIP);
    if (m) { city = m[1].trim(); state = m[2]; zip = m[3]; continue; }
    if (!name) { name = raw; }
    else if (!line1) { line1 = raw; }
    else if (!line2) { line2 = raw; }
  }

  const productLine = lines
    .slice(lines.findIndex((l) => /^Products?\b/i.test(l)) + 1)
    .find((l) => l && !/^Product Name/i.test(l) && !/^Generated:/i.test(l));

  let productText = '';
  let productLines = [];
  if (productLine) {
    const qtyMatch = productLine.match(/^(.+?)\s{2,}(\d+)\s*$/);
    if (qtyMatch) {
      productText = qtyMatch[1].trim();
      productLines = [`${qtyMatch[2]} x ${productText}`];
    } else {
      productText = productLine.trim();
    }
  }

  return {
    source: 'dh',
    orderId,
    recipient: { name, line1, line2, city, state, postcode: zip, country, phone, email },
    productText,
    productLines,
    rawText: t,
  };
}

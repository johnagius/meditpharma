// Purita Peptides "FULFILLMENT PICK LIST" format.
// Header: "FULFILLMENT PICK LIST / ORDER #A6489-4665"
// SHIP TO block with labeled fields (Name / Address / City / Country / Phone / Email)
// Product table: product name line, SKU: line, then qty as a plain integer.

const COUNTRY_CODES = {
  denmark: 'DK', 'united states': 'US', usa: 'US', 'united kingdom': 'GB',
  germany: 'DE', france: 'FR', spain: 'ES', italy: 'IT', netherlands: 'NL',
  austria: 'AT', switzerland: 'CH', sweden: 'SE', norway: 'NO', finland: 'FI',
  poland: 'PL', portugal: 'PT', belgium: 'BE', ireland: 'IE', australia: 'AU',
  canada: 'CA', 'new zealand': 'NZ', japan: 'JP', 'south korea': 'KR',
};

function countryCode(name) {
  return COUNTRY_CODES[String(name || '').trim().toLowerCase()] || String(name || '').trim().toUpperCase().slice(0, 2);
}

export function detect(text) {
  return /FULFILLMENT PICK LIST/i.test(text) && /PURITA\s+PEPTIDES/i.test(text);
}

export function parse(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // Order ID: "ORDER #A6489-4665"
  const idMatch = text.match(/ORDER\s+#([A-Z0-9]+-[A-Z0-9]+)/i);
  if (!idMatch) return null;
  const orderId = idMatch[1];

  // Labeled field helper
  const field = (key) => {
    const m = text.match(new RegExp(`^${key}\\s+(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };

  const name = field('Name');
  const addressRaw = field('Address');
  const city = field('City');
  const countryRaw = field('Country');
  const phone = field('Phone').replace(/[^0-9+]/g, '');
  const email = field('Email');

  // line1 = first comma-delimited segment; postcode = first 4-5 digit run
  const addrParts = addressRaw.split(',').map((s) => s.trim());
  const line1 = addrParts[0] || '';
  const postcodeMatch = addressRaw.match(/\b(\d{4,5})\b/);
  const postcode = postcodeMatch ? postcodeMatch[1] : '';

  // Products between "CHECK PRODUCT" header and footer line
  const checkIdx = lines.findIndex((l) => /^CHECK\s+PRODUCT/i.test(l));
  const footerIdx = lines.findIndex((l) => /PURITA\s+PEPTIDES\s+INTERNAL/i.test(l));
  const prodLines = lines.slice(
    checkIdx >= 0 ? checkIdx + 1 : 0,
    footerIdx > checkIdx ? footerIdx : undefined,
  ).filter(Boolean);

  const productLines = [];
  let i = 0;
  while (i < prodLines.length) {
    const cur = prodLines[i];
    if (/^SKU:/i.test(cur)) { i += 1; continue; }
    if (/^[A-Za-z(]/.test(cur)) {
      const productName = cur;
      let j = i + 1;
      if (j < prodLines.length && /^SKU:/i.test(prodLines[j])) j += 1;
      let qty = 1;
      if (j < prodLines.length && /^\d+$/.test(prodLines[j])) {
        qty = parseInt(prodLines[j], 10) || 1;
        i = j + 1;
      } else {
        i += 1;
      }
      productLines.push(`${qty} x ${productName}`);
    } else {
      i += 1;
    }
  }

  const productText = productLines[0]
    ? productLines[0].replace(/^\d+\s*x\s*/i, '')
    : '';

  return {
    source: 'purita',
    orderId,
    recipient: {
      name,
      line1,
      line2: '',
      city,
      state: '',
      postcode,
      country: countryCode(countryRaw),
      phone,
      email,
    },
    productText,
    productLines,
    rawText: text,
  };
}

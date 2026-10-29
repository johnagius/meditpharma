const STATE_ABBR = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR',
};

function abbr(name) {
  const key = String(name || '').trim().toLowerCase();
  return STATE_ABBR[key] || name.trim().toUpperCase();
}

export function detect(text) {
  return /PACKING SLIP FOR ORDER #/i.test(text) && /Shipping Address/i.test(text);
}

export function parse(text) {
  // Order ID
  const idMatch = text.match(/PACKING SLIP FOR ORDER #(\d+)/i);
  if (!idMatch) return null;
  const orderId = idMatch[1];

  // Order date from "COMPLETED: Oct 23 2026"
  const completedMatch = text.match(/COMPLETED:\s*(\w+\s+\d{1,2}\s+\d{4})/i);
  let orderDate = null;
  if (completedMatch) {
    const d = new Date(completedMatch[1]);
    if (!isNaN(d)) orderDate = d;
  }

  // Address fields (all labeled)
  const field = (key) => {
    const m = text.match(new RegExp(String.raw`^${key}:\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };

  const name = field('Name');
  const line1 = field('Address1');
  const city = field('City');
  const stateRaw = field('State');
  const state = abbr(stateRaw);
  const postcode = field('Zip');
  const phoneRaw = field('Phone');
  const phone = phoneRaw.replace(/[^0-9+]/g, '');

  // Product text: everything between the table headers and "Shipping Address".
  // The PDF table layout scatters product info across lines; we collect the
  // non-junk lines (no prices, no pure digits, no column-header words) and join
  // them to form a searchable product string.
  const shippingIdx = text.indexOf('Shipping Address');
  const productArea = shippingIdx > 0 ? text.slice(0, shippingIdx) : text;

  const SKIP = /^\$|^USD$|^OTC$|^Refill$|^Status$|^Shipped$|^Received$|^Product$|^Shipping$|^Subtotal$|^S\.Group$|^Name$|^Quantity$|^Method$|^\d+$|^\W+$/;
  const productLines = productArea
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !SKIP.test(l) && !/PACKING SLIP|COMPLETED/i.test(l));

  // Join and normalise: stitch "mg/0.6m" + "L" -> "mg/0.6mL", remove □ chars.
  const productText = productLines
    .join(' ')
    .replace(/mg\/0\.6m\s+L\b/, 'mg/0.6mL')
    .replace(/[□□]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    source: 'occ',
    orderId,
    orderDate,
    recipient: {
      name,
      line1,
      line2: '',
      city,
      state,
      postcode,
      country: 'US',
      phone,
      email: '',
    },
    productText,
    productLines: productText ? [productText] : [],
    rawText: text,
  };
}

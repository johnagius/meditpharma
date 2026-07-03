// Cloudflare Worker: REST API over a D1 database for Meditpharma.
//
// Two resources, same CRUD shape:
//   /api/rows      tracking-sheet rows   (table tracking_rows)
//   /api/fedex     FedEx shipment rows   (table fedex_rows)
//
//   GET    /api/<res>        list all rows
//   POST   /api/<res>        insert a row            -> created row (with id)
//   PUT    /api/<res>/:id    overwrite a row         -> updated row
//   DELETE /api/<res>/:id    delete a row            -> { ok: true }

// [ jsonKey, dbColumn ] per resource, in a stable order.
const RESOURCES = {
  rows: {
    table: 'tracking_rows',
    dedup: true,
    fields: [
      ['day', 'day'],
      ['date', 'date'],
      ['isoDate', 'iso_date'],
      ['orderNumber', 'order_number'],
      ['trackingNumber', 'tracking_number'],
      ['product', 'product'],
      ['quantity', 'quantity'],
      ['productDescription', 'product_description'],
      ['destCity', 'dest_city'],
      ['destState', 'dest_state'],
      ['account', 'account'],
      ['client', 'client'],
      ['deliveredOn', 'delivered_on'],
      ['deliveredOnIso', 'delivered_on_iso'],
      ['deliveryStatus', 'delivery_status'],
      ['comments', 'comments'],
      ['directionRemarks', 'direction_remarks'],
      ['supplier', 'supplier'],
      ['pfi', 'pfi'],
      ['totalValue', 'total_value'],
      ['gapDdp', 'gap_ddp'],
      ['boxDim', 'box_dim'],
      ['fromWhom', 'from_whom'],
      ['shippingCost', 'shipping_cost'],
      ['merchant', 'merchant'],
      ['dedupKey', 'dedup_key'],
    ],
  },
  // Master list: same shape as tracking rows, separate table. Today's tracking
  // rows are promoted (upserted by dedup_key) into here without touching the
  // live tracking rows.
  master: {
    table: 'master_rows',
    dedup: true,
    fields: [
      ['day', 'day'],
      ['date', 'date'],
      ['isoDate', 'iso_date'],
      ['orderNumber', 'order_number'],
      ['trackingNumber', 'tracking_number'],
      ['product', 'product'],
      ['quantity', 'quantity'],
      ['productDescription', 'product_description'],
      ['destCity', 'dest_city'],
      ['destState', 'dest_state'],
      ['account', 'account'],
      ['client', 'client'],
      ['deliveredOn', 'delivered_on'],
      ['deliveredOnIso', 'delivered_on_iso'],
      ['deliveryStatus', 'delivery_status'],
      ['comments', 'comments'],
      ['directionRemarks', 'direction_remarks'],
      ['supplier', 'supplier'],
      ['pfi', 'pfi'],
      ['totalValue', 'total_value'],
      ['gapDdp', 'gap_ddp'],
      ['boxDim', 'box_dim'],
      ['fromWhom', 'from_whom'],
      ['shippingCost', 'shipping_cost'],
      ['merchant', 'merchant'],
      ['dedupKey', 'dedup_key'],
    ],
  },
  fedex: {
    table: 'fedex_rows',
    dedup: true,
    // `cells` holds the full 52-column row as JSON.
    json: ['cells'],
    fields: [
      ['fileName', 'file_name'],
      ['source', 'source'],
      ['productKey', 'product_key'],
      ['productMid', 'product_mid'],
      ['recipientName', 'recipient_name'],
      ['cells', 'cells'],
      ['dedupKey', 'dedup_key'],
    ],
  },
  products: {
    table: 'products',
    dedup: true,
    fields: [
      ['key', 'pkey'],
      ['name', 'name'],
      ['mid', 'mid'],
      ['country', 'country'],
      ['description', 'description'],
      ['hsCode', 'hs_code'],
      ['manufacturerName', 'manufacturer_name'],
      ['manufacturingCountry', 'manufacturing_country'],
      ['manufacturingAddress', 'manufacturing_address'],
      ['keywords', 'keywords'],
      ['status', 'status'],
      ['dedupKey', 'dedup_key'],
    ],
  },
  hscodes: {
    table: 'hs_codes',
    dedup: true,
    fields: [
      ['description', 'description'],
      ['code', 'code'],
      ['status', 'status'],
      ['position', 'position'],
      ['dedupKey', 'dedup_key'],
    ],
  },
  merchants: {
    table: 'merchants',
    fields: [['name', 'name']],
  },
  patterns: {
    table: 'merchant_patterns',
    json: ['tokens'],
    fields: [
      ['merchant', 'merchant'],
      ['tokens', 'tokens'],
      ['label', 'label'],
    ],
  },
  stockitems: {
    table: 'stock_items',
    fields: [
      ['merchant', 'merchant'],
      ['name', 'name'],
      ['section', 'section'],
      ['country', 'country'],
      ['batch', 'batch'],
      ['expiry', 'expiry'],
      ['opening', 'opening'],
      ['matchKey', 'match_key'],
    ],
  },
  stockmoves: {
    table: 'stock_movements',
    dedup: true,
    fields: [
      ['merchant', 'merchant'],
      ['itemId', 'item_id'],
      ['product', 'product'],
      ['qty', 'qty'],
      ['date', 'date'],
      ['country', 'country'],
      ['batch', 'batch'],
      ['section', 'section'],
      ['status', 'status'],
      ['orderKey', 'order_key'],
      ['note', 'note'],
      ['dedupKey', 'dedup_key'],
    ],
  },
  settings: {
    table: 'settings',
    dedup: true,
    fields: [
      ['key', 'skey'],
      ['value', 'svalue'],
      ['dedupKey', 'dedup_key'],
    ],
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function isJsonField(cfg, jsonKey) {
  return (cfg.json || []).includes(jsonKey);
}

// DB row (snake_case) -> API row (camelCase).
function toApi(cfg, dbRow) {
  const out = { id: dbRow.id };
  for (const [jsonKey, col] of cfg.fields) {
    const raw = dbRow[col];
    if (isJsonField(cfg, jsonKey)) {
      try { out[jsonKey] = JSON.parse(raw || 'null'); } catch { out[jsonKey] = null; }
    } else {
      out[jsonKey] = raw ?? '';
    }
  }
  return out;
}

function valuesFrom(cfg, body) {
  return cfg.fields.map(([jsonKey]) => {
    const v = body ? body[jsonKey] : undefined;
    if (isJsonField(cfg, jsonKey)) return JSON.stringify(v ?? null);
    return v != null ? String(v) : '';
  });
}

async function listRows(env, cfg) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${cfg.table} ORDER BY id`).all();
  return json((results || []).map((r) => toApi(cfg, r)));
}

async function insertRow(env, cfg, body) {
  // De-dup: if this resource supports it and a row with the same dedup_key
  // already exists, update that row instead of inserting a duplicate.
  if (cfg.dedup && body && body.dedupKey) {
    const existing = await env.DB
      .prepare(`SELECT id FROM ${cfg.table} WHERE dedup_key = ?`)
      .bind(String(body.dedupKey))
      .first();
    if (existing && existing.id != null) return updateRow(env, cfg, existing.id, body);
  }
  const cols = cfg.fields.map(([, col]) => col);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const row = await env.DB.prepare(sql).bind(...valuesFrom(cfg, body)).first();
  return json(toApi(cfg, row), 201);
}

async function updateRow(env, cfg, id, body) {
  const assignments = cfg.fields.map(([, col]) => `${col} = ?`).join(', ');
  const sql = `UPDATE ${cfg.table} SET ${assignments}, updated_at = datetime('now') WHERE id = ? RETURNING *`;
  const row = await env.DB.prepare(sql).bind(...valuesFrom(cfg, body), id).first();
  if (!row) return json({ error: `Row ${id} not found` }, 404);
  return json(toApi(cfg, row));
}

async function deleteRow(env, cfg, id) {
  await env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

// ── FedEx Tracking proxy ────────────────────────────────────────────────────
// Uses FedEx's own internal web endpoint — no API credentials required.
// Returns: { status, deliveredAt, deliveredAtIso, description, events[] }

function pad2(n) { return String(n).padStart(2, '0'); }

function parseDateStr(s) {
  // "2026-01-07T10:47:00" or "2026-01-07"
  if (!s) return null;
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

function normStatus(code, desc) {
  const c = (code || '').toUpperCase();
  const d = (desc || '').toLowerCase();
  if (c === 'DL' || d.includes('delivered')) return 'Delivered';
  if (['OD', 'IT', 'AR', 'DP', 'PU', 'AF', 'OC', 'IP'].includes(c) || d.includes('transit') || d.includes('out for delivery') || d.includes('on fedex vehicle')) return 'In Transit';
  if (['RS', 'HL', 'DE', 'CA'].includes(c) || d.includes('return') || d.includes('cancelled')) return 'Returned';
  return 'Pending';
}

function parseFedexWeb(data) {
  // FedEx web endpoint returns TrackPackagesResponse
  const pkg = data?.TrackPackagesResponse?.packageList?.[0];
  if (!pkg) return { status: 'unknown', error: 'No tracking data' };

  const keyStatus = pkg.keyStatus || '';
  const keyStatusCD = pkg.keyStatusCD || '';
  const status = normStatus(keyStatusCD, keyStatus);

  let deliveredAt = '';
  let deliveredAtIso = '';

  if (status === 'Delivered') {
    // actualDeliveryDt: "2026-01-07T10:47:00"
    const dt = parseDateStr(pkg.actualDeliveryDt || pkg.estDeliveryDt || '');
    if (dt) {
      deliveredAt = `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
      deliveredAtIso = dt.toISOString().slice(0, 10);
    }
  }

  const events = (pkg.scanEventList || []).slice(0, 5).map((e) => ({
    date: e.date || e.scanDate || '',
    description: e.status || e.scanDescription || '',
    location: [e.scanLocation, e.city, e.state].filter(Boolean).join(', '),
  }));

  return { status, description: keyStatus, deliveredAt, deliveredAtIso, events };
}

async function handleTrack(trackingNumber) {
  const num = String(trackingNumber || '').trim().replace(/\s+/g, '');
  if (!num) return json({ error: 'Missing tracking number' }, 400);

  const body = new URLSearchParams({
    data: JSON.stringify({
      TrackPackagesRequest: {
        appType: 'WTRK',
        appDeviceType: 'DESKTOP',
        uniqueKey: '',
        processingParameters: {},
        trackingInfoList: [{ trackNumberInfo: { trackingNumber: num, trackingQualifier: '', trackingCarrier: '' } }],
      },
    }),
    action: 'trackpackages',
    locale: 'en_US',
    version: '1',
    format: 'json',
  });

  const r = await fetch('https://www.fedex.com/trackingCal/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': 'https://www.fedex.com',
      'Referer': 'https://www.fedex.com/en-us/tracking.html',
    },
    body,
  });

  if (!r.ok) return json({ error: `FedEx returned ${r.status}` }, 502);
  const data = await r.json();
  return json(parseFedexWeb(data));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ["api","<res>",":id"]

    try {
      // /api/track/:trackingNumber
      if (parts[0] === 'api' && parts[1] === 'track' && parts[2]) {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        return await handleTrack(parts[2]);
      }

      const cfg = parts[0] === 'api' ? RESOURCES[parts[1]] : null;
      if (cfg) {
        const id = parts[2];
        if (!id) {
          if (request.method === 'GET') return await listRows(env, cfg);
          if (request.method === 'POST') return await insertRow(env, cfg, await request.json());
        } else {
          if (request.method === 'PUT') return await updateRow(env, cfg, id, await request.json());
          if (request.method === 'DELETE') return await deleteRow(env, cfg, id);
        }
        return json({ error: 'Method not allowed' }, 405);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500);
    }
  },
};

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
// Requires env vars FEDEX_CLIENT_ID and FEDEX_CLIENT_SECRET (set via
// `wrangler secret put FEDEX_CLIENT_ID` etc.).
// Returns: { status, deliveredAt, deliveredAtIso, latestActivity, events[] }

async function fedexOAuthToken(env) {
  const r = await fetch('https://apis.fedex.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(env.FEDEX_CLIENT_ID)}&client_secret=${encodeURIComponent(env.FEDEX_CLIENT_SECRET)}`,
  });
  if (!r.ok) throw new Error(`FedEx OAuth failed: ${r.status}`);
  const d = await r.json();
  return d.access_token;
}

function parseFedexResponse(data) {
  const pkg = data?.output?.completeTrackResults?.[0]?.trackResults?.[0];
  if (!pkg) return { status: 'unknown', error: 'No tracking data returned' };

  const statusDetail = pkg.latestStatusDetail || {};
  const rawStatus = (statusDetail.code || '').toUpperCase();
  const description = statusDetail.description || '';

  // Normalise to our status values
  let status = 'Pending';
  if (rawStatus === 'DL') status = 'Delivered';
  else if (['OD', 'IT', 'AR', 'DP', 'PU', 'AF'].includes(rawStatus)) status = 'In Transit';
  else if (['RS', 'HL', 'DE', 'CA'].includes(rawStatus)) status = 'Returned';

  // Delivered timestamp
  let deliveredAt = '';
  let deliveredAtIso = '';
  const dateEvents = pkg.dateAndTimes || [];
  const deliveredEvent = dateEvents.find((e) => e.type === 'ACTUAL_DELIVERY');
  if (deliveredEvent && deliveredEvent.dateTime) {
    const dt = new Date(deliveredEvent.dateTime);
    if (!isNaN(dt)) {
      const d2 = (n) => String(n).padStart(2, '0');
      deliveredAt = `${d2(dt.getDate())}.${d2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
      deliveredAtIso = dt.toISOString().slice(0, 10);
    }
  }

  // Scan events (most recent first)
  const scanEvents = (pkg.scanEvents || []).map((e) => ({
    date: e.date || '',
    description: e.eventDescription || '',
    location: [e.scanLocation?.city, e.scanLocation?.stateOrProvinceCode].filter(Boolean).join(', '),
  }));

  return { status, description, deliveredAt, deliveredAtIso, latestActivity: scanEvents[0] || null, events: scanEvents.slice(0, 5) };
}

async function handleTrack(trackingNumber, env) {
  if (!env.FEDEX_CLIENT_ID || !env.FEDEX_CLIENT_SECRET) {
    return json({ error: 'FedEx credentials not configured (set FEDEX_CLIENT_ID and FEDEX_CLIENT_SECRET secrets)' }, 503);
  }
  const num = String(trackingNumber || '').trim().replace(/\s+/g, '');
  if (!num) return json({ error: 'Missing tracking number' }, 400);

  const token = await fedexOAuthToken(env);
  const r = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber: num } }],
    }),
  });
  if (!r.ok) return json({ error: `FedEx API error: ${r.status}` }, 502);
  const data = await r.json();
  return json(parseFedexResponse(data));
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
        return await handleTrack(parts[2], env);
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

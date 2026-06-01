// Cloudflare Worker: REST API over a D1 database for PharmaConsulta tracking rows.
//
// Routes:
//   GET    /api/rows        list all rows
//   POST   /api/rows        insert a row            -> created row (with id)
//   PUT    /api/rows/:id    overwrite a row         -> updated row
//   DELETE /api/rows/:id    delete a row            -> { ok: true }

// [ jsonKey, dbColumn ] in a stable order.
const FIELDS = [
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
  ['comments', 'comments'],
  ['directionRemarks', 'direction_remarks'],
];

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

// DB row (snake_case) -> API row (camelCase).
function toApi(dbRow) {
  const out = { id: dbRow.id };
  for (const [jsonKey, col] of FIELDS) out[jsonKey] = dbRow[col] ?? '';
  return out;
}

function valuesFrom(body) {
  return FIELDS.map(([jsonKey]) => (body && body[jsonKey] != null ? String(body[jsonKey]) : ''));
}

async function listRows(env) {
  const { results } = await env.DB.prepare('SELECT * FROM tracking_rows ORDER BY id').all();
  return json((results || []).map(toApi));
}

async function insertRow(env, body) {
  const cols = FIELDS.map(([, col]) => col);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO tracking_rows (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const row = await env.DB.prepare(sql).bind(...valuesFrom(body)).first();
  return json(toApi(row), 201);
}

async function updateRow(env, id, body) {
  const assignments = FIELDS.map(([, col]) => `${col} = ?`).join(', ');
  const sql = `UPDATE tracking_rows SET ${assignments}, updated_at = datetime('now') WHERE id = ? RETURNING *`;
  const row = await env.DB.prepare(sql).bind(...valuesFrom(body), id).first();
  if (!row) return json({ error: `Row ${id} not found` }, 404);
  return json(toApi(row));
}

async function deleteRow(env, id) {
  await env.DB.prepare('DELETE FROM tracking_rows WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ["api","rows",":id"]

    try {
      if (parts[0] === 'api' && parts[1] === 'rows') {
        const id = parts[2];
        if (!id) {
          if (request.method === 'GET') return await listRows(env);
          if (request.method === 'POST') return await insertRow(env, await request.json());
        } else {
          if (request.method === 'PUT') return await updateRow(env, id, await request.json());
          if (request.method === 'DELETE') return await deleteRow(env, id);
        }
        return json({ error: 'Method not allowed' }, 405);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500);
    }
  },
};

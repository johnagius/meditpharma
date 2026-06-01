// Storage client for saved tracking rows.
//
// When a Cloudflare Worker URL is configured it talks to the D1-backed REST
// API (see worker/). With no URL it falls back to browser localStorage so the
// page keeps working fully offline. Both back-ends expose the same async API:
//   list()            -> [row, ...]
//   save(row)         -> row (with new id)
//   update(id, row)   -> row
//   remove(id)        -> { ok: true }

const LS_KEY = 'pharmaconsulta_tracking_rows';

// Fields persisted for a tracking row (id is assigned by the store).
export const TRACKING_FIELDS = [
  'day', 'date', 'isoDate', 'orderNumber', 'trackingNumber', 'product', 'quantity',
  'productDescription', 'destCity', 'destState', 'account', 'client',
  'deliveredOn', 'deliveredOnIso', 'comments', 'directionRemarks',
];

function pick(row) {
  const out = {};
  for (const f of TRACKING_FIELDS) out[f] = row[f] ?? '';
  return out;
}

function createLocalStore(storage) {
  const read = () => {
    try {
      return JSON.parse(storage.getItem(LS_KEY) || '[]');
    } catch {
      return [];
    }
  };
  const write = (rows) => storage.setItem(LS_KEY, JSON.stringify(rows));

  return {
    backend: 'local',
    async list() {
      return read();
    },
    async save(row) {
      const rows = read();
      const id = rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
      const saved = { id, ...pick(row) };
      rows.push(saved);
      write(rows);
      return saved;
    },
    async update(id, row) {
      const rows = read();
      const idx = rows.findIndex((r) => String(r.id) === String(id));
      if (idx === -1) throw new Error(`Row ${id} not found`);
      rows[idx] = { id: rows[idx].id, ...pick(row) };
      write(rows);
      return rows[idx];
    },
    async remove(id) {
      const rows = read().filter((r) => String(r.id) !== String(id));
      write(rows);
      return { ok: true };
    },
  };
}

function createApiStore(baseUrl, fetchImpl) {
  const base = baseUrl.replace(/\/+$/, '');
  const json = async (res) => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  };
  return {
    backend: 'd1',
    async list() {
      return json(await fetchImpl(`${base}/api/rows`));
    },
    async save(row) {
      return json(await fetchImpl(`${base}/api/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pick(row)),
      }));
    },
    async update(id, row) {
      return json(await fetchImpl(`${base}/api/rows/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pick(row)),
      }));
    },
    async remove(id) {
      return json(await fetchImpl(`${base}/api/rows/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }));
    },
  };
}

export function createStore({ baseUrl = '', fetchImpl, storage } = {}) {
  if (baseUrl && fetchImpl) return createApiStore(baseUrl, fetchImpl);
  if (storage) return createLocalStore(storage);
  throw new Error('createStore needs either a baseUrl+fetchImpl or a storage');
}

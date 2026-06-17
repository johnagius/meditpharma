import { describe, it, expect } from 'vitest';
import {
  buildTrackingRow,
  trackingRowToCells,
  parseProductLines,
  formatDateDDMMYY,
  dateCompact,
  orderNumberFor,
  weekdayName,
  setWeekdayWithinWeek,
  toISODate,
  fromISODate,
  TRACKING_HEADERS,
  TRACKING_KEYS,
  ACCOUNTS,
} from '../src/trackingRow.js';
import { expandState } from '../src/data/states.js';
import { createStore } from '../src/trackingStore.js';
import { HS_CODES } from '../src/data/hsCodes.js';

// 2026-06-01 is a Monday.
const MONDAY = new Date(2026, 5, 1);

describe('date / day helpers', () => {
  it('formats date as dd.mm.yy and compact ddmmyy', () => {
    expect(formatDateDDMMYY(MONDAY)).toBe('01.06.26');
    expect(dateCompact(MONDAY)).toBe('010626');
  });

  it('names the weekday and builds the order number', () => {
    expect(weekdayName(MONDAY)).toBe('Monday');
    expect(orderNumberFor(MONDAY, 1)).toBe('010626-1');
    expect(orderNumberFor(MONDAY, 3)).toBe('010626-3');
  });

  it('round-trips ISO dates', () => {
    expect(toISODate(MONDAY)).toBe('2026-06-01');
    expect(formatDateDDMMYY(fromISODate('2026-06-01'))).toBe('01.06.26');
  });

  it('moves to a chosen weekday within the same Mon–Sun week', () => {
    const friday = setWeekdayWithinWeek(MONDAY, WEEKDAY_INDEX('Friday'));
    expect(weekdayName(friday)).toBe('Friday');
    expect(formatDateDDMMYY(friday)).toBe('05.06.26');
  });
});

function WEEKDAY_INDEX(name) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(name);
}

describe('parseProductLines', () => {
  it('splits "qty x name" and strips *notes*', () => {
    const out = parseProductLines(['2 x XEO 100IU (ENG)', '1 x BOT 50IU (ENG) *this is the 50IU*']);
    expect(out).toEqual([
      { qty: '2', text: 'XEO 100IU (ENG)' },
      { qty: '1', text: 'BOT 50IU (ENG)' },
    ]);
  });

  it('defaults quantity to 1 when no "x" prefix', () => {
    expect(parseProductLines('Ozempic 1mg')).toEqual([{ qty: '1', text: 'Ozempic 1mg' }]);
  });
});

describe('expandState', () => {
  it('expands 2-letter codes, leaves full names alone', () => {
    expect(expandState('NJ')).toBe('New Jersey');
    expect(expandState('ga')).toBe('Georgia');
    expect(expandState('New Jersey')).toBe('New Jersey');
    expect(expandState('')).toBe('');
  });
});

describe('buildTrackingRow', () => {
  const order = {
    recipient: { name: 'Carmine Galdieri', city: 'Cedar Knolls', state: 'NJ' },
    products: [
      { qty: '2', label: 'Xeomin' },
      { qty: '1', label: 'Botox' },
    ],
  };

  it('lists all products and quantities, joined', () => {
    const row = buildTrackingRow(order, 0, MONDAY);
    expect(row.product).toBe('Xeomin, Botox');
    expect(row.quantity).toBe('2,1');
  });

  it('fills day/date from the date', () => {
    const row = buildTrackingRow(order, 0, MONDAY);
    expect(row.day).toBe('Monday');
    expect(row.date).toBe('01.06.26');
  });

  it('builds the order number per merchant strategy', () => {
    // Activa: ddmmyyyy-<PDF order number>, date-linked.
    expect(buildTrackingRow({ ...order, merchant: 'Activa', orderId: '7' }, 0, MONDAY).orderNumber)
      .toBe('01062026-7');
    // PDMS: ddmmyyyy-<generated sequence> (app.js supplies the suffix).
    expect(buildTrackingRow({ ...order, merchant: 'PDMS', orderId: '3' }, 0, MONDAY).orderNumber)
      .toBe('01062026-3');
    // Other merchants: PDF order number verbatim, no date prefix.
    expect(buildTrackingRow({ ...order, merchant: 'Krypton 2', orderId: '10101294' }, 0, MONDAY).orderNumber)
      .toBe('10101294');
    // No order number in the PDF -> blank for non-date-prefixed merchants.
    expect(buildTrackingRow(order, 0, MONDAY).orderNumber).toBe('');
  });

  it('takes city + full state name + client from the order', () => {
    const row = buildTrackingRow(order, 0, MONDAY);
    expect(row.destCity).toBe('Cedar Knolls');
    expect(row.destState).toBe('New Jersey');
    expect(row.client).toBe('Carmine Galdieri');
  });

  it('uses the rotating HS description for the product description', () => {
    expect(buildTrackingRow(order, 0, MONDAY).productDescription).toBe(HS_CODES[0].description);
    expect(buildTrackingRow(order, 2, MONDAY).productDescription).toBe(HS_CODES[2].description);
  });

  it('defaults account to the first option and delivered-on empty', () => {
    const row = buildTrackingRow(order, 0, MONDAY);
    expect(row.account).toBe(ACCOUNTS[0]);
    expect(row.deliveredOn).toBe('');
  });

  it('pre-fills "From Whom" with Ph.Chi for Ph.Chic, blank otherwise', () => {
    expect(buildTrackingRow(order, 0, MONDAY).fromWhom).toBe('');
    expect(buildTrackingRow({ ...order, merchant: 'PHCHIC' }, 0, MONDAY).fromWhom).toBe('Ph.Chi');
    expect(buildTrackingRow({ ...order, merchant: 'Ph.Chic' }, 0, MONDAY).fromWhom).toBe('Ph.Chi');
    expect(buildTrackingRow({ ...order, merchant: 'Activa' }, 0, MONDAY).fromWhom).toBe('');
  });

  it('stores the owning merchant (for the By Merchant tab), blank when unset', () => {
    expect(buildTrackingRow(order, 0, MONDAY).merchant).toBe('');
    expect(buildTrackingRow({ ...order, merchant: 'Activa' }, 0, MONDAY).merchant).toBe('Activa');
  });

  it('serialises to cells in header order', () => {
    const row = buildTrackingRow(order, 0, MONDAY);
    const cells = trackingRowToCells(row);
    expect(cells.length).toBe(TRACKING_HEADERS.length);
    expect(cells.length).toBe(TRACKING_KEYS.length);
    expect(cells[0]).toBe('Monday');
    expect(cells[4]).toBe('Xeomin, Botox');
  });
});

describe('createStore (localStorage backend)', () => {
  function fakeStorage() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
    };
  }

  it('saves, lists, overwrites and removes rows', async () => {
    const store = createStore({ storage: fakeStorage() });
    expect(store.backend).toBe('local');

    const saved = await store.save({ orderNumber: '010626-1', product: 'Xeomin' });
    expect(saved.id).toBe(1);

    const second = await store.save({ orderNumber: '010626-2' });
    expect(second.id).toBe(2);

    let all = await store.list();
    expect(all).toHaveLength(2);

    const updated = await store.update(1, { orderNumber: '010626-1', product: 'Botox' });
    expect(updated.product).toBe('Botox');

    await store.remove(2);
    all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(1);
  });

  it('updates (not duplicates) a row with the same dedupKey', async () => {
    const store = createStore({ storage: fakeStorage() });
    const a = await store.save({ orderNumber: '010626-1', product: 'Xeomin', dedupKey: 'abc|1' });
    const b = await store.save({ orderNumber: '010626-1', product: 'Xeomin, Botox', dedupKey: 'abc|1' });
    expect(b.id).toBe(a.id); // same row reused
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].product).toBe('Xeomin, Botox'); // updated content
  });

  it('routes to the API backend when a baseUrl + fetch are given', async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, json: async () => ({ id: 7 }) };
    };
    const store = createStore({ baseUrl: 'https://x.workers.dev/', fetchImpl });
    expect(store.backend).toBe('d1');
    const saved = await store.save({ orderNumber: '010626-1' });
    expect(saved.id).toBe(7);
    expect(calls[0].url).toBe('https://x.workers.dev/api/rows');
    expect(calls[0].opts.method).toBe('POST');
  });

  it('supports a separate fedex resource (own path + cells field)', async () => {
    // localStorage backend keeps tracking + fedex rows apart.
    const storage = fakeStorage();
    const fedex = createStore({ storage, resource: 'fedex' });
    const cells = Array.from({ length: 52 }, (_, i) => `c${i}`);
    const saved = await fedex.save({ recipientName: 'Carmine', cells, productKey: 'xeomin' });
    expect(saved.id).toBe(1);
    expect(saved.cells).toEqual(cells);
    expect(saved.recipientName).toBe('Carmine');

    // API backend hits /api/fedex.
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, json: async () => ({ id: 3, cells }) };
    };
    const api = createStore({ baseUrl: 'https://x.workers.dev', fetchImpl, resource: 'fedex' });
    await api.save({ cells });
    expect(calls[0].url).toBe('https://x.workers.dev/api/fedex');
  });
});

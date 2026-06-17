import { describe, it, expect } from 'vitest';
import {
  builtinSeedProducts, buildCatalog, detectFromCatalog, PRODUCT_STATUSES,
} from '../src/data/midCodes.js';
import { builtinSeedHsCodes, activeHsList, HS_CODES } from '../src/data/hsCodes.js';
import { parseRecords, labelWithDose } from '../src/trackingRow.js';

describe('product catalog detection', () => {
  const catalog = buildCatalog(builtinSeedProducts());

  it('keeps built-in regex detection (abbreviations) via merged patterns', () => {
    expect(detectFromCatalog('2 x XEO 100IU (ENG)', catalog).key).toBe('xeomin');
    expect(detectFromCatalog('BOTOX® 100u Vial', catalog).key).toBe('botox');
  });

  it('detects a DB-only product by name and by keyword', () => {
    const custom = buildCatalog([
      { key: 'newdrug', name: 'NewDrug', mid: 'XX', country: 'XX', keywords: 'ND-500, alphadrug', status: 'active' },
    ]);
    expect(detectFromCatalog('Patient ordered NewDrug 10mg', custom).key).toBe('newdrug');
    expect(detectFromCatalog('contains alphadrug component', custom).key).toBe('newdrug');
    expect(detectFromCatalog('unrelated text', custom)).toBe(null);
  });

  it('ignores non-active products', () => {
    const cat = buildCatalog([
      { key: 'botox', name: 'Botox', mid: 'X', country: 'IE', status: 'withdrawn' },
    ]);
    expect(detectFromCatalog('BOTOX® 100u', cat)).toBe(null);
  });

  it('detected catalog products expose `name` (so labels are not dose-only)', () => {
    // Regression: resolveProducts must read `name` for catalog products; reading
    // `label` (undefined here) would yield a dose-only / empty label.
    const d = detectFromCatalog('2 x BOT 50IU (ENG)', catalog);
    expect(d.name).toBe('Botox');
    expect(d.label).toBeUndefined();
    const base = d.name || d.label || '';
    expect(labelWithDose(base, '2 x BOT 50IU (ENG)')).toBe('Botox 50IU (ENG)');
  });

  it('labelWithDose never emits a dose-only label for an empty base', () => {
    expect(labelWithDose('', 'BOT 100IU')).toBe('');
    expect(labelWithDose(undefined, '100u')).toBe('');
  });

  it('seeds one row per built-in product with a status', () => {
    const seed = builtinSeedProducts();
    expect(seed.length).toBeGreaterThan(30);
    expect(seed.every((p) => p.status === 'active' && p.key && p.name)).toBe(true);
    expect(PRODUCT_STATUSES).toContain('withdrawn');
  });
});

describe('HS code list', () => {
  it('falls back to the built-in list when none active', () => {
    expect(activeHsList([])).toBe(HS_CODES);
    expect(activeHsList([{ description: 'x', code: '1', status: 'inactive', position: 0 }])).toBe(HS_CODES);
  });

  it('uses active DB rows ordered by position', () => {
    const rows = [
      { description: 'second', code: '2', status: 'active', position: 1 },
      { description: 'first', code: '1', status: 'active', position: 0 },
    ];
    const list = activeHsList(rows);
    expect(list.map((h) => h.description)).toEqual(['first', 'second']);
  });

  it('seeds from the built-in list', () => {
    expect(builtinSeedHsCodes().length).toBe(HS_CODES.length);
  });
});

describe('parseRecords (catalog import)', () => {
  it('maps CSV columns by header alias', () => {
    const csv = 'Product name,MID,Country,Keywords\nMeriofert,IT123,IT,merional\nLucrin Depot,FR9,FR,leuprorelin';
    const recs = parseRecords(csv, {
      'product name': 'name', mid: 'mid', country: 'country', keywords: 'keywords',
    });
    expect(recs).toHaveLength(2);
    expect(recs[0]).toEqual({ name: 'Meriofert', mid: 'IT123', country: 'IT', keywords: 'merional' });
  });

  it('honours quoted CSV fields with commas', () => {
    const csv = 'name,description\n"Botox","contains 100u, sterile"';
    const recs = parseRecords(csv, { name: 'name', description: 'description' });
    expect(recs[0].description).toBe('contains 100u, sterile');
  });
});

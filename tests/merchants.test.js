import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MERCHANTS,
  SOURCE_TO_MERCHANT,
  fingerprint,
  similarity,
  detectMerchant,
  learnExample,
} from '../src/data/merchants.js';
import { createStore } from '../src/trackingStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('merchant fingerprinting', () => {
  it('captures template label words, not the data', () => {
    const tokens = fingerprint(fixture('activa-multi.txt'));
    expect(tokens).toEqual(expect.arrayContaining(['shipping', 'products']));
    // Recipient data should not appear in the fingerprint.
    expect(tokens).not.toContain('carmine');
  });

  it('similarity is 1 for identical token sets, 0 for disjoint', () => {
    expect(similarity(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(similarity(['a'], ['b'])).toBe(0);
  });

  it('two orders from the same merchant fingerprint similarly', () => {
    const a = fingerprint(fixture('activa.txt'));
    const b = fingerprint(fixture('activa-multi.txt'));
    expect(similarity(a, b)).toBeGreaterThan(0.6);
  });
});

describe('detectMerchant', () => {
  it('maps a recognised parser source to a seeded merchant', () => {
    expect(detectMerchant('any', { source: 'activa' })).toMatchObject({ merchant: 'Activa', via: 'format' });
    expect(detectMerchant('any', { source: 'dh' })).toMatchObject({ merchant: 'David Hitchen', via: 'format' });
    // K2 / "ORDER #" format is Krypton 2 (formerly LWA).
    expect(SOURCE_TO_MERCHANT.k2).toBe('Krypton 2');
    expect(detectMerchant('any', { source: 'k2' })).toMatchObject({ merchant: 'Krypton 2', via: 'format' });
  });

  it('falls back to a learned pattern when the format is unknown', () => {
    // Use a brand-free fixture so explicit-name detection doesn't pre-empt it.
    const learned = [learnExample(fixture('activa-multi.txt'), 'LWA', 'sample')];
    const got = detectMerchant(fixture('activa-multi.txt'), { learned });
    expect(got).toMatchObject({ merchant: 'LWA', via: 'learned' });
  });

  it('an explicit brand name beats the shared 2.0 format / learned guess', () => {
    const krypton = fixture('k2.txt'); // prints "Krypton 2.0"
    const phchic = krypton.replace(/Krypton 2\.0/gi, 'PhChic 2.0');
    // Same k2 format + a learned Krypton example, but the text says PhChic.
    const learned = [learnExample(krypton, 'Krypton 2', 'sample')];
    expect(detectMerchant(phchic, { source: 'k2', learned })).toMatchObject({ merchant: 'PHCHIC', via: 'name' });
    expect(detectMerchant(krypton, { source: 'k2', learned })).toMatchObject({ merchant: 'Krypton 2', via: 'name' });
    // Prefers an existing merchant name when provided.
    expect(detectMerchant(phchic, { merchants: ['PHCHIC', 'Krypton 2'] }).merchant).toBe('PHCHIC');
  });

  it('returns null when nothing matches', () => {
    expect(detectMerchant('totally unrelated text here', { learned: [] })).toBeNull();
  });

  it('ships the expected default merchant list', () => {
    expect(DEFAULT_MERCHANTS).toContain('Activa');
    expect(DEFAULT_MERCHANTS).toContain('PHCHIC');
  });
});

describe('createStore for merchants + patterns', () => {
  function fakeStorage() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
    };
  }

  it('stores merchants by name', async () => {
    const store = createStore({ storage: fakeStorage(), resource: 'merchants' });
    const saved = await store.save({ name: 'LWA' });
    expect(saved).toMatchObject({ id: 1, name: 'LWA' });
  });

  it('round-trips a pattern with a tokens array', async () => {
    const store = createStore({ storage: fakeStorage(), resource: 'patterns' });
    const saved = await store.save({ merchant: 'LWA', tokens: ['order', 'shipping'], label: 'x' });
    expect(saved.tokens).toEqual(['order', 'shipping']);
    const calls = [];
    const api = createStore({
      baseUrl: 'https://x.workers.dev',
      fetchImpl: async (url) => { calls.push(url); return { ok: true, json: async () => ({ id: 1 }) }; },
      resource: 'patterns',
    });
    await api.save({ merchant: 'LWA', tokens: [] });
    expect(calls[0]).toBe('https://x.workers.dev/api/patterns');
  });
});

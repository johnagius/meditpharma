import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { buildRow, HEADER_ROW } from '../src/buildRow.js';
import { COLUMN_KEYS } from '../src/data/columns.js';
import { SENDERS } from '../src/data/senders.js';
import { HS_CODES } from '../src/data/hsCodes.js';
import { findProductByKey } from '../src/data/midCodes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.join(
  __dirname,
  '..',
  'batch upload',
  'FedEx_Batch_2026-05-05_8shipments.xlsx'
);

function loadSample() {
  const wb = XLSX.readFile(samplePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
}

describe('buildRow', () => {
  it('has 52 cells, matching the sample column count (A..AZ)', () => {
    expect(COLUMN_KEYS.length).toBe(52);
    const row = buildRow({ recipient: {}, product: null }, 0);
    expect(row.length).toBe(52);
  });

  it('header row matches the sample exactly', () => {
    const sample = loadSample();
    expect(sample[0]).toEqual(HEADER_ROW());
  });

  it('reproduces key fields for row 1 (Robert Aquilina / Robyn McDaniel / Ozempic)', () => {
    const ozempic = findProductByKey('ozempic');
    const row = buildRow(
      {
        recipient: {
          name: 'Robyn McDaniel',
          phone: '9177576225',
          email: 'torobyn@aol.com',
          line1: '242 W 53rd St Apt #62G',
          postcode: '10019',
          state: 'NY',
          city: 'New York',
          country: 'US',
        },
        product: ozempic,
      },
      0
    );
    expect(row.length).toBe(52);
    expect(row[2]).toBe('Robert Aquilina');   // senderContactName
    expect(row[9]).toBe('');                  // senderPostcode — intentionally blank
    expect(row[12]).toBe('Robyn McDaniel');   // recipientContactName
    expect(row[15]).toBe('torobyn@aol.com');  // recipientEmail (real email used as-is)
    expect(row[34]).toBe('4901.99.00.70');    // harmonizedCode — dotted format
    expect(row[35]).toBe('DK');               // manufacturingCountry (Ozempic = DK)
  });

  it('rotates senders by row index', () => {
    const ozempic = findProductByKey('ozempic');
    const row7 = buildRow({ recipient: { name: 'X' }, product: ozempic }, 6);
    expect(row7[2]).toBe(SENDERS[6].name);
    const row9 = buildRow({ recipient: { name: 'X' }, product: ozempic }, 8);
    expect(row9[2]).toBe(SENDERS[8].name);
  });

  it('rotates HS code + description by row index', () => {
    const ozempic = findProductByKey('ozempic');
    for (let i = 0; i < HS_CODES.length; i++) {
      const row = buildRow({ recipient: {}, product: ozempic }, i);
      expect(row[33]).toBe(HS_CODES[i].description);
      expect(row[34]).toBe(HS_CODES[i].code);
    }
  });

  it('uses MID + country from the matched product', () => {
    const crysvita = findProductByKey('crysvita');
    const row = buildRow({ recipient: {}, product: crysvita }, 0);
    expect(row[35]).toBe('NL');
    expect(row[46]).toBe('MID: NLKYOKIR2HOO');
  });

  it('leaves MID blank when no product is provided', () => {
    const row = buildRow({ recipient: {}, product: null }, 0);
    expect(row[35]).toBe('');
    expect(row[46]).toBe('');
  });

  it('splits ZIP+4 postcode: 5-digit zip in postcode cell, full ZIP+4 in line2', () => {
    const idx = COLUMN_KEYS.indexOf('recipientPostcode');
    const idx2 = COLUMN_KEYS.indexOf('recipientLine2');
    const row = buildRow({ recipient: { name: 'Test', postcode: '10014-4925', line2: '' }, product: null }, 0);
    expect(row[idx]).toBe('10014');
    expect(row[idx2]).toBe('10014-4925');
  });

  it('keeps existing line2 when postcode is ZIP+4', () => {
    const idx = COLUMN_KEYS.indexOf('recipientLine2');
    const row = buildRow({ recipient: { name: 'Test', postcode: '10014-4925', line2: 'Apt 5' }, product: null }, 0);
    expect(row[idx]).toBe('Apt 5');
  });
});

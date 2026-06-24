import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');

const MODULE_ORDER = [
  'data/columns.js',
  'data/senders.js',
  'data/hsCodes.js',
  'data/states.js',
  'data/merchants.js',
  'data/stock.js',
  'data/midCodes.js',
  'buildRow.js',
  'trackingRow.js',
  'trackingStore.js',
  'excelExporter.js',
  'pdfReader.js',
  'parsers/activa.js',
  'parsers/dh.js',
  'parsers/k2.js',
  'parsers/pdms.js',
  'parsers/secil.js',
  'parsers/index.js',
  'app.js',
];

const NAMESPACES = {
  'data/columns.js': 'ModColumns',
  'data/senders.js': 'ModSenders',
  'data/hsCodes.js': 'ModHs',
  'data/states.js': 'ModStates',
  'data/merchants.js': 'ModMerchants',
  'data/stock.js': 'ModStock',
  'data/midCodes.js': 'ModMid',
  'buildRow.js': 'ModBuildRow',
  'trackingRow.js': 'ModTrackingRow',
  'trackingStore.js': 'ModTrackingStore',
  'excelExporter.js': 'ModExporter',
  'pdfReader.js': 'ModPdfReader',
  'parsers/activa.js': 'ParserActiva',
  'parsers/dh.js': 'ParserDh',
  'parsers/k2.js': 'ParserK2',
  'parsers/pdms.js': 'ParserPdms',
  'parsers/secil.js': 'ParserSecil',
  'parsers/index.js': 'ParserIndex',
  'app.js': 'AppModule',
};

const IMPORT_TO_NS = {
  './data/columns.js': 'ModColumns',
  './data/senders.js': 'ModSenders',
  './data/hsCodes.js': 'ModHs',
  './data/states.js': 'ModStates',
  './data/merchants.js': 'ModMerchants',
  './data/stock.js': 'ModStock',
  './data/midCodes.js': 'ModMid',
  './buildRow.js': 'ModBuildRow',
  './trackingRow.js': 'ModTrackingRow',
  './trackingStore.js': 'ModTrackingStore',
  './excelExporter.js': 'ModExporter',
  './pdfReader.js': 'ModPdfReader',
  './parsers/index.js': 'ParserIndex',
  '../data/columns.js': 'ModColumns',
  '../data/senders.js': 'ModSenders',
  '../data/hsCodes.js': 'ModHs',
  '../data/states.js': 'ModStates',
  '../data/merchants.js': 'ModMerchants',
  '../data/stock.js': 'ModStock',
  '../data/midCodes.js': 'ModMid',
  '../buildRow.js': 'ModBuildRow',
  '../excelExporter.js': 'ModExporter',
  '../pdfReader.js': 'ModPdfReader',
  './activa.js': 'ParserActiva',
  './dh.js': 'ParserDh',
  './k2.js': 'ParserK2',
  './pdms.js': 'ParserPdms',
  './secil.js': 'ParserSecil',
};

function transform(source) {
  let out = source;

  out = out.replace(
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
    (_m, name, spec) => {
      const ns = IMPORT_TO_NS[spec];
      if (!ns) throw new Error(`Unmapped namespace import: ${spec}`);
      return `const ${name} = ${ns};`;
    }
  );

  out = out.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g,
    (_m, names, spec) => {
      const ns = IMPORT_TO_NS[spec];
      if (!ns) throw new Error(`Unmapped named import: ${spec}`);
      const cleaned = names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const lines = cleaned.map((alias) => {
        const m = alias.match(/^(\w+)\s+as\s+(\w+)$/);
        if (m) return `const ${m[2]} = ${ns}.${m[1]};`;
        return `const ${alias} = ${ns}.${alias};`;
      });
      return lines.join('\n');
    }
  );

  out = out.replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1');
  out = out.replace(/export\s+function\s+(\w+)/g, 'function $1');
  out = out.replace(/export\s+const\s+(\w+)/g, 'const $1');
  out = out.replace(/export\s+let\s+(\w+)/g, 'let $1');
  out = out.replace(/export\s+\{[^}]+\};?/g, '');
  out = out.replace(/export\s+default\s+/g, 'const __default__ = ');

  return out;
}

function exportsFromSource(source) {
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+const\s+(\w+)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+let\s+(\w+)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return Array.from(names);
}

async function buildModule(rel) {
  const file = path.join(srcDir, rel);
  const src = await fs.readFile(file, 'utf8');
  const exports = exportsFromSource(src);
  const ns = NAMESPACES[rel];
  const transformed = transform(src);
  const exportBlock = exports.length
    ? `  return { ${exports.map((n) => `${n}`).join(', ')} };`
    : '  return {};';
  return `// === ${rel} ===\nconst ${ns} = (function () {\n${transformed}\n${exportBlock}\n})();\n`;
}

async function main() {
  const css = await fs.readFile(path.join(srcDir, 'styles.css'), 'utf8');
  const moduleBlocks = [];
  for (const rel of MODULE_ORDER) {
    moduleBlocks.push(await buildModule(rel));
  }
  const bundleJs = moduleBlocks.join('\n') + `
window.AppModule = AppModule;
window.ModBuildRow = ModBuildRow;
window.ModExporter = ModExporter;
window.ModMid = ModMid;
window.ModPdfReader = ModPdfReader;
window.ParserIndex = ParserIndex;
`;

  const BUILD_STAMP = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const PDFJS_VERSION = '3.11.174';
  const XLSX_VERSION = '0.18.5';
  const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
  const PDFJS_WORKER_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const XLSX_CDN = `https://cdn.jsdelivr.net/npm/xlsx@${XLSX_VERSION}/dist/xlsx.full.min.js`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Meditpharma — Shipment & Order Management</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23f97316'/%3E%3Ctext x='8' y='12' text-anchor='middle' font-size='10' font-family='sans-serif' fill='%23ffffff' font-weight='900'%3EMP%3C/text%3E%3C/svg%3E">
<style>
${css}
</style>
</head>
<body>
<div id="app-shell">
<header>
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">MP</div>
    <div class="brand-text">
      <h1>Meditpharma</h1>
      <span class="brand-sub">Shipment &amp; Order Management</span>
    </div>
  </div>
  <div class="brand-status">
    <div class="hstat"><strong id="hs-orders" style="color:var(--accent)">—</strong><span>Batch</span></div>
    <div class="hstat"><strong id="hs-today" style="color:var(--tok)">—</strong><span>Today</span></div>
    <div class="hstat"><strong id="hs-transit" style="color:var(--twarn)">—</strong><span>Transit</span></div>
    <div class="hstat"><strong id="hs-total" style="color:var(--tacc)">—</strong><span>All-Time</span></div>
  </div>
</header>
<main>
  <nav class="tabs" role="tablist">
    <button class="tab active" id="tab-builder" data-panel="panel-builder" type="button">Builder</button>
    <button class="tab" id="tab-fedex" data-panel="panel-fedex" type="button">Saved FedEx</button>
    <button class="tab" id="tab-tracking" data-panel="panel-tracking" type="button">Saved Tracking</button>
    <button class="tab" id="tab-bymerchant" data-panel="panel-bymerchant" type="button">By Merchant</button>
    <button class="tab" id="tab-today" data-panel="panel-today" type="button">Today</button>
    <button class="tab" id="tab-master" data-panel="panel-master" type="button">Master List</button>
    <button class="tab" id="tab-stock" data-panel="panel-stock" type="button">Stock</button>
    <button class="tab" id="tab-catalog" data-panel="panel-catalog" type="button">Catalog</button>
    <button class="tab" id="tab-merchants" data-panel="panel-merchants" type="button">Merchants</button>
    <button class="tab" id="tab-awb" data-panel="panel-awb" type="button">AWB Checklist</button>
    <button class="tab" id="tab-reports" data-panel="panel-reports" type="button">Reports</button>
    <button class="tab tab-gear" id="btn-settings" type="button" title="Sync settings" aria-label="Sync settings">&#9881;</button>
  </nav>

  <div class="global-settings hidden" id="global-settings">
    <label for="track-api-url">Sync API URL (Cloudflare Worker):</label>
    <input type="text" id="track-api-url" placeholder="https://your-worker.workers.dev (leave blank to use this browser)">
    <button id="btn-track-save-url" type="button">Save URL</button>
    <span>Saving to: <span id="track-backend" class="backend-badge local">this browser (localStorage)</span></span>
  </div>

  <section class="panel active" id="panel-builder">
    <div id="drop-zone" tabindex="0" role="button" aria-label="Upload PDF files">
      <strong>Drop PDFs or folders here</strong>
      <small>&hellip; or click to pick files</small>
      <input type="file" id="file-picker" accept="application/pdf" multiple class="hidden">
      <input type="file" id="folder-picker" webkitdirectory directory multiple class="hidden">
    </div>
    <div class="actions">
      <button id="btn-add-folder" type="button">Add folder</button>
      <button id="btn-clear" class="danger" type="button">Clear</button>
      <button id="btn-download" class="primary" type="button" disabled>Download xlsx</button>
      <button id="btn-fedex-saveall" type="button">Save all to D1</button>
      <button id="btn-add-to-stock" class="flash hidden" type="button">Update Stock Movement Sheet</button>
      <label class="autosave"><input type="checkbox" id="chk-fedex-autosave"> Autosave to D1</label>
    </div>
    <div class="row-summary" id="summary">Drop PDFs above to begin.</div>
    <div id="status" aria-live="polite"></div>
    <div id="fedex-status" aria-live="polite"></div>
    <div class="scroll-box">
      <div id="cards" class="cards" aria-label="Shipments preview"></div>
    </div>

    <section class="section-divider">
      <h2>Tracking sheet</h2>
      <p>One row per order (all products listed together). Edit any cell, tick the rows you want, then use the buttons above the table to save, copy or delete them &mdash; like a spreadsheet. Click any column header to sort or filter by that column.</p>
    </section>
    <div class="track-settings">
      <label class="autosave"><input type="checkbox" id="chk-track-autosave"> Autosave tracking rows</label>
    </div>
    <div id="tracking-dashboard" class="status-dash"></div>
    <div class="actions track-toolbar">
      <input type="text" id="tracking-filter" class="filter-input" placeholder="Filter rows&hellip;">
      <button id="btn-track-save-sel" class="primary" type="button" disabled>Save selected</button>
      <button id="btn-track-copy-sel" type="button" disabled>Copy selected</button>
      <button id="btn-track-delete-sel" class="danger" type="button" disabled>Delete selected</button>
      <span id="track-sel-count" class="sel-count">0 selected</span>
    </div>
    <div id="tracking-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table id="tracking-table" class="track-table" aria-label="Tracking sheet">
        <thead id="tracking-head"></thead>
        <tbody id="tracking-body"></tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-fedex">
    <h2>Saved FedEx shipments</h2>
    <p class="panel-hint">Shipments saved to the database. Click a card to view/edit all fields; Overwrite saves changes back. Download one or all as xlsx.</p>
    <div class="actions">
      <button id="btn-saved-fedex-refresh" class="primary" type="button">Refresh</button>
      <button id="btn-saved-fedex-download" type="button">Download all (xlsx)</button>
    </div>
    <div id="saved-fedex-status" aria-live="polite"></div>
    <div class="scroll-box">
      <div id="saved-fedex-cards" class="cards" aria-label="Saved FedEx shipments"></div>
    </div>
  </section>

  <section class="panel" id="panel-tracking">
    <h2>Saved tracking rows</h2>
    <p class="panel-hint">Tracking rows saved to the database. Edit a cell, tick the rows you want, then use the buttons to save, copy or delete them. Click any column header to sort or filter, or a status total below to filter by delivery status. Refresh to reload.</p>
    <div id="saved-track-dashboard" class="status-dash"></div>
    <div class="actions track-toolbar">
      <input type="text" id="saved-track-filter" class="filter-input" placeholder="Filter rows&hellip;">
      <button id="btn-saved-track-save-sel" class="primary" type="button" disabled>Save selected</button>
      <button id="btn-saved-track-copy-sel" type="button" disabled>Copy selected</button>
      <button id="btn-saved-track-delete-sel" class="danger" type="button" disabled>Delete selected</button>
      <span id="saved-track-sel-count" class="sel-count">0 selected</span>
      <button id="btn-saved-track-paste" type="button">Paste from Excel</button>
      <label class="file-btn">Upload Excel/CSV<input type="file" id="saved-track-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-saved-track-template" type="button">Template</button>
      <button id="btn-saved-track-refresh" type="button">Refresh</button>
      <button id="btn-saved-track-download" type="button">Download all (xlsx)</button>
    </div>
    <div id="saved-track-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table id="saved-track-table" class="track-table" aria-label="Saved tracking rows">
        <thead id="saved-track-head"></thead>
        <tbody id="saved-track-body"></tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-bymerchant">
    <h2>Tracking by merchant</h2>
    <p class="panel-hint">The same saved tracking rows as Saved Tracking, split per merchant. Pick a merchant tab and a date scope (today, all, or a date range). Editing, saving or deleting here writes to the same database, so Saved Tracking stays in sync.</p>
    <div id="bymerchant-subtabs" class="subtabs" role="tablist"></div>
    <div class="actions bm-daterange">
      <div class="seg" id="bm-datemode">
        <button data-mode="today" type="button">Today</button>
        <button data-mode="all" class="active" type="button">All</button>
        <button data-mode="range" type="button">Date range</button>
      </div>
      <label class="inline-field">From <input type="date" id="bm-from"></label>
      <label class="inline-field">To <input type="date" id="bm-to"></label>
      <button id="btn-bm-refresh" type="button">Refresh</button>
    </div>
    <div id="bm-dashboard" class="status-dash"></div>
    <div class="actions track-toolbar">
      <input type="text" id="bm-filter" class="filter-input" placeholder="Filter rows&hellip;">
      <button id="btn-bm-save-sel" class="primary" type="button" disabled>Save selected</button>
      <button id="btn-bm-copy-sel" type="button" disabled>Copy selected</button>
      <button id="btn-bm-delete-sel" class="danger" type="button" disabled>Delete selected</button>
      <span id="bm-sel-count" class="sel-count">0 selected</span>
      <button id="btn-bm-paste" type="button">Paste from Excel</button>
      <label class="file-btn">Upload Excel/CSV<input type="file" id="bm-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-bm-template" type="button">Template</button>
      <button id="btn-bm-download" type="button">Download (xlsx)</button>
    </div>
    <div id="bymerchant-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table id="bymerchant-table" class="track-table" aria-label="Tracking by merchant">
        <thead id="bymerchant-head"></thead>
        <tbody id="bymerchant-body"></tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-today">
    <h2>Today's orders</h2>
    <p class="panel-hint">Today's saved tracking rows. Check and fill everything, then <strong>Update master list</strong> to copy them into the Master List. This only adds/updates today's orders &mdash; previously promoted master rows are never touched.</p>
    <div id="today-dashboard" class="status-dash"></div>
    <div class="actions track-toolbar">
      <input type="text" id="today-filter" class="filter-input" placeholder="Filter rows&hellip;">
      <button id="btn-today-save-sel" class="primary" type="button" disabled>Save selected</button>
      <button id="btn-today-copy-sel" type="button" disabled>Copy selected</button>
      <button id="btn-today-delete-sel" class="danger" type="button" disabled>Delete selected</button>
      <span id="today-sel-count" class="sel-count">0 selected</span>
      <button id="btn-today-paste" type="button">Paste from Excel</button>
      <label class="file-btn">Upload Excel/CSV<input type="file" id="today-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-today-template" type="button">Template</button>
      <button id="btn-today-download" type="button">Download (xlsx)</button>
      <button id="btn-today-promote" class="primary" type="button">Update master list &rarr;</button>
      <button id="btn-today-refresh" type="button">Refresh</button>
    </div>
    <div id="today-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table id="today-table" class="track-table" aria-label="Today's orders">
        <thead id="today-head"></thead>
        <tbody id="today-body"></tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-master">
    <h2>Master list</h2>
    <p class="panel-hint">The master record of all orders, stored separately from the live tracking rows. Promote today's orders from the Today tab. Edit a cell, tick rows, then save/copy/delete. Click a column header to sort or filter.</p>
    <div id="master-dashboard" class="status-dash"></div>
    <div class="actions track-toolbar">
      <input type="text" id="master-filter" class="filter-input" placeholder="Filter rows&hellip;">
      <button id="btn-master-save-sel" class="primary" type="button" disabled>Save selected</button>
      <button id="btn-master-copy-sel" type="button" disabled>Copy selected</button>
      <button id="btn-master-delete-sel" class="danger" type="button" disabled>Delete selected</button>
      <span id="master-sel-count" class="sel-count">0 selected</span>
      <button id="btn-master-paste" type="button">Paste from Excel</button>
      <label class="file-btn">Upload Excel/CSV<input type="file" id="master-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-master-template" type="button">Template</button>
      <button id="btn-master-refresh" type="button">Refresh</button>
      <button id="btn-master-download" type="button">Download all (xlsx)</button>
    </div>
    <button id="btn-btrk-toggle" type="button" style="margin:6px 0 0 0">🔍 Bulk Track</button>
    <div class="btrk-panel" id="btrk-panel">
      <div class="btrk-inner">
        <div class="btrk-title">
          <span>🔍 Bulk Tracking Lookup — paste multiple tracking numbers</span>
          <button type="button" onclick="BTRK.close()" style="padding:3px 8px;font-size:10px;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">✕ Close</button>
        </div>
        <div class="btrk-grid">
          <textarea class="btrk-ta" id="btrk-input" placeholder="Paste tracking numbers here — one per line (or comma/space separated)&#10;&#10;887619865122&#10;871248857999&#10;870108661331&#10;..."></textarea>
          <div class="btrk-btns">
            <button type="button" class="primary" onclick="BTRK.lookup()" style="font-size:11px;padding:6px 10px">🔍 Find in Data</button>
            <button type="button" onclick="BTRK.openAll()" style="font-size:11px;padding:6px 10px">↗ Open All on FedEx</button>
            <button type="button" onclick="BTRK.copyResults()" style="font-size:11px;padding:6px 10px">📋 Copy Results</button>
            <button type="button" onclick="BTRK.clear()" style="font-size:11px;padding:6px 10px">↺ Clear</button>
          </div>
        </div>
        <div id="btrk-results"></div>
      </div>
    </div>
    <div id="master-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table id="master-table" class="track-table" aria-label="Master list">
        <thead id="master-head"></thead>
        <tbody id="master-body"></tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-catalog">
    <h2>Catalog</h2>
    <p class="panel-hint">Products and HS codes used for detection and the FedEx/tracking output. Seeded from the built-in list and stored in the database. Use <strong>status</strong> (active / inactive / hold / withdrawn) instead of deleting, so stock movements aren't orphaned. New products auto-detect by name + keywords.</p>

    <h3 class="sub-head">Products</h3>
    <div class="actions">
      <button id="btn-product-add" class="primary" type="button">+ Add product</button>
      <button id="btn-product-template" type="button">Download template</button>
      <button id="btn-product-import" type="button">Import (paste)</button>
      <label class="file-btn">Upload CSV/XLSX<input type="file" id="product-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <label class="inline-field">Show
        <select id="product-status-filter">
          <option value="active">Active</option>
          <option value="all">All</option>
          <option value="inactive">Inactive</option>
          <option value="hold">Hold</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </label>
      <button id="btn-product-refresh" type="button">Refresh</button>
    </div>
    <div id="product-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table class="track-table" aria-label="Products">
        <thead id="products-head"></thead>
        <tbody id="products-body"></tbody>
      </table>
    </div>

    <h3 class="sub-head">HS codes (rotating cosmetic list)</h3>
    <div class="actions">
      <button id="btn-hs-add" class="primary" type="button">+ Add HS code</button>
      <button id="btn-hs-template" type="button">Download template</button>
      <button id="btn-hs-import" type="button">Import (paste)</button>
      <label class="file-btn">Upload CSV/XLSX<input type="file" id="hs-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-hs-refresh" type="button">Refresh</button>
    </div>
    <div id="hs-status" aria-live="polite"></div>
    <div class="scroll-box">
      <table class="track-table" aria-label="HS codes">
        <thead id="hs-head"></thead>
        <tbody id="hs-body"></tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-merchants">
    <h2>Merchants</h2>
    <p class="panel-hint">Merchants are auto-detected from each PDF's format and improve as you correct them. Add new merchants here.</p>
    <div class="actions">
      <input type="text" id="merchant-new" placeholder="New merchant name">
      <button id="btn-merchant-add" class="primary" type="button">Add merchant</button>
      <button id="btn-merchant-refresh" type="button">Refresh</button>
    </div>
    <div id="merchant-status" aria-live="polite"></div>
    <div id="merchant-list" class="merchant-list"></div>
  </section>

  <section class="panel" id="panel-stock">
    <h2>Stock</h2>
    <p class="panel-hint">A controlled stock ledger per merchant. Pull movements from loaded orders as <strong>pending</strong>, map each to a stock item, then <strong>confirm</strong> to apply &mdash; nothing changes your numbers until you confirm. Manage items and export confirmed movements for your sheets.</p>
    <div class="actions">
      <label class="inline-field">Merchant
        <select id="stock-merchant"></select>
      </label>
      <button id="btn-stock-refresh" class="primary" type="button">Refresh</button>
      <button id="btn-stock-from-tracking" type="button">Pull from Tracking &rarr; pending</button>
      <button id="btn-stock-add-manual" type="button">+ Manual movement</button>
    </div>
    <div id="stock-status" aria-live="polite"></div>

    <div id="stock-tracking-picker" class="hidden">
      <h3 class="sub-head">Select tracking rows to add (for merchant chosen above)</h3>
      <div class="actions">
        <button id="btn-stock-picker-add" class="primary" type="button">Add selected &rarr; pending</button>
        <button id="btn-stock-picker-cancel" type="button">Cancel</button>
      </div>
      <div class="scroll-box">
        <table class="track-table" aria-label="Pick tracking rows">
          <thead id="stock-picker-head"></thead>
          <tbody id="stock-picker-body"></tbody>
        </table>
      </div>
    </div>

    <h3 class="sub-head">Pending movements</h3>
    <div class="scroll-box">
      <table id="stock-pending-table" class="track-table" aria-label="Pending stock movements">
        <thead id="stock-pending-head"></thead>
        <tbody id="stock-pending-body"></tbody>
      </table>
    </div>

    <h3 class="sub-head">Stock items &amp; current quantity</h3>
    <div class="actions stock-additem">
      <input type="text" id="si-name" placeholder="Item name">
      <input type="text" id="si-section" placeholder="Section (e.g. MP stock)">
      <input type="text" id="si-country" placeholder="Country">
      <input type="text" id="si-batch" placeholder="Batch">
      <input type="text" id="si-expiry" placeholder="Expiry">
      <input type="text" id="si-opening" placeholder="Opening qty" inputmode="numeric">
      <button id="btn-stock-additem" class="primary" type="button">Add item</button>
    </div>
    <div class="scroll-box">
      <table id="stock-items-table" class="track-table" aria-label="Stock items">
        <thead id="stock-items-head"></thead>
        <tbody id="stock-items-body"></tbody>
      </table>
    </div>
  </section>

  <!-- AWB Checklist panel -->
  <section class="panel" id="panel-awb">
    <div class="actions track-toolbar" style="border-bottom:1px solid var(--border);padding:10px 14px">
      <span style="font-weight:700;font-size:14px">📋 AWB &amp; Invoice Checklist</span>
      <span style="color:var(--muted);font-size:12px">— Complete before uploading to FedEx Ship Manager</span>
      <button type="button" class="primary" onclick="AWB.markAllDone()" style="margin-left:auto">✓ Mark All Done</button>
      <button type="button" onclick="AWB.reset()">↺ Reset</button>
    </div>
    <div class="awb-wrap" id="awb-wrap"></div>
  </section>

  <!-- Reports panel -->
  <section class="panel" id="panel-reports" style="display:flex;flex-direction:column;min-height:0">
    <div class="rpt-toolbar">
      <span style="font-weight:700;font-size:14px">📊 Reports &amp; Master Analytics</span>
      <div class="rpt-vtabs">
        <button class="rpt-vtab on" id="rpt-vtab-report" onclick="RPT.setView('report',this)">📊 Reports</button>
        <button class="rpt-vtab" id="rpt-vtab-master" onclick="RPT.setView('master',this)">📋 Master Table</button>
      </div>
      <select id="rpt-client" onchange="RPT.render()">
        <option value="">All Clients</option>
        <option>Activa</option><option>David Hitchen</option>
        <option>Krypton 2.0</option><option>Krypton 3.0</option>
        <option>PriceMD</option><option>Secil</option><option>PDMS</option>
      </select>
      <select id="rpt-year" onchange="RPT.render()">
        <option value="">All Years</option>
        <option>2024</option><option>2025</option><option>2026</option>
      </select>
      <input type="search" id="rpt-search" placeholder="Search master…" oninput="RPT.filterMaster()" style="width:180px">
      <span class="rpt-count" id="rpt-count">—</span>
      <button type="button" class="primary" onclick="RPT.downloadMaster()">⬇ Full Master Excel</button>
      <button type="button" onclick="RPT.downloadProductReport()">📦 Product Report</button>
      <button type="button" onclick="RPT.downloadClientReport()">👤 Client Report</button>
    </div>
    <div id="rpt-report" class="rpt-wrap"></div>
    <div id="rpt-master-wrap" class="rpt-wrap" style="display:none">
      <div class="scroll-box" style="max-height:none">
        <table class="track-table" aria-label="Master table">
          <thead id="rpt-master-head"></thead>
          <tbody id="rpt-master-body"></tbody>
        </table>
      </div>
    </div>
  </section>

</main>
<footer>
  Meditpharma &middot; runs entirely in your browser &middot; build ${BUILD_STAMP}
</footer>
</div>
<script src="${PDFJS_CDN}" crossorigin="anonymous"></script>
<script src="${XLSX_CDN}" crossorigin="anonymous"></script>
<script>
(function () {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER_CDN}';
  }
})();
</script>
<script>
${bundleJs}

// ── Expose masterRows for AWB/BTRK/RPT ──────────────────────────────────
// Patched into createApp return; we wrap bootstrap to set the getter.
// ────────────────────────────────────────────────────────────────────────

(function bootstrap() {
  document.getElementById('btn-add-folder').addEventListener('click', function () {
    document.getElementById('folder-picker').click();
  });
  window.__appInstance__ = AppModule.createApp({
    document: document,
    window: window,
    pdfjsLib: window.pdfjsLib,
    XLSX: window.XLSX,
  });
  const btrkBtn = document.getElementById('btn-btrk-toggle');
  if (btrkBtn) btrkBtn.addEventListener('click', () => BTRK.toggle());
})();
</script>
<script>
// ── Shared helpers ──────────────────────────────────────────────────────
function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _getMaster(){return(window.__appInstance__&&window.__appInstance__.masterRows)||[];}
function _normStatus(r){const s=String(r.deliveryStatus||'').toLowerCase().trim();if(s==='delivered')return'delivered';if(s==='in transit'||s==='transit')return'transit';if(s==='returned')return'returned';return'pending';}
function _totalQ(product,qty){return String(qty||'').split(',').reduce((s,q)=>s+(parseInt(q)||1),0);}
function _normP(p){if(!p)return'';return String(p).replace(/\s+/g,' ').trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
function _fedexUrl(n){return'https://www.fedex.com/apps/fedextrack/?action=track&trackingnumber='+encodeURIComponent(n)+'&cntry_code=us';}
function _statusBadge(r){const s=_normStatus(r);if(s==='delivered')return'<span style="color:#4ade80;font-weight:700;font-size:11px">✓ Delivered</span>';if(s==='transit')return'<span style="color:#38bdf8;font-weight:700;font-size:11px">🚚 Transit</span>';if(s==='returned')return'<span style="color:#f87171;font-weight:700;font-size:11px">↩ Returned</span>';return'<span style="color:#fbbf24;font-weight:700;font-size:11px">⏳ Pending</span>';}
function _toast(msg,type){const existing=document.getElementById('_quick-toast');const el=existing||document.createElement('div');if(!existing){el.id='_quick-toast';el.style.cssText='position:fixed;top:12px;right:12px;z-index:9999;padding:9px 16px;border-radius:6px;font-size:12px;font-weight:700;max-width:400px;box-shadow:0 6px 24px #0009;line-height:1.4;display:none';document.body.appendChild(el);}el.textContent=msg;el.style.background=type==='err'?'#7F1D1D':type==='warn'?'#78350F':'#14532D';el.style.border='1px solid '+(type==='err'?'#D42B2B':type==='warn'?'#C97A06':'#18A349')+'55';el.style.color='#fff';el.style.display='block';clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',3000);}

// ── AWB Checklist ────────────────────────────────────────────────────────
const AWB=(function(){
  const CHECKS=[
    {id:'c1',title:'Download FedEx Batch Excel',sub:'Click "Download xlsx" in the Builder tab — this is the file you upload to FedEx Ship Manager',icon:'📥'},
    {id:'c2',title:'Log into FedEx Ship Manager',sub:'Go to ship.fedex.com → Ship → Batch Ship → Upload file',icon:'🌐'},
    {id:'c3',title:'Upload batch Excel to FedEx',sub:'Select the downloaded file and submit. Verify all shipments appear correctly.',icon:'⬆'},
    {id:'c4',title:'Review & confirm AWB numbers',sub:'FedEx assigns a tracking number to each shipment. Download or note them.',icon:'📋'},
    {id:'c5',title:'Print / save shipping labels',sub:'Print all labels before packaging.',icon:'🖨'},
    {id:'c6',title:'Generate Commercial Invoice (CI)',sub:'FedEx auto-generates the CI — download and attach to each package.',icon:'📄'},
    {id:'c7',title:'Verify recipient details',sub:'Spot-check names, addresses, and phone numbers match the orders.',icon:'✅'},
    {id:'c8',title:'Pack & attach labels',sub:'Package each order, attach label + CI. Keep a copy of each CI.',icon:'📦'},
    {id:'c9',title:'Hand off to FedEx / drop off',sub:'Note the drop-off time and get a receipt if possible.',icon:'🚚'},
    {id:'c10',title:'Enter tracking numbers into Master',sub:'After FedEx confirms, go to Master List and enter each tracking number.',icon:'🔢'},
  ];
  let done=new Set(JSON.parse(localStorage.getItem('mp_awb_done')||'[]'));
  function save(){try{localStorage.setItem('mp_awb_done',JSON.stringify([...done]));}catch(_){}}
  function chkHtml(c){
    const isDone=done.has(c.id);
    return '<div class="chk-item'+(isDone?' done':'')+'" onclick="AWB.toggle(\''+c.id+'\')">'
      +'<input type="checkbox" '+(isDone?'checked ':'')+' onclick="event.stopPropagation();AWB.toggle(\''+c.id+'\')">'
      +'<div style="width:28px;height:28px;border-radius:6px;background:'+(isDone?'rgba(74,222,128,.15)':'var(--border)')+';display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">'+c.icon+'</div>'
      +'<div class="chk-text"><div class="chk-title" style="'+(isDone?'text-decoration:line-through;color:var(--muted)':'')+'">'+_esc(c.title)+'</div><div class="chk-sub">'+_esc(c.sub)+'</div></div></div>';
  }
  function render(){
    const wrap=document.getElementById('awb-wrap');if(!wrap)return;
    const orders=(window.__appInstance__&&window.__appInstance__.orders)||[];
    const pct=Math.round(done.size/CHECKS.length*100);
    let html='<div style="max-width:860px">'
      +'<div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<span style="font-weight:700;font-size:13px">Today\'s progress</span>'
      +'<span style="font-weight:800;font-size:20px;color:'+(pct===100?'#4ade80':'#fbbf24')+'">'+pct+'%</span></div>'
      +'<div class="awb-progress"><div class="awb-progress-fill" style="width:'+pct+'%"></div></div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:4px">'+done.size+' of '+CHECKS.length+' steps completed &middot; '+orders.length+' order'+(orders.length!==1?'s':'')+' in current batch</div></div>'
      +'<div class="awb-steps"><div>'+CHECKS.slice(0,5).map(chkHtml).join('')+'</div>'
      +'<div>'+CHECKS.slice(5).map(chkHtml).join('')+'</div></div>';
    if(orders.length){
      html+='<div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:16px">'
        +'<div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--accent)">Orders in current batch ('+orders.length+')</div>'
        +orders.map(o=>'<div class="awb-order-row">'
          +'<span style="padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;background:var(--border);color:var(--muted)">'+_esc(o.merchant||o.client||'?')+'</span>'
          +'<span style="font-weight:600">'+_esc((o.recipient&&o.recipient.name)||o.name||'—')+'</span>'
          +'<span style="color:var(--muted);font-size:11px">'+_esc(o.productText||o.product||'')+'</span>'
          +'</div>').join('')
        +'</div>';
    }
    html+='</div>';
    wrap.innerHTML=html;
  }
  function toggle(id){done.has(id)?done.delete(id):done.add(id);save();render();}
  function markAllDone(){CHECKS.forEach(c=>done.add(c.id));save();render();_toast('All steps marked done ✓','ok');}
  function reset(){done.clear();save();render();}
  return{render,toggle,markAllDone,reset};
})();

// ── Bulk Tracking ─────────────────────────────────────────────────────────
const BTRK=(function(){
  function parseNums(raw){return[...new Set(String(raw||'').split(/[\n\r,;\s]+/).map(s=>s.replace(/[^A-Za-z0-9]/g,'').trim()).filter(s=>s.length>=10&&s.length<=24))];}
  function detectCarrier(n){if(/^1Z[A-Z0-9]{16}$/.test(n))return'UPS';if(/^\d{10}$/.test(n)&&n[0]==='3')return'DHL';return'FedEx';}
  function trackUrl(n){const c=detectCarrier(n);if(c==='UPS')return'https://www.ups.com/track?tracknum='+n+'&requester=WT/trackdetails';if(c==='DHL')return'https://www.dhl.com/en/express/tracking.html?AWB='+n+'&brand=DHL&country=MT';return _fedexUrl(n);}
  function toggle(){const p=document.getElementById('btrk-panel');if(!p)return;p.classList.toggle('open');if(p.classList.contains('open'))setTimeout(()=>{const ta=document.getElementById('btrk-input');if(ta)ta.focus();},300);}
  function close(){const p=document.getElementById('btrk-panel');if(p)p.classList.remove('open');}
  function clear(){const ta=document.getElementById('btrk-input'),res=document.getElementById('btrk-results');if(ta)ta.value='';if(res)res.innerHTML='';}
  function lookup(){
    const ta=document.getElementById('btrk-input'),res=document.getElementById('btrk-results');if(!ta||!res)return;
    const nums=parseNums(ta.value);
    if(!nums.length){res.innerHTML='<div class="btrk-empty">No valid tracking numbers found — paste numbers above</div>';return;}
    const byTrack=new Map();
    _getMaster().filter(r=>r.trackingNumber&&r.trackingNumber.length>=10).forEach(r=>byTrack.set(r.trackingNumber.replace(/\s/g,''),r));
    let del=0,trn=0,pnd=0,ret=0,notFound=0;
    const rows=nums.map(num=>{const r=byTrack.get(num);const status=r?_normStatus(r):'unknown';if(status==='delivered')del++;else if(status==='transit')trn++;else if(status==='returned')ret++;else if(status==='pending')pnd++;else notFound++;return{num,r,status};});
    const summaryPills=[
      nums.length+' numbers',
      del?'<span class="btrk-sum-pill" style="background:rgba(74,222,128,.15);color:#4ade80">✓ '+del+' Delivered</span>':'',
      trn?'<span class="btrk-sum-pill" style="background:rgba(56,189,248,.15);color:var(--accent)">🚚 '+trn+' In Transit</span>':'',
      pnd?'<span class="btrk-sum-pill" style="background:rgba(251,191,36,.15);color:#fbbf24">⏳ '+pnd+' Pending</span>':'',
      ret?'<span class="btrk-sum-pill" style="background:rgba(248,113,113,.15);color:#f87171">↩ '+ret+' Returned</span>':'',
      notFound?'<span class="btrk-sum-pill" style="background:rgba(100,116,139,.15);color:var(--muted)">? '+notFound+' Not in data</span>':'',
    ].filter(Boolean);
    const rowsHtml=rows.map(function(obj){
      const num=obj.num,r=obj.r,status=obj.status;
      const stCls=status==='delivered'?'st-delivered':status==='transit'?'st-transit':status==='returned'?'st-returned':'st-pending';
      const badge=status==='delivered'?'<span style="color:#4ade80;font-weight:700;font-size:11px">✓ Delivered</span>'
        :status==='transit'?'<span style="color:var(--accent);font-weight:700;font-size:11px">🚚 Transit</span>'
        :status==='returned'?'<span style="color:#f87171;font-weight:700;font-size:11px">↩ Returned</span>'
        :status==='unknown'?'<span style="color:var(--muted);font-weight:700;font-size:11px">? Not found</span>'
        :'<span style="color:#fbbf24;font-weight:700;font-size:11px">⏳ Pending</span>';
      const statusSel=r?('<select class="btrk-status-sel" onchange="BTRK.updateStatus(\''+_esc(num)+'\',this.value)">'
        +'<option value="Pending" '+(_normStatus(r)==='pending'?'selected':'')+'>⏳ Pending</option>'
        +'<option value="In Transit" '+(_normStatus(r)==='transit'?'selected':'')+'>🚚 In Transit</option>'
        +'<option value="Delivered" '+(_normStatus(r)==='delivered'?'selected':'')+'>✓ Delivered</option>'
        +'<option value="Returned" '+(_normStatus(r)==='returned'?'selected':'')+'>↩ Returned</option>'
        +'</select>'):'<span style="font-size:10px;color:var(--muted)">not in records</span>';
      const info=r?('<span style="color:var(--muted)">'+_esc(r.client||'')+( r.destCity?', '+_esc(r.destCity):'')+' '+_esc(r.destState||'')+' &middot; '+_esc(r.merchant||'')+' &middot; '+_esc(r.product||'')+'</span>')
        :'<span style="color:var(--muted);font-style:italic">Not found locally</span>';
      return '<div class="btrk-row '+stCls+'">'
        +'<div><a class="btrk-trk-a" href="'+_esc(trackUrl(num))+'" target="_blank" rel="noopener">'+_esc(num)+'</a> <span style="font-size:9px;color:var(--muted)">'+detectCarrier(num)+'</span></div>'
        +'<div>'+badge+'</div>'
        +'<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+info+'</div>'
        +'<div>'+statusSel+'</div>'
        +'</div>';
    }).join('');
    res.innerHTML='<div class="btrk-summary"><span style="font-size:11px;color:var(--muted)">'+summaryPills.join('')+'</span></div>'
      +'<div class="btrk-results-list">'+rowsHtml+'</div>';
  }
  function updateStatus(trackingNum,newStatus){
    const r=_getMaster().find(x=>x.trackingNumber&&x.trackingNumber.replace(/\s/g,'')===trackingNum);
    if(!r){_toast('Tracking number not found in master','warn');return;}
    r.deliveryStatus=newStatus;
    if(newStatus==='Delivered'&&!r.deliveredOn){const d=new Date();r.deliveredOn=String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getFullYear()).slice(-2);}
    _toast('✓ Status updated: …'+trackingNum.slice(-6)+' → '+newStatus,'ok');
    lookup();
  }
  function openAll(){
    const ta=document.getElementById('btrk-input');if(!ta)return;
    const nums=parseNums(ta.value);if(!nums.length){_toast('No tracking numbers to open','warn');return;}
    if(nums.length>20&&!confirm('Open '+nums.length+' tabs? Your browser may block popups.'))return;
    nums.forEach(function(n,i){setTimeout(function(){window.open(trackUrl(n),'_blank','noopener');},i*120);});
    _toast('Opening '+nums.length+' tracking pages…','ok');
  }
  async function copyResults(){
    const ta=document.getElementById('btrk-input');if(!ta)return;
    const nums=parseNums(ta.value);if(!nums.length){_toast('Nothing to copy','warn');return;}
    const byTrack=new Map();_getMaster().filter(r=>r.trackingNumber).forEach(r=>byTrack.set(r.trackingNumber.replace(/\s/g,''),r));
    const hdr='Tracking #\tCarrier\tStatus\tRecipient\tCity\tState\tProduct\tMerchant\tDelivered On\tURL';
    const lines=nums.map(n=>{const r=byTrack.get(n);return[n,detectCarrier(n),r?r.deliveryStatus:'unknown',r?r.client||'':'',r?r.destCity||'':'',r?r.destState||'':'',r?r.product||'':'',r?r.merchant||'':'',r?r.deliveredOn||'':'',trackUrl(n)].join('\t');});
    try{await navigator.clipboard.writeText(hdr+'\n'+lines.join('\n'));_toast('✓ Copied '+nums.length+' results to clipboard','ok');}
    catch(_){_toast('Copy unavailable in this context','warn');}
  }
  return{toggle,close,clear,lookup,openAll,copyResults,updateStatus};
})();

// ── Reports ───────────────────────────────────────────────────────────────
const RPT=(function(){
  let view='report';
  function init(){if(view==='report')render();else filterMaster();}
  function setView(v,btn){
    view=v;
    document.querySelectorAll('.rpt-vtab').forEach(b=>b.classList.remove('on'));
    if(btn)btn.classList.add('on');
    const rw=document.getElementById('rpt-report'),mw=document.getElementById('rpt-master-wrap');
    if(rw)rw.style.display=v==='report'?'':'none';
    if(mw)mw.style.display=v==='master'?'':'none';
    if(v==='master')filterMaster();else render();
  }
  function getDataset(){
    const cl=(document.getElementById('rpt-client')||{value:''}).value||'';
    const yr=(document.getElementById('rpt-year')||{value:''}).value||'';
    return _getMaster().filter(r=>{
      if(cl&&r.merchant!==cl&&r.client!==cl)return false;
      if(yr){const parts=String(r.date||'').split('.');if(parts.length===3&&!('20'+parts[2]).startsWith(yr))return false;}
      return true;
    });
  }
  function render(){
    const data=getDataset();const wrap=document.getElementById('rpt-report');if(!wrap)return;
    const totUnits=data.reduce((s,r)=>s+_totalQ(r.product,r.quantity),0);
    const del=data.filter(r=>_normStatus(r)==='delivered').length;
    const trn=data.filter(r=>_normStatus(r)==='transit').length;
    const ret=data.filter(r=>_normStatus(r)==='returned').length;
    const pnd=data.length-del-trn-ret;
    const delRate=data.length?Math.round(del/data.length*100):0;
    let html='<div class="rpt-kpi">'
      +'<div class="kpi-card"><div class="kpi-val" style="color:var(--accent)">'+data.length.toLocaleString()+'</div><div class="kpi-lbl">Total Shipments</div></div>'
      +'<div class="kpi-card"><div class="kpi-val" style="color:#22d3ee">'+totUnits.toLocaleString()+'</div><div class="kpi-lbl">Total Units</div></div>'
      +'<div class="kpi-card"><div class="kpi-val" style="color:#4ade80">'+del.toLocaleString()+'</div><div class="kpi-lbl">Delivered</div><div class="kpi-sub">'+delRate+'% delivery rate</div></div>'
      +'<div class="kpi-card"><div class="kpi-val" style="color:#60a5fa">'+trn.toLocaleString()+'</div><div class="kpi-lbl">In Transit</div></div>'
      +'<div class="kpi-card"><div class="kpi-val" style="color:#fbbf24">'+pnd.toLocaleString()+'</div><div class="kpi-lbl">Pending</div></div>'
      +'<div class="kpi-card"><div class="kpi-val" style="color:#f87171">'+ret.toLocaleString()+'</div><div class="kpi-lbl">Returned</div></div>'
      +'</div>';
    const prodMap={};
    data.forEach(r=>{const prods=String(r.product||'').split(','),qtys=String(r.quantity||'').split(',');prods.forEach((p,i)=>{p=_normP(p.trim());if(!p)return;const q=parseInt(qtys[i])||1;if(!prodMap[p])prodMap[p]={rows:0,units:0};prodMap[p].rows++;prodMap[p].units+=q;});});
    const prodArr=Object.entries(prodMap).sort((a,b)=>b[1].units-a[1].units);
    const maxUnits=prodArr[0]?prodArr[0][1].units:1;
    const clientMap={};
    data.forEach(r=>{const c=r.merchant||r.client||'?';if(!clientMap[c])clientMap[c]={rows:0,units:0,del:0,trn:0,pnd:0,ret:0};clientMap[c].rows++;clientMap[c].units+=_totalQ(r.product,r.quantity);const s=_normStatus(r);if(s==='delivered')clientMap[c].del++;else if(s==='transit')clientMap[c].trn++;else if(s==='returned')clientMap[c].ret++;else clientMap[c].pnd++;});
    html+='<div class="rpt-grid"><div><div class="rpt-h">📦 Top Products by Units Shipped</div>'
      +prodArr.slice(0,20).map(function(e){const p=e[0],s=e[1];return'<div class="bar-row"><span class="bar-lbl" title="'+_esc(p)+'">'+_esc(p)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(s.units/maxUnits*100)+'%"></div></div><span class="bar-val">'+s.units.toLocaleString()+'</span><span style="font-size:9px;color:var(--muted);min-width:28px;text-align:right">'+s.rows+'×</span></div>';}).join('')
      +'</div><div><div class="rpt-h">👤 By Merchant / Client</div>'
      +'<table class="RT"><thead><tr><th>Merchant</th><th class="num">Ships</th><th class="num">Units</th><th class="num">Del</th><th class="num">Transit</th><th class="num">Pending</th></tr></thead><tbody>'
      +Object.entries(clientMap).sort((a,b)=>b[1].units-a[1].units).map(function(e){const c=e[0],s=e[1];return'<tr><td>'+_esc(c)+'</td><td class="num">'+s.rows.toLocaleString()+'</td><td class="num" style="color:#22d3ee;font-weight:700">'+s.units.toLocaleString()+'</td><td class="num" style="color:#4ade80">'+(s.del||0)+'</td><td class="num" style="color:#60a5fa">'+(s.trn||0)+'</td><td class="num" style="color:#fbbf24">'+(s.pnd||0)+'</td></tr>';}).join('')
      +'</tbody></table></div></div>';
    const monthly={};
    data.forEach(r=>{const parts=String(r.date||'').split('.');if(parts.length===3){const m=parts[1]+'.'+parts[2];if(!monthly[m])monthly[m]={units:0,rows:0};monthly[m].units+=_totalQ(r.product,r.quantity);monthly[m].rows++;}});
    const months=Object.entries(monthly).sort((a,b)=>a[0].localeCompare(b[0]));
    if(months.length>1){
      const maxM=Math.max.apply(null,months.map(function(m){return m[1].units;}));
      html+='<div style="margin-bottom:20px"><div class="rpt-h">📅 Monthly Trend (Units)</div>'
        +'<table class="RT"><thead><tr><th>Month</th><th class="num">Shipments</th><th class="num">Units</th><th style="width:45%">Bar</th></tr></thead><tbody>'
        +months.map(function(e){const m=e[0],s=e[1];return'<tr><td>'+_esc(m)+'</td><td class="num">'+s.rows+'</td><td class="num" style="color:#22d3ee">'+s.units.toLocaleString()+'</td><td><div style="background:var(--border);border-radius:3px;height:12px;overflow:hidden"><div style="height:100%;width:'+Math.round(s.units/maxM*100)+'%;background:linear-gradient(90deg,var(--accent),#22d3ee);border-radius:3px"></div></div></td></tr>';}).join('')
        +'</tbody></table></div>';
    }
    const cntEl=document.getElementById('rpt-count');if(cntEl)cntEl.textContent=data.length.toLocaleString()+' shipments \xb7 '+totUnits.toLocaleString()+' units';
    wrap.innerHTML=html;
  }
  function filterMaster(){
    const q=((document.getElementById('rpt-search')||{}).value||'').toLowerCase();
    const base=getDataset();
    const filtered=q?base.filter(r=>[r.client,r.product,r.trackingNumber,r.orderNumber,r.destCity,r.merchant,r.account].join(' ').toLowerCase().includes(q)):base;
    renderMaster(filtered);
    const cntEl=document.getElementById('rpt-count');if(cntEl)cntEl.textContent=filtered.length.toLocaleString()+' rows';
  }
  function renderMaster(rows){
    const thead=document.getElementById('rpt-master-head'),tbody=document.getElementById('rpt-master-body');if(!thead||!tbody)return;
    const COLS=['merchant','date','orderNumber','trackingNumber','product','quantity','account','client','destCity','destState','deliveryStatus','deliveredOn','comments'];
    const LBLS=['Merchant','Date','Order #','Tracking #','Product','Qty','Account','Recipient','City','State','Status','Delivered On','Comments'];
    if(!thead.children.length){const tr=document.createElement('tr');COLS.forEach(function(k,i){const th=document.createElement('th');th.innerHTML='<div style="padding:5px 8px;white-space:nowrap">'+LBLS[i]+'</div>';th.style.minWidth='80px';tr.appendChild(th);});thead.appendChild(tr);}
    const frag=document.createDocumentFragment();
    rows.slice(0,3000).forEach(function(r){const tr=document.createElement('tr');COLS.forEach(function(k){const td=document.createElement('td');if(k==='deliveryStatus')td.innerHTML=_statusBadge(r);else if(k==='trackingNumber'){const n=String(r[k]||'');td.innerHTML=n.length>=10?'<a href="'+_esc(_fedexUrl(n))+'" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">'+_esc(n)+' ↗</a>':_esc(n);}else{td.textContent=r[k]||'';td.style.cssText='white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis';}tr.appendChild(td);});frag.appendChild(tr);});
    tbody.innerHTML='';tbody.appendChild(frag);
  }
  function downloadMaster(){
    if(!window.XLSX){_toast('XLSX library not loaded','err');return;}
    const data=getDataset();
    const hdr=['Merchant','Date','Order #','Tracking #','Product','Qty','Account','Recipient','City','State','Status','Delivered On','Comments','Hub'];
    const rowData=data.map(r=>[r.merchant||'',r.date||'',r.orderNumber||'',r.trackingNumber||'',r.product||'',r.quantity||'',r.account||'',r.client||'',r.destCity||'',r.destState||'',r.deliveryStatus||'',r.deliveredOn||'',r.comments||'',r.directionRemarks||'']);
    const ws=window.XLSX.utils.aoa_to_sheet([hdr,...rowData]);ws['!cols']=hdr.map(()=>({wch:16}));
    const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,'Master');
    const d=new Date();window.XLSX.writeFile(wb,'Master_Tracking_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.xlsx');
    _toast('✓ Downloaded Master Tracking','ok');
  }
  function downloadProductReport(){
    if(!window.XLSX){_toast('XLSX library not loaded','err');return;}
    const data=getDataset();const prodMap={};
    data.forEach(r=>{const prods=String(r.product||'').split(','),qtys=String(r.quantity||'').split(',');prods.forEach((p,i)=>{const cn=_normP(p.trim());if(!cn)return;if(!prodMap[cn])prodMap[cn]={rows:0,units:0};prodMap[cn].rows++;prodMap[cn].units+=parseInt(qtys[i])||1;});});
    const hdr=['Product','Shipments','Total Units'];const rowData=Object.entries(prodMap).sort((a,b)=>b[1].units-a[1].units).map(function(e){return[e[0],e[1].rows,e[1].units];});
    const ws=window.XLSX.utils.aoa_to_sheet([hdr,...rowData]);ws['!cols']=[{wch:30},{wch:12},{wch:12}];
    const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,'Products');window.XLSX.writeFile(wb,'Product_Report_'+new Date().getFullYear()+'.xlsx');
    _toast('✓ Downloaded Product Report','ok');
  }
  function downloadClientReport(){
    if(!window.XLSX){_toast('XLSX library not loaded','err');return;}
    const data=getDataset();const cm={};
    data.forEach(r=>{const c=r.merchant||r.client||'?';if(!cm[c])cm[c]={rows:0,units:0,del:0};cm[c].rows++;cm[c].units+=_totalQ(r.product,r.quantity);if(_normStatus(r)==='delivered')cm[c].del++;});
    const hdr=['Client/Merchant','Shipments','Total Units','Delivered','Delivery Rate %'];const rowData=Object.entries(cm).sort((a,b)=>b[1].units-a[1].units).map(function(e){const c=e[0],s=e[1];return[c,s.rows,s.units,s.del,s.rows?Math.round(s.del/s.rows*100):0];});
    const ws=window.XLSX.utils.aoa_to_sheet([hdr,...rowData]);ws['!cols']=hdr.map(()=>({wch:16}));
    const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,'Clients');window.XLSX.writeFile(wb,'Client_Report_'+new Date().getFullYear()+'.xlsx');
    _toast('✓ Downloaded Client Report','ok');
  }
  return{init,setView,render,filterMaster,downloadMaster,downloadProductReport,downloadClientReport};
})();
</script>
</body>
</html>
`;

  await fs.writeFile(path.join(root, 'index.html'), html, 'utf8');
  process.stdout.write(`Bundled index.html (${(html.length / 1024).toFixed(0)} KiB)\n`);
}

main().catch((err) => {
  process.stderr.write(`bundle failed: ${err.stack || err}\n`);
  process.exit(1);
});

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
  const { SENDERS } = await import(path.join(srcDir, 'data/senders.js'));
  const { PRODUCTS } = await import(path.join(srcDir, 'data/midCodes.js'));
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
  const PDFJS_WORKER_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

  // Inline XLSX from node_modules so the app works without a CDN connection.
  const xlsxLocalPath = path.join(root, 'node_modules/xlsx/dist/xlsx.full.min.js');
  const xlsxInline = await fs.readFile(xlsxLocalPath, 'utf8').catch(() => null);

  // Inline pdfjs from node_modules when available; fallback to CDN.
  const pdfjsLocalPath = path.join(root, 'node_modules/pdfjs-dist/build/pdf.min.js');
  const pdfjsInline = await fs.readFile(pdfjsLocalPath, 'utf8').catch(() => null);
  const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;

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
<!-- ── COMPACT HEADER ──────────────────────────────────────────────────── -->
<header>
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">MP</div>
    <div class="brand-text">
      <div style="font-weight:800;font-size:14px;line-height:1">Meditpharma Pro</div>
      <div style="font-size:9px;color:var(--muted);line-height:1;margin-top:1px;text-transform:uppercase;letter-spacing:.06em">Daily Shipment Workflow</div>
    </div>
  </div>
  <div class="brand-status">
    <div class="hstat"><strong id="hs-orders" style="color:var(--accent)">0</strong><span>Batch</span></div>
    <div class="hstat"><strong id="hs-today" style="color:var(--tok)">0</strong><span>Today</span></div>
    <div class="hstat"><strong id="hs-transit" style="color:var(--twarn)">0</strong><span>Transit</span></div>
    <div class="hstat"><strong id="hs-total" style="color:var(--tacc)">0</strong><span>All-Time</span></div>
    <button id="btn-download" style="background:var(--grn);color:#fff;border:none;padding:6px 14px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px" disabled>⬇ FedEx Excel</button>
    <button id="btn-settings" type="button" title="Sync settings" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:5px;font-size:14px;cursor:pointer">⚙</button>
  </div>
</header>

<!-- ── GLOBAL SETTINGS (hidden by default) ───────────────────────────────── -->
<div class="global-settings hidden" id="global-settings">
  <label for="track-api-url">Sync API URL (Cloudflare Worker):</label>
  <input type="text" id="track-api-url" placeholder="https://your-worker.workers.dev (leave blank to use this browser)">
  <button id="btn-track-save-url" type="button">Save URL</button>
  <span>Saving to: <span id="track-backend" class="backend-badge local">this browser (localStorage)</span></span>
</div>

<main>

<!-- ── WORKFLOW NAV (5 steps) ─────────────────────────────────────────────── -->
<nav id="wf-nav" role="tablist">
  <button class="wf-tab active" id="tab-builder" data-panel="panel-builder" data-step="1" type="button">
    <span class="step-dot">1</span>Order Intake &amp; FedEx Batch
    <span class="step-badge" id="badge-batch">0</span>
  </button>
  <div class="wf-sep"></div>
  <button class="wf-tab" id="tab-awb" data-panel="panel-awb" data-step="2" type="button">
    <span class="step-dot">2</span>AWB &amp; Invoice Checklist
    <span class="step-badge" id="awb-badge">0</span>
  </button>
  <div class="wf-sep"></div>
  <button class="wf-tab" id="tab-today" data-panel="panel-today" data-step="3" type="button">
    <span class="step-dot">3</span>Today&apos;s Dispatch
    <span class="step-badge" id="dis-badge">0</span>
  </button>
  <div class="wf-sep"></div>
  <button class="wf-tab" id="tab-tracking" data-panel="panel-tracking" data-step="4" type="button">
    <span class="step-dot">4</span>Track &amp; Update
    <span class="step-badge" id="trk-badge">0</span>
  </button>
  <div class="wf-sep"></div>
  <button class="wf-tab" id="tab-master" data-panel="panel-master" data-step="5" type="button">
    <span class="step-dot">5</span>Master &amp; Reports
  </button>
</nav>

<!-- ── SECONDARY TABS (sub-tabs per step, contextually shown) ────────────── -->
<div id="sec-tabs">
  <!-- Step 1 sub-tabs -->
  <div class="sec-group" id="sg-1">
    <button class="sec-tab active" data-panel="panel-builder" type="button">📦 Process Orders</button>
    <button class="sec-tab" data-panel="panel-trk-sheet" type="button">📋 Tracking Sheet</button>
    <button class="sec-tab" id="tab-catalog" data-panel="panel-catalog" type="button">🏷 Catalog / MID</button>
    <button class="sec-tab" id="tab-merchants" data-panel="panel-merchants" type="button">🏪 Merchants</button>
    <button class="sec-tab" id="tab-stock" data-panel="panel-stock" type="button">📦 Stock</button>
    <button class="sec-tab" id="tab-senders" data-panel="panel-senders" type="button">🧑 Senders</button>
  </div>
  <!-- Step 2 sub-tabs (none needed) -->
  <!-- Step 3 sub-tabs (none needed) -->
  <!-- Step 4 sub-tabs -->
  <div class="sec-group hidden" id="sg-4">
    <button class="sec-tab active" data-panel="panel-tracking" type="button">📋 Saved Tracking</button>
    <button class="sec-tab" id="tab-bymerchant" data-panel="panel-bymerchant" type="button">🏪 By Merchant</button>
  </div>
  <!-- Step 5 sub-tabs -->
  <div class="sec-group hidden" id="sg-5">
    <button class="sec-tab active" data-panel="panel-master" type="button">📋 Master List</button>
    <button class="sec-tab" id="tab-reports" data-panel="panel-reports" type="button">📊 Reports</button>
  </div>
</div>

<!-- ── PANELS ──────────────────────────────────────────────────────────────── -->

<!-- STEP 1: ORDER INTAKE / FEDEX BATCH -->
<section class="panel active" id="panel-builder">
  <div class="builder-layout">

    <!-- LEFT SIDEBAR -->
    <div class="builder-sidebar">
      <!-- Step 1: Upload -->
      <div class="sidebar-card">
        <div class="sidebar-step-label" style="color:var(--accent)">📁 Step 1 — Upload Files</div>
        <div id="drop-zone" tabindex="0" role="button" aria-label="Upload PDF files" style="padding:20px 14px;margin:0">
          <span style="font-size:28px;display:block;margin-bottom:6px">📂</span>
          <strong style="font-size:12px">Drop files here or click</strong>
          <small style="font-size:11px">PDF &middot; Word &middot; Excel &middot; Text<br>Multiple files at once supported</small>
          <input type="file" id="file-picker" accept="application/pdf" multiple class="hidden">
          <input type="file" id="folder-picker" webkitdirectory directory multiple class="hidden">
        </div>
        <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">
          <button id="btn-add-folder" type="button" style="flex:1;font-size:11px;padding:5px 8px">📂 Folder</button>
          <button id="btn-clear" class="danger" type="button" style="flex:1;font-size:11px;padding:5px 8px">✕ Clear</button>
        </div>
        <label class="autosave" style="margin-top:6px"><input type="checkbox" id="chk-fedex-autosave"> Autosave to D1</label>
      </div>

      <!-- Step 2: Review stats -->
      <div class="sidebar-card">
        <div class="sidebar-step-label" style="color:var(--grn)">✅ Step 2 — Review Orders</div>
        <div class="sidebar-stats">
          <div class="sb-stat"><span class="sb-val" id="sb-total">0</span><span class="sb-lbl">Total</span></div>
          <div class="sb-stat"><span class="sb-val" style="color:var(--grn)" id="sb-ready">0</span><span class="sb-lbl">Ready</span></div>
          <div class="sb-stat"><span class="sb-val" style="color:var(--amb)" id="sb-need">0</span><span class="sb-lbl">Need info</span></div>
          <div class="sb-stat" style="cursor:pointer" title="Click to manage senders" onclick="document.getElementById('tab-senders')&&document.getElementById('tab-senders').click()"><span class="sb-val" style="color:var(--tacc)" id="sb-sender">1/100</span><span class="sb-lbl">Sender</span></div>
        </div>
        <div id="summary" style="font-size:11px;color:var(--muted);margin-top:6px">Drop PDFs above to begin.</div>
        <div id="status" aria-live="polite"></div>
        <div id="fedex-status" aria-live="polite"></div>
      </div>

      <!-- Step 3: Download -->
      <div class="sidebar-card">
        <div class="sidebar-step-label" style="color:var(--tacc)">📥 Step 3 — Download Excel</div>
        <div class="sidebar-dl-stats" id="sb-dl-info" style="font-size:11px;color:var(--muted);margin-bottom:8px"></div>
        <button id="btn-download-sidebar" class="primary" type="button" disabled
          style="width:100%;justify-content:center;background:var(--grn);border:none;padding:8px;font-size:12px;border-radius:5px">
          ⬇ Download FedEx Batch Excel
        </button>
        <button id="btn-fedex-saveall" type="button" style="width:100%;margin-top:5px;font-size:11px;justify-content:center">💾 Save all to D1</button>
        <button id="btn-add-to-stock" class="flash hidden" type="button" style="width:100%;margin-top:5px;font-size:11px">📦 Update Stock Sheet</button>
        <div style="display:flex;gap:6px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
          <button type="button" style="flex:1;font-size:10.5px;padding:4px" onclick="document.querySelectorAll('.panel.active .card').forEach(c=>c.classList.remove('collapsed'))">All ▼</button>
          <button type="button" style="flex:1;font-size:10.5px;padding:4px" onclick="document.querySelectorAll('.panel.active .card').forEach(c=>c.classList.add('collapsed'))">Collapse ▶</button>
        </div>
      </div>

      <!-- Tracking autosave -->
      <div class="sidebar-card" style="border-top:2px solid var(--border)">
        <div class="sidebar-step-label" style="color:var(--pur)">📋 Tracking Sheet</div>
        <label class="autosave" style="font-size:11px"><input type="checkbox" id="chk-track-autosave"> Autosave tracking rows</label>
      </div>
    </div>

    <!-- RIGHT MAIN (orders + tracking) -->
    <div class="builder-main">
      <!-- Orders scroll area -->
      <div class="builder-orders">
        <div id="cards" class="cards" aria-label="Shipments preview"></div>
      </div>
    </div>

  </div>
</section>

<!-- STEP 1 secondary: TRACKING SHEET -->
<section class="panel" id="panel-trk-sheet">
  <!-- Row 1: Filters + Stats -->
  <div style="display:flex;align-items:center;gap:10px;padding:7px 14px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;background:var(--panel-bg)">
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Client
      <select id="trk-filter-client" style="min-width:110px;height:28px;font-size:12px">
        <option value="">All Clients</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Date
      <input type="date" id="trk-filter-date" style="height:28px;font-size:12px;min-width:130px">
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Status
      <select id="trk-filter-status" style="min-width:90px;height:28px;font-size:12px">
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="transit">In Transit</option>
        <option value="delivered">Delivered</option>
        <option value="returned">Returned</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Account
      <select id="trk-filter-account" style="min-width:90px;height:28px;font-size:12px">
        <option value="">All</option>
        <option>Fedex</option>
        <option>Fedex LPN</option>
        <option>Fedex PPS</option>
        <option>Fedex RSW</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Search
      <input type="text" id="tracking-filter" class="filter-input" placeholder="Name · tracking · product…" style="min-width:180px;height:28px;font-size:12px">
    </label>
    <!-- Stats pushed to the right -->
    <div style="margin-left:auto;display:flex;gap:16px;align-items:center">
      <div style="text-align:center;line-height:1.1"><div id="tsh-total" style="font-size:18px;font-weight:800;color:var(--accent)">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Total</div></div>
      <div style="text-align:center;line-height:1.1"><div id="tsh-pending" style="font-size:18px;font-weight:800;color:#fbbf24">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Pending</div></div>
      <div style="text-align:center;line-height:1.1"><div id="tsh-transit" style="font-size:18px;font-weight:800;color:#38bdf8">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Transit</div></div>
      <div style="text-align:center;line-height:1.1"><div id="tsh-delivered" style="font-size:18px;font-weight:800;color:#4ade80">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Delivered</div></div>
      <div style="text-align:center;line-height:1.1"><div id="tsh-returned" style="font-size:18px;font-weight:800;color:#f87171">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Returned</div></div>
    </div>
  </div>
  <!-- Row 2: Actions -->
  <div style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
    <button id="btn-track-save-sel" class="primary" type="button" disabled style="font-size:11px;padding:5px 11px">💾 Save All Edits</button>
    <button id="btn-track-copy-sel" type="button" style="background:#16a34a;color:#fff;border:none;border-radius:5px;font-size:11px;padding:5px 11px;font-weight:700;cursor:pointer">✓ Mark Delivered</button>
    <button id="btn-track-add-row" type="button" style="font-size:11px;padding:5px 11px">＋ Add Row</button>
    <button id="btn-track-delete-sel" class="danger" type="button" disabled style="font-size:11px;padding:5px 11px">✕ Delete</button>
    <span id="track-sel-count" class="sel-count" style="font-size:11px"></span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button id="btn-trk-sheet-dl" type="button" style="background:#f97316;color:#fff;border:none;padding:5px 13px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">↑ Export to Master</button>
      <button id="btn-trk-dl-excel" type="button" style="background:#2563eb;color:#fff;border:none;padding:5px 13px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">⬇ Excel</button>
      <button id="btn-btrk-toggle" type="button" style="background:#7c3aed;color:#fff;border:none;padding:5px 13px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">⬤ Bulk Track</button>
    </div>
  </div>
  <div id="tracking-dashboard" class="status-dash" style="display:none"></div>
  <div id="tracking-status" aria-live="polite" style="padding:2px 14px;font-size:11px;color:var(--muted);flex-shrink:0"></div>
  <div style="overflow:auto;flex:1">
    <table id="tracking-table" class="track-table" aria-label="Tracking sheet">
      <thead id="tracking-head"></thead>
      <tbody id="tracking-body"></tbody>
    </table>
  </div>
</section>

<!-- STEP 1 secondary: CATALOG -->
<section class="panel" id="panel-catalog">
  <div class="p-toolbar">
    <span class="p-title">🏷 Catalog — Products &amp; HS Codes</span>
    <span class="p-hint">Used for auto-detection and FedEx/tracking output. Use status instead of deleting.</span>
  </div>
  <div style="flex:1;overflow-y:auto;padding:14px">
    <div style="font-weight:700;font-size:13px;margin-bottom:10px">Products (MID Codes)</div>
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
    <div class="scroll-box" style="max-height:40vh">
      <table class="track-table" aria-label="Products">
        <thead id="products-head"></thead>
        <tbody id="products-body"></tbody>
      </table>
    </div>

    <div style="font-weight:700;font-size:13px;margin:20px 0 10px">HS Codes (rotating cosmetic list)</div>
    <div class="actions">
      <button id="btn-hs-add" class="primary" type="button">+ Add HS code</button>
      <button id="btn-hs-template" type="button">Download template</button>
      <button id="btn-hs-import" type="button">Import (paste)</button>
      <label class="file-btn">Upload CSV/XLSX<input type="file" id="hs-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-hs-refresh" type="button">Refresh</button>
    </div>
    <div id="hs-status" aria-live="polite"></div>
    <div class="scroll-box" style="max-height:30vh">
      <table class="track-table" aria-label="HS codes">
        <thead id="hs-head"></thead>
        <tbody id="hs-body"></tbody>
      </table>
    </div>
  </div>
</section>

<!-- STEP 1 secondary: MERCHANTS -->
<section class="panel" id="panel-merchants">
  <div class="p-toolbar">
    <span class="p-title">🏪 Merchants</span>
    <span class="p-hint">Auto-detected from PDF format. Add new merchants here.</span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <input type="text" id="merchant-new" placeholder="New merchant name" style="min-width:200px">
      <button id="btn-merchant-add" class="primary" type="button">Add</button>
      <button id="btn-merchant-refresh" type="button">Refresh</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:14px">
    <div id="merchant-status" aria-live="polite"></div>
    <div id="merchant-list" class="merchant-list"></div>
  </div>
</section>

<!-- STEP 1 secondary: STOCK -->
<section class="panel" id="panel-stock">
  <div class="p-toolbar">
    <span class="p-title">📦 Stock Ledger</span>
    <span class="p-hint">Pull movements from orders as pending, confirm to apply. Nothing changes until confirmed.</span>
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <label class="inline-field">Merchant<select id="stock-merchant"></select></label>
      <button id="btn-stock-refresh" class="primary" type="button">Refresh</button>
      <button id="btn-stock-from-tracking" type="button">Pull from Tracking</button>
      <button id="btn-stock-add-manual" type="button">+ Manual</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:14px">
    <div id="stock-status" aria-live="polite"></div>
    <div id="stock-tracking-picker" class="hidden">
      <div style="font-weight:700;font-size:12px;margin-bottom:8px">Select tracking rows to add</div>
      <div class="actions">
        <button id="btn-stock-picker-add" class="primary" type="button">Add selected &rarr; pending</button>
        <button id="btn-stock-picker-cancel" type="button">Cancel</button>
      </div>
      <div class="scroll-box" style="max-height:35vh">
        <table class="track-table" aria-label="Pick tracking rows">
          <thead id="stock-picker-head"></thead>
          <tbody id="stock-picker-body"></tbody>
        </table>
      </div>
    </div>
    <div style="font-weight:700;font-size:12px;margin:14px 0 6px">Pending movements</div>
    <div class="scroll-box" style="max-height:30vh">
      <table id="stock-pending-table" class="track-table" aria-label="Pending stock movements">
        <thead id="stock-pending-head"></thead>
        <tbody id="stock-pending-body"></tbody>
      </table>
    </div>
    <div style="font-weight:700;font-size:12px;margin:14px 0 6px">Stock items &amp; current quantity</div>
    <div class="actions stock-additem">
      <!-- Product dropdown -->
      <div style="display:inline-flex;flex-direction:column;gap:3px">
        <select id="si-name-select" style="min-width:190px;height:32px;font-size:12px">
          <option value="">— Select product —</option>
          ${PRODUCTS.map(p=>`<option value="${p.label.replace(/"/g,'&quot;')}" data-country="${p.country}">${p.label}</option>`).join('\n          ')}
          <option value="__custom__">＋ Custom name…</option>
        </select>
        <input type="text" id="si-name-custom" placeholder="Type custom name…" style="min-width:190px;font-size:12px;display:none">
        <input type="hidden" id="si-name">
      </div>
      <!-- Merchant dropdown (populated from merchant list) -->
      <select id="si-merchant" style="min-width:140px;height:32px;font-size:12px">
        <option value="">— Merchant —</option>
      </select>
      <!-- Batch # -->
      <input type="text" id="si-batch" placeholder="Batch #" style="min-width:100px">
      <!-- Expiry date with calendar -->
      <input type="date" id="si-expiry" title="Expiry date" style="min-width:140px;height:32px;font-size:12px;cursor:pointer">
      <!-- Opening qty -->
      <input type="number" id="si-opening" placeholder="Opening qty" min="0" style="min-width:100px">
      <!-- Hidden legacy fields kept so app.js doesn't break -->
      <input type="hidden" id="si-section">
      <input type="hidden" id="si-country">
      <button id="btn-stock-additem" class="primary" type="button" style="height:32px;padding:0 18px;font-size:12px">Add item</button>
    </div>
    <div class="scroll-box" style="max-height:35vh">
      <table id="stock-items-table" class="track-table" aria-label="Stock items">
        <thead id="stock-items-head"></thead>
        <tbody id="stock-items-body"></tbody>
      </table>
    </div>
  </div>
</section>

<!-- STEP 1 secondary: SENDERS -->
<section class="panel" id="panel-senders">
  <div class="p-toolbar">
    <span class="p-title">🧑 Senders</span>
    <span class="p-hint">Manage the Malta sender pool — rotated by row index on each FedEx batch export.</span>
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <button id="btn-sender-new" class="primary" type="button">＋ New Sender</button>
    </div>
  </div>
  <!-- Add / Edit form (hidden by default) -->
  <div id="sender-form-wrap" class="hidden" style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--panel-bg)">
    <div style="font-weight:700;font-size:12px;margin-bottom:10px" id="sender-form-title">New Sender</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <label style="font-size:11px">Name<input type="text" id="sf-name" placeholder="e.g. Maria Borg" style="width:100%;margin-top:3px"></label>
      <label style="font-size:11px">Street (line1)<input type="text" id="sf-line1" placeholder="e.g. 12 Triq San Pawl" style="width:100%;margin-top:3px"></label>
      <label style="font-size:11px">City<input type="text" id="sf-city" placeholder="e.g. Mosta" style="width:100%;margin-top:3px"></label>
    </div>
    <div style="display:flex;gap:8px">
      <button id="btn-sender-save" class="primary" type="button">Save</button>
      <button id="btn-sender-cancel" type="button">Cancel</button>
    </div>
  </div>
  <!-- Table -->
  <div style="flex:1;overflow-y:auto;padding:14px">
    <div id="sender-status" aria-live="polite" style="margin-bottom:8px"></div>
    <table class="track-table" style="width:100%" aria-label="Senders list">
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th>Name</th>
          <th>Street</th>
          <th>City</th>
          <th style="width:100px">Actions</th>
        </tr>
      </thead>
      <tbody id="sender-tbody">${SENDERS.map((s,i)=>`
        <tr data-idx="${i}">
          <td style="color:var(--muted);font-size:11px">${i+1}</td>
          <td>${s.name}</td>
          <td>${s.line1}</td>
          <td>${s.city}</td>
          <td style="white-space:nowrap">
            <button type="button" style="font-size:11px;padding:3px 8px;margin-right:4px" onclick="SENDERS_UI.edit(${i})">✏ Edit</button>
            <button type="button" class="danger" style="font-size:11px;padding:3px 8px" onclick="SENDERS_UI.del(${i})">✕</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</section>

<!-- STEP 2: AWB CHECKLIST -->
<section class="panel" id="panel-awb">
  <div class="p-toolbar">
    <span class="p-title">📋 AWB &amp; Invoice Checklist</span>
    <span class="p-hint">— Complete before uploading to FedEx Ship Manager</span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button type="button" style="background:var(--grn);color:#fff;border:none;padding:6px 13px;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer" onclick="AWB.markAllDone()">✓ Mark All Done</button>
      <button type="button" onclick="AWB.reset()">↺ Reset</button>
    </div>
  </div>
  <div class="awb-wrap" id="awb-wrap"></div>
</section>

<!-- STEP 3: TODAY'S DISPATCH -->
<section class="panel" id="panel-today">
  <div class="p-toolbar">
    <span class="p-title">📅 Today&apos;s Orders</span>
    <span class="p-hint">Saved tracking rows for today. Fill everything then <strong>Update master list</strong> to promote.</span>
    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button id="btn-today-promote" class="primary" type="button">Update master list &rarr;</button>
      <button id="btn-today-paste" type="button">Paste from Excel</button>
      <label class="file-btn">Upload<input type="file" id="today-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-today-download" type="button">⬇ xlsx</button>
      <button id="btn-today-refresh" type="button">↻</button>
    </div>
  </div>
  <div id="today-dashboard" class="status-dash" style="padding:6px 14px"></div>
  <div class="actions track-toolbar" style="padding:6px 14px;margin:0;border-bottom:1px solid var(--border)">
    <input type="text" id="today-filter" class="filter-input" placeholder="Filter rows&hellip;" style="min-width:160px">
    <button id="btn-today-save-sel" class="primary" type="button" disabled>Save selected</button>
    <button id="btn-today-copy-sel" type="button" disabled>Copy</button>
    <button id="btn-today-delete-sel" class="danger" type="button" disabled>Delete</button>
    <span id="today-sel-count" class="sel-count">0 selected</span>
    <button id="btn-today-template" type="button">Template</button>
  </div>
  <div id="today-status" aria-live="polite" style="padding:2px 14px;font-size:11px;color:var(--muted)"></div>
  <div style="flex:1;overflow:auto">
    <table id="today-table" class="track-table" aria-label="Today's orders">
      <thead id="today-head"></thead>
      <tbody id="today-body"></tbody>
    </table>
  </div>
</section>

<!-- STEP 4: TRACK & UPDATE -->
<section class="panel" id="panel-tracking">
  <!-- Row 1: Filters + Stats -->
  <div style="display:flex;align-items:center;gap:10px;padding:7px 14px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;background:var(--panel-bg)">
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Client
      <select id="st-filter-client" style="min-width:110px;height:28px;font-size:12px">
        <option value="">All Clients</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Date
      <input type="date" id="st-filter-date" style="height:28px;font-size:12px;min-width:130px">
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Status
      <select id="st-filter-status" style="min-width:90px;height:28px;font-size:12px">
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="transit">In Transit</option>
        <option value="delivered">Delivered</option>
        <option value="returned">Returned</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Account
      <select id="st-filter-account" style="min-width:90px;height:28px;font-size:12px">
        <option value="">All</option>
        <option>Fedex</option>
        <option>Fedex LPN</option>
        <option>Fedex PPS</option>
        <option>Fedex RSW</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;gap:2px">
      Search
      <input type="text" id="saved-track-filter" class="filter-input" placeholder="Name · tracking · product…" style="min-width:180px;height:28px;font-size:12px">
    </label>
    <!-- Stats -->
    <div style="margin-left:auto;display:flex;gap:16px;align-items:center">
      <div style="text-align:center;line-height:1.1"><div id="st-total" style="font-size:18px;font-weight:800;color:var(--accent)">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Total</div></div>
      <div style="text-align:center;line-height:1.1"><div id="st-pending" style="font-size:18px;font-weight:800;color:#fbbf24">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Pending</div></div>
      <div style="text-align:center;line-height:1.1"><div id="st-transit" style="font-size:18px;font-weight:800;color:#38bdf8">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Transit</div></div>
      <div style="text-align:center;line-height:1.1"><div id="st-delivered" style="font-size:18px;font-weight:800;color:#4ade80">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Delivered</div></div>
      <div style="text-align:center;line-height:1.1"><div id="st-returned" style="font-size:18px;font-weight:800;color:#f87171">0</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Returned</div></div>
    </div>
  </div>
  <!-- Row 2: Actions -->
  <div style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
    <button id="btn-saved-track-save-sel" class="primary" type="button" disabled style="font-size:11px;padding:5px 11px">💾 Save selected</button>
    <button id="btn-saved-track-copy-sel" type="button" disabled style="font-size:11px;padding:5px 11px">📋 Copy</button>
    <button id="btn-saved-track-delete-sel" class="danger" type="button" disabled style="font-size:11px;padding:5px 11px">✕ Delete</button>
    <span id="saved-track-sel-count" class="sel-count" style="font-size:11px"></span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button id="btn-saved-track-paste" type="button" style="font-size:11px;padding:5px 11px">📥 Paste from Excel</button>
      <label class="file-btn" style="font-size:11px;padding:5px 11px">📂 Upload<input type="file" id="saved-track-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-saved-track-template" type="button" style="font-size:11px;padding:5px 11px">Template</button>
      <button id="btn-saved-track-refresh" type="button" style="font-size:11px;padding:5px 11px">↻ Refresh</button>
      <button id="btn-saved-track-download" type="button" style="background:#2563eb;color:#fff;border:none;padding:5px 13px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">⬇ Excel</button>
    </div>
  </div>
  <div id="saved-track-dashboard" class="status-dash" style="display:none"></div>
  <div id="saved-track-status" aria-live="polite" style="padding:2px 14px;font-size:11px;color:var(--muted)"></div>
  <div style="flex:1;overflow:auto">
    <table id="saved-track-table" class="track-table" aria-label="Saved tracking rows">
      <thead id="saved-track-head"></thead>
      <tbody id="saved-track-body"></tbody>
    </table>
  </div>
</section>

<!-- STEP 4 secondary: BY MERCHANT -->
<section class="panel" id="panel-bymerchant">
  <div class="p-toolbar">
    <span class="p-title">🏪 Tracking by Merchant</span>
    <span class="p-hint">Same rows split per merchant. Editing here writes to the shared database.</span>
    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <div class="seg" id="bm-datemode">
        <button data-mode="today" type="button">Today</button>
        <button data-mode="all" class="active" type="button">All</button>
        <button data-mode="range" type="button">Range</button>
      </div>
      <label class="inline-field">From <input type="date" id="bm-from" style="width:auto"></label>
      <label class="inline-field">To <input type="date" id="bm-to" style="width:auto"></label>
      <button id="btn-bm-refresh" type="button">↻</button>
      <button id="btn-bm-download" type="button">⬇ xlsx</button>
    </div>
  </div>
  <div id="bymerchant-subtabs" class="subtabs" role="tablist" style="padding:6px 14px;border-bottom:1px solid var(--border)"></div>
  <div id="bm-dashboard" class="status-dash" style="padding:4px 14px"></div>
  <div class="actions track-toolbar" style="padding:6px 14px;margin:0;border-bottom:1px solid var(--border)">
    <input type="text" id="bm-filter" class="filter-input" placeholder="Filter rows&hellip;" style="min-width:150px">
    <button id="btn-bm-save-sel" class="primary" type="button" disabled>Save selected</button>
    <button id="btn-bm-copy-sel" type="button" disabled>Copy</button>
    <button id="btn-bm-delete-sel" class="danger" type="button" disabled>Delete</button>
    <span id="bm-sel-count" class="sel-count">0 selected</span>
    <button id="btn-bm-paste" type="button">Paste</button>
    <label class="file-btn">Upload<input type="file" id="bm-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
    <button id="btn-bm-template" type="button">Template</button>
  </div>
  <div id="bymerchant-status" aria-live="polite" style="padding:2px 14px;font-size:11px;color:var(--muted)"></div>
  <div style="flex:1;overflow:auto">
    <table id="bymerchant-table" class="track-table" aria-label="Tracking by merchant">
      <thead id="bymerchant-head"></thead>
      <tbody id="bymerchant-body"></tbody>
    </table>
  </div>
</section>

<!-- STEP 5: MASTER LIST -->
<section class="panel" id="panel-master">
  <div class="p-toolbar">
    <span class="p-title">📋 Master List</span>
    <span class="p-hint">Master record of all orders. Promote today's orders from Step 3. Edit cell → save.</span>
    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button id="btn-btrk-toggle" type="button" style="background:rgba(56,189,248,.12);color:var(--tacc);border:1px solid rgba(56,189,248,.25)">🔍 Bulk Track</button>
      <button id="btn-master-paste" type="button">Paste from Excel</button>
      <label class="file-btn">Upload<input type="file" id="master-file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden></label>
      <button id="btn-master-template" type="button">Template</button>
      <button id="btn-master-refresh" type="button">↻ Refresh</button>
      <button id="btn-master-download" type="button">⬇ xlsx</button>
    </div>
  </div>
  <div class="btrk-panel" id="btrk-panel">
    <div class="btrk-inner">
      <div class="btrk-title">
        <span>🔍 Bulk Tracking Lookup</span>
        <button type="button" onclick="BTRK.close()" style="padding:3px 8px;font-size:10px;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">✕</button>
      </div>
      <div class="btrk-grid">
        <textarea class="btrk-ta" id="btrk-input" placeholder="Paste tracking numbers — one per line&#10;887619865122&#10;871248857999&#10;..."></textarea>
        <div class="btrk-btns">
          <button type="button" class="primary" onclick="BTRK.lookup()" style="font-size:11px;padding:6px 10px">🔍 Find in Data</button>
          <button type="button" onclick="BTRK.openAll()" style="font-size:11px;padding:6px 10px">↗ Open FedEx</button>
          <button type="button" onclick="BTRK.copyResults()" style="font-size:11px;padding:6px 10px">📋 Copy</button>
          <button type="button" onclick="BTRK.clear()" style="font-size:11px;padding:6px 10px">↺ Clear</button>
        </div>
      </div>
      <div id="btrk-results"></div>
    </div>
  </div>
  <div id="master-dashboard" class="status-dash" style="padding:6px 14px"></div>
  <div class="actions track-toolbar" style="padding:6px 14px;margin:0;border-bottom:1px solid var(--border)">
    <input type="text" id="master-filter" class="filter-input" placeholder="Filter rows&hellip;" style="min-width:160px">
    <button id="btn-master-save-sel" class="primary" type="button" disabled>Save selected</button>
    <button id="btn-master-copy-sel" type="button" disabled>Copy</button>
    <button id="btn-master-delete-sel" class="danger" type="button" disabled>Delete</button>
    <span id="master-sel-count" class="sel-count">0 selected</span>
  </div>
  <div id="master-status" aria-live="polite" style="padding:2px 14px;font-size:11px;color:var(--muted)"></div>
  <div style="flex:1;overflow:auto">
    <table id="master-table" class="track-table" aria-label="Master list">
      <thead id="master-head"></thead>
      <tbody id="master-body"></tbody>
    </table>
  </div>
</section>

<!-- STEP 5 secondary: REPORTS -->
<section class="panel" id="panel-reports">
  <div class="rpt-toolbar">
    <span style="font-weight:700;font-size:13px">📊 Reports &amp; Analytics</span>
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
    <input type="search" id="rpt-search" placeholder="Search master…" oninput="RPT.filterMaster()" style="width:160px">
    <span class="rpt-count" id="rpt-count">—</span>
    <button type="button" class="primary" onclick="RPT.downloadMaster()">⬇ Master Excel</button>
    <button type="button" onclick="RPT.downloadProductReport()">📦 Products</button>
    <button type="button" onclick="RPT.downloadClientReport()">👤 Clients</button>
  </div>
  <div id="rpt-report" class="rpt-wrap"></div>
  <div id="rpt-master-wrap" class="rpt-wrap" style="display:none">
    <div style="overflow:auto;max-height:calc(100vh - 200px)">
      <table class="track-table" aria-label="Master table">
        <thead id="rpt-master-head"></thead>
        <tbody id="rpt-master-body"></tbody>
      </table>
    </div>
  </div>
</section>

</main>
<footer>
  Meditpharma Pro &middot; runs entirely in your browser &middot; build ${BUILD_STAMP}
</footer>
</div>
<div id="toast" style="display:none"></div>
${pdfjsInline
  ? `<script>${pdfjsInline}\n(function(){if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS_WORKER_CDN}';}})();</script>`
  : `<script src="${PDFJS_CDN}" crossorigin="anonymous"></script><script>(function(){if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS_WORKER_CDN}';}})();</script>`}
${xlsxInline ? `<script>${xlsxInline}</script>` : `<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" crossorigin="anonymous"></script>`}
<script>
${bundleJs}

(function bootstrap() {
  // Wire folder button
  document.getElementById('btn-add-folder').addEventListener('click', function () {
    document.getElementById('folder-picker').click();
  });

  // Sync sidebar download button → main download button
  const dlSidebar = document.getElementById('btn-download-sidebar');
  const dlMain = document.getElementById('btn-download');
  if (dlSidebar && dlMain) {
    dlSidebar.addEventListener('click', () => dlMain.click());
    // Keep disabled state in sync
    const obs = new MutationObserver(() => {
      dlSidebar.disabled = dlMain.disabled;
    });
    obs.observe(dlMain, { attributes: true, attributeFilter: ['disabled'] });
  }

  window.__appInstance__ = AppModule.createApp({
    document: document,
    window: window,
    pdfjsLib: window.pdfjsLib,
    XLSX: window.XLSX,
  });

  // ── Workflow nav + secondary tabs ──────────────────────────────────────────
  const STEP_MAP = {
    'panel-builder': 1, 'panel-trk-sheet': 1, 'panel-catalog': 1,
    'panel-merchants': 1, 'panel-stock': 1, 'panel-senders': 1,
    'panel-awb': 2,
    'panel-today': 3,
    'panel-tracking': 4, 'panel-bymerchant': 4,
    'panel-master': 5, 'panel-reports': 5,
  };

  function syncNav(activePanelId) {
    const step = STEP_MAP[activePanelId] || 1;
    // Update workflow step dots
    document.querySelectorAll('#wf-nav .wf-tab').forEach(btn => {
      const s = parseInt(btn.dataset.step);
      btn.classList.toggle('active', s === step);
    });
    // Show/hide secondary tab groups
    document.getElementById('sg-1').classList.toggle('hidden', step !== 1);
    document.getElementById('sg-4').classList.toggle('hidden', step !== 4);
    document.getElementById('sg-5').classList.toggle('hidden', step !== 5);
    // Highlight active sec-tab
    document.querySelectorAll('.sec-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === activePanelId);
    });
  }

  // Wire secondary tabs
  document.querySelectorAll('.sec-tab[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Find and click the matching panel's wf-tab or trigger panel activation
      const panelId = btn.dataset.panel;
      // Try to trigger app.js tab activation via the wf-tab if it exists
      const wfBtn = document.querySelector('#wf-nav .wf-tab[data-panel="' + panelId + '"]');
      if (wfBtn) {
        wfBtn.click();
      } else {
        // Secondary panel — activate directly by showing/hiding panels
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(panelId);
        if (target) target.classList.add('active');
        syncNav(panelId);
      }
    });
  });

  // Patch wf-tab clicks to also sync nav
  document.querySelectorAll('#wf-nav .wf-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        const activePanel = document.querySelector('.panel.active');
        if (activePanel) syncNav(activePanel.id);
      }, 0);
    });
  });

  // Bulk track toggle
  const btrkBtn = document.getElementById('btn-btrk-toggle');
  if (btrkBtn) btrkBtn.addEventListener('click', () => BTRK.toggle());

  // ── Update header stats from master rows ───────────────────────────────────
  function updateHeaderStats() {
    const master = (window.__appInstance__ && window.__appInstance__.masterRows) || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = master.filter(r => (r.date || '').slice(0, 10) === today);
    const transitRows = master.filter(r => {
      const s = String(r.deliveryStatus || '').toLowerCase();
      return s === 'in transit' || s === 'transit';
    });
    const hs = id => document.getElementById(id);
    if (hs('hs-today')) hs('hs-today').textContent = todayRows.length;
    if (hs('hs-transit')) hs('hs-transit').textContent = transitRows.length;
    if (hs('hs-total')) hs('hs-total').textContent = master.length;
  }
  // Update stats when master panel becomes active
  document.getElementById('tab-master').addEventListener('click', () => setTimeout(updateHeaderStats, 500));
  document.getElementById('tab-reports').addEventListener('click', () => setTimeout(updateHeaderStats, 500));

  // Initial sync
  syncNav('panel-builder');
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

// ── Senders Manager ──────────────────────────────────────────────────────────
const SENDERS_UI=(function(){
  // Live copy of the sender pool — starts from the bundled ModSenders.SENDERS
  let pool=[];
  let editIdx=-1; // -1 = new, >=0 = editing

  function _builtIn(){return ModSenders&&ModSenders.SENDERS?ModSenders.SENDERS.map(s=>Object.assign({},s)):[];}

  function _load(){
    const base=_builtIn();
    // Only use localStorage if it has MORE entries than built-in (user has added custom senders)
    try{
      const saved=localStorage.getItem('_senders_pool');
      if(saved){
        const parsed=JSON.parse(saved);
        pool=parsed.length>=base.length?parsed:base;
      }else{pool=base;}
    }catch(_){pool=base;}
    _pushToModule();
  }

  function _save(){
    try{localStorage.setItem('_senders_pool',JSON.stringify(pool));}catch(_){}
    _pushToModule();
  }

  // Push updated pool back so buildRow.js picks it up via ModSenders.SENDERS
  function _pushToModule(){
    if(ModSenders)ModSenders.SENDERS=pool;
  }

  function _render(){
    const tbody=document.getElementById('sender-tbody');
    if(!tbody)return;
    if(!pool.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No senders. Click ＋ New Sender to add one.</td></tr>';return;}
    tbody.innerHTML=pool.map((s,i)=>'<tr>'
      +'<td style="color:var(--muted);font-size:11px">'+(i+1)+'</td>'
      +'<td>'+_esc(s.name)+'</td>'
      +'<td>'+_esc(s.line1)+'</td>'
      +'<td>'+_esc(s.city)+'</td>'
      +'<td style="white-space:nowrap">'
        +'<button type="button" style="font-size:11px;padding:3px 8px;margin-right:4px" onclick="SENDERS_UI.edit('+i+')">✏ Edit</button>'
        +'<button type="button" class="danger" style="font-size:11px;padding:3px 8px" onclick="SENDERS_UI.del('+i+')">✕</button>'
      +'</td>'
    +'</tr>').join('');
    // Keep sidebar sender counter in sync
    const sbEl=document.getElementById('sb-sender');
    if(sbEl){const tot=pool.length;const cur=parseInt(sbEl.textContent)||1;sbEl.textContent=cur+'/'+tot;}
  }

  function _openForm(idx){
    editIdx=idx;
    const wrap=document.getElementById('sender-form-wrap');
    const title=document.getElementById('sender-form-title');
    if(!wrap)return;
    if(idx===-1){
      document.getElementById('sf-name').value='';
      document.getElementById('sf-line1').value='';
      document.getElementById('sf-city').value='';
      if(title)title.textContent='New Sender';
    }else{
      const s=pool[idx];
      document.getElementById('sf-name').value=s.name||'';
      document.getElementById('sf-line1').value=s.line1||'';
      document.getElementById('sf-city').value=s.city||'';
      if(title)title.textContent='Edit Sender #'+(idx+1);
    }
    wrap.classList.remove('hidden');
    document.getElementById('sf-name').focus();
  }

  function _closeForm(){
    const wrap=document.getElementById('sender-form-wrap');
    if(wrap)wrap.classList.add('hidden');
    editIdx=-1;
  }

  function init(){
    _load();
    _render();
    const btnNew=document.getElementById('btn-sender-new');
    if(btnNew)btnNew.addEventListener('click',()=>_openForm(-1));
    const btnSave=document.getElementById('btn-sender-save');
    if(btnSave)btnSave.addEventListener('click',()=>{
      const name=document.getElementById('sf-name').value.trim();
      const line1=document.getElementById('sf-line1').value.trim();
      const city=document.getElementById('sf-city').value.trim();
      if(!name||!line1||!city){_toast('Please fill in Name, Street and City','warn');return;}
      if(editIdx===-1){pool.push({name,line1,city});}
      else{pool[editIdx]={name,line1,city};}
      _save();_closeForm();_render();
      _toast(editIdx===-1?'✓ Sender added':'✓ Sender updated','ok');
    });
    const btnCancel=document.getElementById('btn-sender-cancel');
    if(btnCancel)btnCancel.addEventListener('click',_closeForm);

    // Re-render whenever the panel becomes visible
    document.getElementById('tab-senders')&&document.getElementById('tab-senders').addEventListener('click',()=>setTimeout(_render,50));
  }

  function edit(idx){_openForm(idx);}

  function del(idx){
    if(!confirm('Delete sender "'+pool[idx].name+'"?'))return;
    pool.splice(idx,1);
    _save();_render();
    _toast('Sender deleted','ok');
  }

  return{init,edit,del};
})();
document.addEventListener('DOMContentLoaded',()=>{
  SENDERS_UI.init();

  // ── Track & Update (panel-tracking) dashboard stats ──────────────────────
  function _updateStStats(){
    const rows=document.querySelectorAll('#saved-track-body tr[data-id]');
    let total=0,pending=0,transit=0,delivered=0,returned=0;
    rows.forEach(tr=>{
      if(tr.style.display==='none')return;
      total++;
      const sels=tr.querySelectorAll('select');
      let val='';
      sels.forEach(s=>{const v=s.value.toLowerCase();if(v==='delivered'||v==='in transit'||v==='transit'||v==='returned'||v==='pending')val=v;});
      if(val==='delivered')delivered++;
      else if(val==='in transit'||val==='transit')transit++;
      else if(val==='returned')returned++;
      else pending++;
    });
    const s=id=>document.getElementById(id);
    if(s('st-total'))s('st-total').textContent=total;
    if(s('st-pending'))s('st-pending').textContent=pending;
    if(s('st-transit'))s('st-transit').textContent=transit;
    if(s('st-delivered'))s('st-delivered').textContent=delivered;
    if(s('st-returned'))s('st-returned').textContent=returned;
  }
  const stBody=document.getElementById('saved-track-body');
  if(stBody){
    new MutationObserver(_updateStStats).observe(stBody,{childList:true,subtree:true,characterData:true});
    stBody.addEventListener('change',e=>{if(e.target.tagName==='SELECT')setTimeout(_updateStStats,0);});
  }
  // Filters for Track & Update panel
  function _applyStFilters(){
    const search=(document.getElementById('saved-track-filter')||{value:''}).value.toLowerCase();
    const client=(document.getElementById('st-filter-client')||{value:''}).value.toLowerCase();
    const date=(document.getElementById('st-filter-date')||{value:''}).value;
    const status=(document.getElementById('st-filter-status')||{value:''}).value.toLowerCase();
    const account=(document.getElementById('st-filter-account')||{value:''}).value.toLowerCase();
    document.querySelectorAll('#saved-track-body tr[data-id]').forEach(tr=>{
      const text=tr.textContent.toLowerCase();
      const sels=tr.querySelectorAll('select');
      let rowStatus='',rowAccount='';
      sels.forEach(s=>{const v=s.value.toLowerCase();if(v==='delivered'||v==='in transit'||v==='transit'||v==='returned'||v==='pending')rowStatus=v;else if(v.includes('fedex'))rowAccount=v;});
      let show=true;
      if(search&&!text.includes(search))show=false;
      if(client&&!text.includes(client))show=false;
      if(date){let found=false;tr.querySelectorAll('td').forEach(td=>{if(td.textContent.trim()===date||(td.querySelector('input[type="date"]')&&td.querySelector('input[type="date"]').value===date))found=true;});if(!found)show=false;}
      if(status&&!rowStatus.includes(status))show=false;
      if(account&&!rowAccount.includes(account))show=false;
      tr.style.display=show?'':'none';
    });
    _updateStStats();
  }
  ['saved-track-filter','st-filter-client','st-filter-date','st-filter-status','st-filter-account'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener('input',_applyStFilters);
    if(el)el.addEventListener('change',_applyStFilters);
  });

  // ── Tracking Sheet dashboard stats ──────────────────────────────────────
  function _updateTshStats(){
    const rows=document.querySelectorAll('#tracking-body tr[data-id]');
    let total=0,pending=0,transit=0,delivered=0,returned=0;
    rows.forEach(tr=>{
      total++;
      const sel=tr.querySelector('select.trk-status-sel,select[data-col="deliveryStatus"],.status-sel');
      const val=sel?sel.value.toLowerCase().trim():(tr.dataset.status||'').toLowerCase();
      if(val==='delivered')delivered++;
      else if(val==='in transit'||val==='transit')transit++;
      else if(val==='returned')returned++;
      else pending++;
    });
    const s=id=>document.getElementById(id);
    if(s('tsh-total'))s('tsh-total').textContent=total;
    if(s('tsh-pending'))s('tsh-pending').textContent=pending;
    if(s('tsh-transit'))s('tsh-transit').textContent=transit;
    if(s('tsh-delivered'))s('tsh-delivered').textContent=delivered;
    if(s('tsh-returned'))s('tsh-returned').textContent=returned;
  }
  // Update stats whenever tracking body changes
  const trkBody=document.getElementById('tracking-body');
  if(trkBody)new MutationObserver(_updateTshStats).observe(trkBody,{childList:true,subtree:true,characterData:true});
  // Also update on status dropdown changes (event delegation)
  if(trkBody)trkBody.addEventListener('change',e=>{if(e.target.tagName==='SELECT')setTimeout(_updateTshStats,0);});

  // ── Tracking Sheet — combined filter (search + client + date + status + account) ──
  function _applyTrkFilters(){
    const search=(document.getElementById('tracking-filter')||{value:''}).value.toLowerCase();
    const client=(document.getElementById('trk-filter-client')||{value:''}).value.toLowerCase();
    const date=(document.getElementById('trk-filter-date')||{value:''}).value;
    const status=(document.getElementById('trk-filter-status')||{value:''}).value.toLowerCase();
    const account=(document.getElementById('trk-filter-account')||{value:''}).value.toLowerCase();
    document.querySelectorAll('#tracking-body tr[data-id]').forEach(tr=>{
      const text=tr.textContent.toLowerCase();
      const rowStatus=(tr.querySelector('select')&&tr.querySelector('select').value||'').toLowerCase();
      const rowAccount=(tr.querySelectorAll('select')[1]&&tr.querySelectorAll('select')[1].value||'').toLowerCase();
      let show=true;
      if(search&&!text.includes(search))show=false;
      if(client&&!text.includes(client))show=false;
      if(date){const cells=tr.querySelectorAll('td');let found=false;cells.forEach(td=>{if(td.textContent.trim()===date||td.querySelector('input[type="date"]')&&td.querySelector('input[type="date"]').value===date)found=true;});if(!found)show=false;}
      if(status&&!rowStatus.includes(status))show=false;
      if(account&&!rowAccount.includes(account))show=false;
      tr.style.display=show?'':'none';
    });
    _updateTshStats();
  }
  ['tracking-filter','trk-filter-client','trk-filter-date','trk-filter-status','trk-filter-account'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener('input',_applyTrkFilters);
    if(el)el.addEventListener('change',_applyTrkFilters);
  });

  // Populate client dropdown from tracking rows when panel opens
  document.getElementById('tab-catalog')&&document.querySelector('.sec-tab[data-panel="panel-trk-sheet"]')&&
  document.querySelector('.sec-tab[data-panel="panel-trk-sheet"]').addEventListener('click',()=>{
    setTimeout(()=>{
      const sel=document.getElementById('trk-filter-client');
      if(!sel)return;
      const clients=new Set();
      document.querySelectorAll('#tracking-body tr[data-id]').forEach(tr=>{
        const tds=tr.querySelectorAll('td');
        // client is typically in a specific column — grab all text, extract unique names
        tds.forEach(td=>{const t=td.textContent.trim();if(t&&t.length>1&&t.length<40&&!/^\d/.test(t))clients.add(t);});
      });
      // Keep "All Clients" option, rebuild rest
      while(sel.options.length>1)sel.remove(1);
      Array.from(clients).sort().slice(0,60).forEach(c=>{const o=document.createElement('option');o.value=c.toLowerCase();o.textContent=c;sel.appendChild(o);});
      _updateTshStats();
    },200);
  });

  // ── Stock item-name select — populate from product catalog ──────────────
  const siSelect=document.getElementById('si-name-select');
  const siCustom=document.getElementById('si-name-custom');
  const siHidden=document.getElementById('si-name');
  const siCountryEl=document.getElementById('si-country');
  function _siSync(){
    if(!siSelect)return;
    const val=siSelect.value;
    if(val==='__custom__'){
      if(siCustom)siCustom.style.display='';
      if(siHidden)siHidden.value=siCustom?siCustom.value.trim():'';
    } else {
      if(siCustom)siCustom.style.display='none';
      if(siHidden)siHidden.value=val;
      // Auto-fill country
      if(siCountryEl&&val){
        const opt=siSelect.querySelector('option[value="'+val.replace(/"/g,'&quot;')+'"]');
        if(opt&&opt.dataset.country&&!siCountryEl.value)siCountryEl.value=opt.dataset.country;
      }
    }
  }
  if(siSelect)siSelect.addEventListener('change',_siSync);
  if(siCustom)siCustom.addEventListener('input',()=>{if(siHidden)siHidden.value=siCustom.value.trim();});
  // After app.js adds an item it clears all si-* inputs; reset select too
  const stockAddBtn=document.getElementById('btn-stock-additem');
  if(stockAddBtn){
    stockAddBtn.addEventListener('click',()=>{
      setTimeout(()=>{
        if(siSelect)siSelect.value='';
        if(siCustom){siCustom.value='';siCustom.style.display='none';}
        if(siHidden)siHidden.value='';
      },50);
    });
  }

  // ── Tracking Sheet — Download Excel ─────────────────────────────────────
  const dlBtn=document.getElementById('btn-trk-dl-excel');
  if(dlBtn){
    dlBtn.addEventListener('click',()=>{
      if(!window.XLSX){_toast('XLSX library not loaded','err');return;}
      // Read directly from the rendered table — captures exactly what the user sees
      const tbody=document.getElementById('tracking-body');
      const hdrRow=document.querySelector('#tracking-head tr');
      // Skip first th (checkbox column) and collect header labels
      const allThs=hdrRow?Array.from(hdrRow.querySelectorAll('th')):[];
      const hdr=allThs.slice(1).map(th=>th.textContent.trim());
      const data=[];
      if(tbody){
        tbody.querySelectorAll('tr').forEach(tr=>{
          // Skip first td (checkbox column)
          const cells=Array.from(tr.querySelectorAll('td')).slice(1);
          const row=cells.map(td=>{
            const inp=td.querySelector('input[type="text"],input[type="date"]');
            const sel=td.querySelector('select');
            if(inp)return inp.value;
            if(sel)return sel.value;
            return td.textContent.trim();
          });
          if(row.length)data.push(row);
        });
      }
      if(!data.length){_toast('No tracking rows to export','warn');return;}
      const ws=window.XLSX.utils.aoa_to_sheet([hdr,...data]);
      ws['!cols']=hdr.map(()=>({wch:16}));
      const wb=window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb,ws,'Tracking');
      const d=new Date();
      const fname='Tracking_Sheet_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.xlsx';
      window.XLSX.writeFile(wb,fname);
      _toast('✓ Downloaded '+fname,'ok');
    });
  }
});

// ── Right-click context menu for tracking tables ─────────────────────────
(function(){
  // Inject menu styles
  const style=document.createElement('style');
  style.textContent=[
    '#ctx-menu{position:fixed;z-index:9999;background:#1e2535;border:1px solid #334155;border-radius:8px;box-shadow:0 8px 32px #0008;padding:4px 0;min-width:210px;display:none;font-size:12px;font-family:inherit}',
    '#ctx-menu .ctx-item{display:flex;align-items:center;gap:9px;padding:7px 14px;cursor:pointer;color:#e2e8f0;white-space:nowrap;transition:background .1s}',
    '#ctx-menu .ctx-item:hover{background:#2d3f5c;color:#fff}',
    '#ctx-menu .ctx-item .ctx-icon{width:16px;text-align:center;flex-shrink:0}',
    '#ctx-menu .ctx-sep{height:1px;background:#334155;margin:4px 0}',
    '#ctx-menu .ctx-label{padding:4px 14px 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;pointer-events:none}',
    '#ctx-menu .ctx-item.danger{color:#f87171}',
    '#ctx-menu .ctx-item.danger:hover{background:#450a0a;color:#fca5a5}',
    '#ctx-menu .ctx-item.success{color:#4ade80}',
    '#ctx-menu .ctx-item.success:hover{background:#052e16;color:#86efac}',
  ].join('\n');
  document.head.appendChild(style);

  // Build menu element
  const menu=document.createElement('div');
  menu.id='ctx-menu';
  menu.innerHTML=[
    '<div class="ctx-label">Tracking row</div>',
    '<div class="ctx-item" id="ctx-fedex"><span class="ctx-icon">&#x1F50D;</span>Track on FedEx</div>',
    '<div class="ctx-item" id="ctx-copy-track"><span class="ctx-icon">&#x1F4CB;</span>Copy Tracking #</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-label">Set status</div>',
    '<div class="ctx-item success" id="ctx-delivered"><span class="ctx-icon">&#x2713;</span>Mark Delivered</div>',
    '<div class="ctx-item" id="ctx-transit"><span class="ctx-icon">&#x1F69A;</span>Mark In Transit</div>',
    '<div class="ctx-item" id="ctx-returned"><span class="ctx-icon">&#x21A9;</span>Mark Returned</div>',
    '<div class="ctx-item" id="ctx-pending"><span class="ctx-icon">&#x23F3;</span>Mark Pending</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-label">Row</div>',
    '<div class="ctx-item" id="ctx-copy-row"><span class="ctx-icon">&#x1F4C4;</span>Copy row (tab-separated)</div>',
    '<div class="ctx-item" id="ctx-duplicate"><span class="ctx-icon">&#x2295;</span>Duplicate row</div>',
    '<div class="ctx-item" id="ctx-insert-below"><span class="ctx-icon">+</span>Insert row below</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-item danger" id="ctx-delete"><span class="ctx-icon">&#x1F5D1;</span>Delete row</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-label">Columns</div>',
    '<div class="ctx-item" id="ctx-reset-cols"><span class="ctx-icon">&#x21BA;</span>Reset column layout</div>',
  ].join('');
  document.body.appendChild(menu);

  let activeRow=null;

  function hide(){menu.style.display='none';activeRow=null;}

  function getCell(tr,label){
    // find cell value by looking at th headers
    const table=tr.closest('table');
    if(!table)return'';
    const ths=table.querySelectorAll('thead th');
    const tds=tr.querySelectorAll('td');
    for(let i=0;i<ths.length;i++){
      if(ths[i].textContent.toLowerCase().includes(label.toLowerCase())){
        const td=tds[i];
        if(!td)continue;
        const inp=td.querySelector('input');
        const sel=td.querySelector('select');
        return(inp?inp.value:sel?sel.value:td.textContent).trim();
      }
    }
    return'';
  }

  function getTrackingNum(tr){
    // Try data attr first, then header-based lookup
    if(tr.dataset.tracking)return tr.dataset.tracking;
    const v=getCell(tr,'tracking');
    if(v&&v!=='Enter tracking #')return v;
    // Fallback: find any cell that looks like a tracking number
    for(const td of tr.querySelectorAll('td')){
      const t=(td.querySelector('input')?td.querySelector('input').value:td.textContent).trim();
      if(/^\d{10,}$/.test(t)||/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(t))return t;
    }
    return'';
  }

  function setStatus(tr,val){
    const sels=tr.querySelectorAll('select');
    for(const s of sels){
      const opts=Array.from(s.options).map(o=>o.value.toLowerCase());
      if(opts.some(o=>o==='delivered'||o==='in transit'||o==='transit'||o==='returned'||o==='pending')){
        // find matching option
        const match=Array.from(s.options).find(o=>o.value.toLowerCase().includes(val.toLowerCase())||o.textContent.toLowerCase().includes(val.toLowerCase()));
        if(match){s.value=match.value;s.dispatchEvent(new Event('change',{bubbles:true}));}
        break;
      }
    }
  }

  function allCellValues(tr){
    return Array.from(tr.querySelectorAll('td')).map(td=>{
      const inp=td.querySelector('input');const sel=td.querySelector('select');
      return(inp?inp.value:sel?sel.value:td.textContent).trim();
    });
  }

  // Show menu on right-click inside any tracking tbody
  document.addEventListener('contextmenu',e=>{
    const tr=e.target.closest('#tracking-body tr[data-id], #saved-track-body tr[data-id]');
    if(!tr)return;
    e.preventDefault();
    activeRow=tr;
    // Position
    const x=Math.min(e.clientX,window.innerWidth-220);
    const y=Math.min(e.clientY,window.innerHeight-340);
    menu.style.left=x+'px';menu.style.top=y+'px';menu.style.display='block';
  });
  document.addEventListener('click',hide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});

  // ── Actions ──────────────────────────────────────────────────────────────
  document.getElementById('ctx-fedex').addEventListener('click',()=>{
    const n=getTrackingNum(activeRow);
    if(!n){_toast('No tracking number on this row','warn');hide();return;}
    window.open(_fedexUrl(n),'_blank');hide();
  });

  document.getElementById('ctx-copy-track').addEventListener('click',()=>{
    const n=getTrackingNum(activeRow);
    if(!n){_toast('No tracking number on this row','warn');hide();return;}
    navigator.clipboard.writeText(n).then(()=>_toast('✓ Copied: '+n,'ok')).catch(()=>_toast('Copy not available','warn'));
    hide();
  });

  document.getElementById('ctx-delivered').addEventListener('click',()=>{setStatus(activeRow,'delivered');_toast('✓ Marked Delivered','ok');hide();});
  document.getElementById('ctx-transit').addEventListener('click',()=>{setStatus(activeRow,'transit');_toast('✓ Marked In Transit','ok');hide();});
  document.getElementById('ctx-returned').addEventListener('click',()=>{setStatus(activeRow,'returned');_toast('✓ Marked Returned','ok');hide();});
  document.getElementById('ctx-pending').addEventListener('click',()=>{setStatus(activeRow,'pending');_toast('✓ Marked Pending','ok');hide();});

  document.getElementById('ctx-copy-row').addEventListener('click',()=>{
    const vals=allCellValues(activeRow);
    navigator.clipboard.writeText(vals.join('\t')).then(()=>_toast('✓ Row copied to clipboard','ok')).catch(()=>_toast('Copy not available','warn'));
    hide();
  });

  document.getElementById('ctx-duplicate').addEventListener('click',()=>{
    const clone=activeRow.cloneNode(true);
    clone.removeAttribute('data-id');
    clone.style.background='rgba(251,191,36,.08)';
    activeRow.after(clone);
    setTimeout(()=>clone.style.background='',1500);
    _toast('✓ Row duplicated','ok');hide();
  });

  document.getElementById('ctx-insert-below').addEventListener('click',()=>{
    const blank=document.createElement('tr');
    const cols=activeRow.querySelectorAll('td').length;
    blank.innerHTML='<td></td>'.repeat(cols);
    blank.style.background='rgba(56,189,248,.06)';
    activeRow.after(blank);
    setTimeout(()=>blank.style.background='',1500);
    _toast('✓ Empty row inserted','ok');hide();
  });

  document.getElementById('ctx-delete').addEventListener('click',()=>{
    if(!confirm('Delete this row?')){hide();return;}
    // Try to click the row's own delete button if it exists
    const delBtn=activeRow.querySelector('button.danger,[data-action="delete"]');
    if(delBtn){delBtn.click();}else{activeRow.remove();}
    _toast('Row deleted','ok');hide();
  });

  document.getElementById('ctx-reset-cols').addEventListener('click',()=>{
    // Determine which view the active row belongs to
    const tbody=activeRow&&activeRow.closest('tbody');
    if(!tbody){hide();return;}
    const bodyId=tbody.id;
    const keyMap={'tracking-body':'builder','saved-track-body':'saved','bymerchant-body':'bymerchant','today-body':'today','master-body':'master'};
    const viewKey=keyMap[bodyId];
    if(viewKey){
      try{localStorage.removeItem('_trk_col_'+viewKey);}catch{}
      // Trigger re-render by firing a synthetic refresh click if available
      const refreshBtns={'builder':'#btn-trk-refresh','saved':'#btn-saved-track-refresh','bymerchant':'#btn-bm-refresh','today':'#btn-today-refresh','master':'#btn-master-refresh'};
      const btn=document.querySelector(refreshBtns[viewKey]);
      if(btn)btn.click();
      _toast('Column layout reset — reload the panel to see default layout','ok');
    }
    hide();
  });
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

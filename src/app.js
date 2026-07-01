import { dispatch } from './parsers/index.js';
import { readPdfText } from './pdfReader.js';
import {
  PRODUCTS, detectProduct, findProductByKey,
  PRODUCT_STATUSES, builtinSeedProducts, buildCatalog, detectFromCatalog,
} from './data/midCodes.js';
import { HS_CODES, builtinSeedHsCodes, activeHsList } from './data/hsCodes.js';
import { buildFileName } from './excelExporter.js';
import { HEADER_ROW, buildRow } from './buildRow.js';
import {
  TRACKING_HEADERS,
  TRACKING_KEYS,
  ACCOUNTS,
  WEEKDAYS,
  buildTrackingRow,
  trackingRowToCells,
  parseProductLines,
  labelWithDose,
  parsePastedTable,
  parseRecords,
  parseFlexibleDate,
  formatDateDDMMYY,
  weekdayName,
  dateCompact4,
  isDatePrefixedMerchant,
  isPdmsMerchant,
  orderNumberForMerchant,
  setWeekdayWithinWeek,
  toISODate,
  fromISODate,
} from './trackingRow.js';
import { createStore, TRACKING_FIELDS } from './trackingStore.js';
import { DEFAULT_MERCHANTS, SOURCE_TO_MERCHANT, detectMerchant, learnExample } from './data/merchants.js';
import { expandState } from './data/states.js';
import { currentStock, suggestItemId, movementDedupKey, movementsToRows, toNum } from './data/stock.js';

export function createApp({ document, window, pdfjsLib, XLSX }) {
  const dropZone = document.getElementById('drop-zone');
  const filePicker = document.getElementById('file-picker');
  const folderPicker = document.getElementById('folder-picker');
  const clearBtn = document.getElementById('btn-clear');
  const downloadBtn = document.getElementById('btn-download');
  const cards = document.getElementById('cards');
  const statusEl = document.getElementById('status');
  const summary = document.getElementById('summary');

  // FedEx D1 controls
  const fedexAutosave = document.getElementById('chk-fedex-autosave');
  const fedexSaveAll = document.getElementById('btn-fedex-saveall');
  const addToStockBtn = document.getElementById('btn-add-to-stock');
  const fedexBackend = document.getElementById('fedex-backend');
  const fedexStatus = document.getElementById('fedex-status');

  // Saved tabs
  const savedFedexCards = document.getElementById('saved-fedex-cards');
  const savedFedexStatus = document.getElementById('saved-fedex-status');
  const savedFedexRefresh = document.getElementById('btn-saved-fedex-refresh');
  const savedFedexDownload = document.getElementById('btn-saved-fedex-download');
  const savedTrackHead = document.getElementById('saved-track-head');
  const savedTrackBody = document.getElementById('saved-track-body');
  const savedTrackStatus = document.getElementById('saved-track-status');
  const savedTrackRefresh = document.getElementById('btn-saved-track-refresh');
  const savedTrackDownload = document.getElementById('btn-saved-track-download');
  const savedTrackFilter = document.getElementById('saved-track-filter');
  const savedTrackSaveSel = document.getElementById('btn-saved-track-save-sel');
  const savedTrackCopySel = document.getElementById('btn-saved-track-copy-sel');
  const savedTrackDeleteSel = document.getElementById('btn-saved-track-delete-sel');
  const savedTrackSelCount = document.getElementById('saved-track-sel-count');
  const savedTrackPaste = document.getElementById('btn-saved-track-paste');
  const savedTrackFile = document.getElementById('saved-track-file');
  const savedTrackTemplate = document.getElementById('btn-saved-track-template');

  // By Merchant tab
  const bmHead = document.getElementById('bymerchant-head');
  const bmBody = document.getElementById('bymerchant-body');
  const bmStatus = document.getElementById('bymerchant-status');
  const bmSubtabs = document.getElementById('bymerchant-subtabs');
  const bmDateMode = document.getElementById('bm-datemode');
  const bmFrom = document.getElementById('bm-from');
  const bmTo = document.getElementById('bm-to');
  const bmRefresh = document.getElementById('btn-bm-refresh');
  const bmFilter = document.getElementById('bm-filter');
  const bmSaveSel = document.getElementById('btn-bm-save-sel');
  const bmCopySel = document.getElementById('btn-bm-copy-sel');
  const bmDeleteSel = document.getElementById('btn-bm-delete-sel');
  const bmSelCount = document.getElementById('bm-sel-count');
  const bmDownload = document.getElementById('btn-bm-download');
  const bmPaste = document.getElementById('btn-bm-paste');
  const bmFile = document.getElementById('bm-file');
  const bmTemplate = document.getElementById('btn-bm-template');

  // Today tab (today's tracking rows, promote to master)
  const todayHead = document.getElementById('today-head');
  const todayBody = document.getElementById('today-body');
  const todayStatus = document.getElementById('today-status');
  const todayFilter = document.getElementById('today-filter');
  const todaySaveSel = document.getElementById('btn-today-save-sel');
  const todayCopySel = document.getElementById('btn-today-copy-sel');
  const todayDeleteSel = document.getElementById('btn-today-delete-sel');
  const todaySelCount = document.getElementById('today-sel-count');
  const todayRefresh = document.getElementById('btn-today-refresh');
  const todayPromote = document.getElementById('btn-today-promote');
  const todayPaste = document.getElementById('btn-today-paste');
  const todayFile = document.getElementById('today-file');
  const todayTemplate = document.getElementById('btn-today-template');
  const todayDownload = document.getElementById('btn-today-download');

  // Master List tab (separate master table)
  const masterHead = document.getElementById('master-head');
  const masterBody = document.getElementById('master-body');
  const masterStatus = document.getElementById('master-status');
  const masterFilter = document.getElementById('master-filter');
  const masterSaveSel = document.getElementById('btn-master-save-sel');
  const masterCopySel = document.getElementById('btn-master-copy-sel');
  const masterDeleteSel = document.getElementById('btn-master-delete-sel');
  const masterSelCount = document.getElementById('master-sel-count');
  const masterRefresh = document.getElementById('btn-master-refresh');
  const masterDownload = document.getElementById('btn-master-download');
  const masterPaste = document.getElementById('btn-master-paste');
  const masterFile = document.getElementById('master-file');
  const masterTemplate = document.getElementById('btn-master-template');

  // Catalog tab (products + HS codes)
  const productsHead = document.getElementById('products-head');
  const productsBody = document.getElementById('products-body');
  const productStatus = document.getElementById('product-status');
  const productAdd = document.getElementById('btn-product-add');
  const productImport = document.getElementById('btn-product-import');
  const productTemplate = document.getElementById('btn-product-template');
  const productFile = document.getElementById('product-file');
  const productRefresh = document.getElementById('btn-product-refresh');
  const productStatusFilter = document.getElementById('product-status-filter');
  const hsHead = document.getElementById('hs-head');
  const hsBody = document.getElementById('hs-body');
  const hsStatus = document.getElementById('hs-status');
  const hsAdd = document.getElementById('btn-hs-add');
  const hsImport = document.getElementById('btn-hs-import');
  const hsTemplate = document.getElementById('btn-hs-template');
  const hsFile = document.getElementById('hs-file');
  const hsRefresh = document.getElementById('btn-hs-refresh');

  // Merchants tab
  const merchantNew = document.getElementById('merchant-new');
  const merchantAdd = document.getElementById('btn-merchant-add');
  const merchantRefresh = document.getElementById('btn-merchant-refresh');
  const merchantStatus = document.getElementById('merchant-status');
  const merchantListEl = document.getElementById('merchant-list');

  // Stock tab
  const stockMerchantSel = document.getElementById('stock-merchant');
  const stockRefresh = document.getElementById('btn-stock-refresh');
  const stockFromTracking = document.getElementById('btn-stock-from-tracking');
  const stockAddManual = document.getElementById('btn-stock-add-manual');
  const stockPicker = document.getElementById('stock-tracking-picker');
  const stockPickerHead = document.getElementById('stock-picker-head');
  const stockPickerBody = document.getElementById('stock-picker-body');
  const stockPickerAdd = document.getElementById('btn-stock-picker-add');
  const stockPickerCancel = document.getElementById('btn-stock-picker-cancel');
  const stockStatus = document.getElementById('stock-status');
  const stockPendingHead = document.getElementById('stock-pending-head');
  const stockPendingBody = document.getElementById('stock-pending-body');
  const stockItemsHead = document.getElementById('stock-items-head');
  const stockItemsBody = document.getElementById('stock-items-body');
  const siName = document.getElementById('si-name');
  const siSection = document.getElementById('si-section');
  const siCountry = document.getElementById('si-country');
  const siBatch = document.getElementById('si-batch');
  const siExpiry = document.getElementById('si-expiry');
  const siOpening = document.getElementById('si-opening');
  const siMerchantSel = document.getElementById('si-merchant');
  const stockAddItem = document.getElementById('btn-stock-additem');

  // Tracking section elements
  const trackApiUrl = document.getElementById('track-api-url');
  const trackSaveUrl = document.getElementById('btn-track-save-url');
  const trackAutosave = document.getElementById('chk-track-autosave');
  const trackBackend = document.getElementById('track-backend');
  const trackingHead = document.getElementById('tracking-head');
  const trackingBody = document.getElementById('tracking-body');
  const trackingStatus = document.getElementById('tracking-status');
  const trackingFilter = document.getElementById('tracking-filter');
  const trackSaveSel = document.getElementById('btn-track-save-sel');
  const trackCopySel = document.getElementById('btn-track-copy-sel');
  const trackDeleteSel = document.getElementById('btn-track-delete-sel');
  const trackSelCount = document.getElementById('track-sel-count');

  const AUTOSAVE_KEYS = {
    fedex: 'pharmaconsulta_autosave_fedex',
    rows: 'pharmaconsulta_autosave_rows',
  };

  const API_BASE_KEY = 'pharmaconsulta_tracking_api_base';
  // Default Cloudflare Worker (D1) endpoint. Used unless the user overrides it
  // via the Sync API URL box (saving an explicit value — including blank).
  const DEFAULT_API_BASE = 'https://pharmaconsulta-tracking.labrint.workers.dev';
  // Proportional column widths (%): a leading select checkbox column, then one
  // per TRACKING_HEADERS entry (no per-row Actions column — actions live in the
  // toolbar above each table).
  const TRACKING_SELECT_WIDTH = 3;
  // Widths align with TRACKING_HEADERS. "Delivered on" (index 11) is wider so the
  // date is readable; the columns after it are a touch narrower to make room.
  const TRACKING_COL_WIDTHS = [5, 6, 6, 6, 8, 4, 10, 7, 6, 7, 7, 10, 6, 7, 7, 6, 4, 6, 5, 5, 5, 4, 6];

  const headers = HEADER_ROW();
  let orders = [];
  let trackingRows = [];
  let savedTrackingRows = [];
  let masterRows = [];
  let savedFedexRows = [];
  let merchantsList = DEFAULT_MERCHANTS.map((name) => ({ name }));
  let learnedPatterns = [];
  let stockItems = [];
  let stockMoves = [];
  let stockMerchant = '';

  // Product catalog + HS-code list (D1-backed, seeded from the built-ins).
  // Kept in sync to a runtime catalog (with regex patterns) for detection and an
  // active rotating HS list for buildRow / buildTrackingRow.
  // Delivery-status options for the dropdown + dashboard. Defaults plus any the
  // user adds (persisted as a setting) or seen in saved rows.
  let deliveryStatuses = ['Pending', 'Delivered'];

  let productsList = builtinSeedProducts();
  let hsList = builtinSeedHsCodes();
  let productCatalog = buildCatalog(productsList);
  let activeHs = activeHsList(hsList);

  function rebuildCatalog() {
    productCatalog = buildCatalog(productsList);
    activeHs = activeHsList(hsList);
  }
  function activeCatalogProducts() {
    return productCatalog.filter((p) => !p.status || p.status === 'active');
  }
  function catalogProductByKey(key) {
    return productCatalog.find((p) => p.key === key) || findProductByKey(key);
  }
  // Detection over the live catalog. The catalog is always seeded (built-ins at
  // startup, D1 once loaded), so this also honours status — a withdrawn product
  // won't match even though its built-in regex still exists.
  function detect(text) {
    return detectFromCatalog(text, productCatalog);
  }

  // The two tracking tables (the builder's live sheet and the Saved Tracking
  // tab) share rendering + toolbar logic. Each view bundles its DOM refs, a
  // getter/setter for its row array, and its current filter text.
  const TRACK_VIEWS = {
    builder: {
      key: 'builder',
      resource: 'rows',
      head: trackingHead, body: trackingBody, status: trackingStatus,
      getRows: () => trackingRows,
      setRows: (r) => { trackingRows = r; },
      filter: trackingFilter, saveBtn: trackSaveSel, copyBtn: trackCopySel,
      deleteBtn: trackDeleteSel, count: trackSelCount,
      dash: document.getElementById('tracking-dashboard'),
      filterText: '', selectAll: null, sort: null, colFilters: {}, statusFilter: '',
    },
    saved: {
      key: 'saved',
      resource: 'rows',
      head: savedTrackHead, body: savedTrackBody, status: savedTrackStatus,
      getRows: () => savedTrackingRows,
      setRows: (r) => { savedTrackingRows = r; },
      filter: savedTrackFilter, saveBtn: savedTrackSaveSel, copyBtn: savedTrackCopySel,
      deleteBtn: savedTrackDeleteSel, count: savedTrackSelCount,
      dash: document.getElementById('saved-track-dashboard'),
      filterText: '', selectAll: null, sort: null, colFilters: {}, statusFilter: '',
    },
    // "By Merchant" reads the SAME saved rows, narrowed by a selected merchant
    // and a date scope (today / all / range). Saving here hits the same store,
    // so the Saved Tracking tab stays in sync.
    bymerchant: {
      key: 'bymerchant',
      resource: 'rows',
      head: bmHead, body: bmBody, status: bmStatus,
      getRows: () => savedTrackingRows,
      setRows: (r) => { savedTrackingRows = r; },
      filter: bmFilter, saveBtn: bmSaveSel, copyBtn: bmCopySel,
      deleteBtn: bmDeleteSel, count: bmSelCount,
      dash: document.getElementById('bm-dashboard'),
      filterText: '', selectAll: null, sort: null, colFilters: {}, statusFilter: '',
      merchant: '', dateMode: 'all', rangeFrom: '', rangeTo: '',
      prefilter: (r) => bmRowMatches(TRACK_VIEWS.bymerchant, r),
    },
    // "Today": today's saved tracking rows (working set), promoted to master.
    today: {
      key: 'today',
      resource: 'rows',
      head: todayHead, body: todayBody, status: todayStatus,
      getRows: () => savedTrackingRows,
      setRows: (r) => { savedTrackingRows = r; },
      filter: todayFilter, saveBtn: todaySaveSel, copyBtn: todayCopySel,
      deleteBtn: todayDeleteSel, count: todaySelCount,
      dash: document.getElementById('today-dashboard'),
      filterText: '', selectAll: null, sort: null, colFilters: {}, statusFilter: '',
      prefilter: (r) => (r.isoDate || '') === toISODate(new Date()),
    },
    // "Master List": a separate, persistent table (its own store/resource).
    master: {
      key: 'master',
      resource: 'master',
      head: masterHead, body: masterBody, status: masterStatus,
      getRows: () => masterRows,
      setRows: (r) => { masterRows = r; },
      filter: masterFilter, saveBtn: masterSaveSel, copyBtn: masterCopySel,
      deleteBtn: masterDeleteSel, count: masterSelCount,
      dash: document.getElementById('master-dashboard'),
      filterText: '', selectAll: null, sort: null, colFilters: {}, statusFilter: '',
    },
  };

  // ── Column layout: resize + reorder + persistence ─────────────────────────
  const _COL_LS = (k) => '_trk_col_' + k;
  function _loadColLayout(viewKey) {
    try { return JSON.parse(localStorage.getItem(_COL_LS(viewKey)) || 'null'); } catch { return null; }
  }
  function _saveColLayout(viewKey, layout) {
    try { localStorage.setItem(_COL_LS(viewKey), JSON.stringify(layout)); } catch {}
  }
  function _resetColLayout(viewKey) {
    try { localStorage.removeItem(_COL_LS(viewKey)); } catch {}
  }
  // Reorder data cells in a <tr> according to saved order (array of original col indices)
  function _applyColOrderToTr(tr, order) {
    const cells = Array.from(tr.children);
    if (cells.length < 2) return;
    const first = cells[0]; // checkbox always stays first
    const data = cells.slice(1);
    const reordered = order.map((i) => data[i]).filter(Boolean);
    if (reordered.length !== data.length) return; // safety
    while (tr.lastChild !== first) tr.removeChild(tr.lastChild);
    reordered.forEach((c) => tr.appendChild(c));
  }
  // Wire up column resize handles and drag-to-reorder for a rendered header row
  function _wireColLayout(view, headerTr) {
    try { _wireColLayoutUnsafe(view, headerTr); } catch { /* no-op in test/stub environments */ }
  }
  function _wireColLayoutUnsafe(view, headerTr) {
    const viewKey = view.key;
    if (!viewKey) return;
    const table = typeof headerTr.closest === 'function' ? headerTr.closest('table') : null;
    if (!table) return;

    const layout = _loadColLayout(viewKey);
    const cols = Array.from(table.querySelectorAll('col')).slice(1); // skip checkbox col

    // Apply saved widths
    if (layout && layout.widths && layout.widths.length) {
      layout.widths.forEach((w, i) => { if (cols[i]) cols[i].style.width = w + 'px'; });
    }

    // Apply saved column order to header + colgroup
    if (layout && layout.order && layout.order.length === cols.length) {
      _applyColOrderToTr(headerTr, layout.order);
      // Reorder <col> elements to match
      const colParent = cols[0] && cols[0].parentElement;
      if (colParent) {
        const allCols = Array.from(colParent.children);
        const firstCol = allCols[0];
        const dataCols = allCols.slice(1);
        const reorderedCols = layout.order.map((i) => dataCols[i]).filter(Boolean);
        while (colParent.lastChild !== firstCol) colParent.removeChild(colParent.lastChild);
        reorderedCols.forEach((c) => colParent.appendChild(c));
      }
    }

    // Add resize handles to every data <th>
    Array.from(headerTr.children).slice(1).forEach((th) => {
      const handle = document.createElement('span');
      handle.className = 'col-resize-handle';
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handle.classList.add('active');
        const thIdx = Array.from(headerTr.children).indexOf(th); // includes checkbox at 0
        const targetCol = Array.from(table.querySelectorAll('col'))[thIdx];
        const startX = e.clientX;
        const startW = targetCol ? (targetCol.offsetWidth || parseInt(targetCol.style.width) || th.offsetWidth) : th.offsetWidth;
        const onMove = (me) => {
          const nw = Math.max(36, startW + me.clientX - startX);
          if (targetCol) targetCol.style.width = nw + 'px';
        };
        const onUp = () => {
          handle.classList.remove('active');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          const currCols = Array.from(table.querySelectorAll('col')).slice(1);
          const widths = currCols.map((c) => c.offsetWidth || parseInt(c.style.width) || 80);
          const existing = _loadColLayout(viewKey) || {};
          _saveColLayout(viewKey, { ...existing, widths });
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      th.appendChild(handle);
    });

    // Drag-to-reorder
    let _dragSrcTh = null;
    Array.from(headerTr.children).slice(1).forEach((th) => {
      th.draggable = true;
      th.addEventListener('dragstart', (e) => {
        _dragSrcTh = th;
        th.classList.add('col-drag-src');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', th.dataset.colIdx || '');
      });
      th.addEventListener('dragend', () => {
        th.classList.remove('col-drag-src');
        headerTr.querySelectorAll('.col-drag-over').forEach((el) => el.classList.remove('col-drag-over'));
        _dragSrcTh = null;
      });
      th.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        headerTr.querySelectorAll('.col-drag-over').forEach((el) => el.classList.remove('col-drag-over'));
        if (th !== _dragSrcTh) th.classList.add('col-drag-over');
      });
      th.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!_dragSrcTh || _dragSrcTh === th) return;
        const allThs = Array.from(headerTr.children);
        const srcIdx = allThs.indexOf(_dragSrcTh);
        const dstIdx = allThs.indexOf(th);
        if (srcIdx < 1 || dstIdx < 1) return;

        // Move th in header row
        if (dstIdx > srcIdx) {
          headerTr.insertBefore(_dragSrcTh, th.nextSibling);
        } else {
          headerTr.insertBefore(_dragSrcTh, th);
        }

        // Move corresponding <col>
        const colEls = Array.from(table.querySelectorAll('col'));
        const srcCol = colEls[srcIdx];
        const dstCol = colEls[dstIdx];
        if (srcCol && dstCol) {
          if (dstIdx > srcIdx) srcCol.parentElement.insertBefore(srcCol, dstCol.nextSibling);
          else srcCol.parentElement.insertBefore(srcCol, dstCol);
        }

        // Move cells in every body row
        const tbody = table.querySelector('tbody');
        if (tbody) {
          Array.from(tbody.rows).forEach((btr) => {
            const bCells = Array.from(btr.children);
            const bSrc = bCells[srcIdx];
            const bDst = bCells[dstIdx];
            if (bSrc && bDst) {
              if (dstIdx > srcIdx) btr.insertBefore(bSrc, bDst.nextSibling);
              else btr.insertBefore(bSrc, bDst);
            }
          });
        }

        // Save new order (read data-col-idx from each th after reorder)
        const newThs = Array.from(headerTr.children).slice(1);
        const order = newThs.map((t) => parseInt(t.dataset.colIdx || '0'));
        const currCols = Array.from(table.querySelectorAll('col')).slice(1);
        const widths = currCols.map((c) => c.offsetWidth || parseInt(c.style.width) || 80);
        _saveColLayout(viewKey, { order, widths });
        _toast('Column order saved', 'ok');
      });
    });
  }
  // Apply saved column order to a freshly-rendered body row
  function _applyColLayoutToRow(view, tr) {
    const viewKey = view.key;
    if (!viewKey) return;
    const layout = _loadColLayout(viewKey);
    if (layout && layout.order && layout.order.length) {
      _applyColOrderToTr(tr, layout.order);
    }
  }

  renderRows();

  dropZone.addEventListener('click', () => filePicker.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = await readDataTransfer(e.dataTransfer);
    await ingestFiles(files);
  });

  filePicker.addEventListener('change', async (e) => {
    await ingestFiles(Array.from(e.target.files));
    e.target.value = '';
  });
  folderPicker.addEventListener('change', async (e) => {
    await ingestFiles(Array.from(e.target.files));
    e.target.value = '';
  });

  clearBtn.addEventListener('click', () => {
    orders = [];
    trackingRows = [];
    statusEl.textContent = '';
    clearAddToStockFlash();
    renderRows();
    renderAllTracking();
  });

  // Build + download an xlsx from an array-of-arrays (first row = header).
  function downloadAoa(aoa, filename, statusFn) {
    if (!aoa || aoa.length < 2) { if (statusFn) statusFn('Nothing to download.', 'warn'); return; }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = aoa[0].map(() => ({ wch: 28.875 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
    if (statusFn) statusFn(`Downloaded ${filename}`, 'ok');
  }

  // Build + download an xlsx from rows of 52-cell FedEx arrays.
  function downloadCells(cellRows, filename, statusFn) {
    if (!cellRows.length) { if (statusFn) statusFn('Nothing to download.', 'warn'); return; }
    downloadAoa([HEADER_ROW()].concat(cellRows), filename, statusFn);
  }

  // Date-stamped filename helper.
  function dateStamp(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  downloadBtn.addEventListener('click', () => {
    if (!orders.length) return;
    // Use each row's editable `cells` (kept in sync with inline edits and what
    // is saved to D1); fall back to a fresh buildRow for any row without them.
    const rows = orders.map((o, i) => o.cells || buildRow({ recipient: o.recipient, product: o.product }, i));
    downloadCells(rows, buildFileName(orders.length), setStatus);
  });

  function setStatus(msg, level = '') {
    const line = document.createElement('div');
    line.className = `status-line ${level}`;
    line.textContent = msg;
    statusEl.appendChild(line);
    while (statusEl.children.length > 12) statusEl.removeChild(statusEl.firstChild);
    statusEl.scrollTop = statusEl.scrollHeight;
  }

  async function ingestFiles(fileList) {
    const pdfs = fileList.filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      setStatus('No PDF files found in selection.', 'warn');
      renderRows();
      return;
    }
    setStatus(`Reading ${pdfs.length} PDF(s)…`);
    let skipped = 0;
    const beforeCount = orders.length;
    const today = new Date();
    for (const file of pdfs) {
      try {
        const text = await readPdfText(file, pdfjsLib);
        const parsed = dispatch(text);
        if (!parsed.length) {
          setStatus(`${file.name}: format not recognised.`, 'err');
          continue;
        }
        for (const order of parsed) {
          const product = detect(order.productText) || detect(text);
          const md = detectMerchant(text, { source: order.source, learned: learnedPatterns, merchants: merchantNames() });
          const dedupKey = `${hashText(text)}|${order.orderId || (order.recipient && order.recipient.name) || ''}`;
          // Skip an identical order already loaded this session (no dup cards).
          if (orders.some((o) => o.dedupKey === dedupKey)) { skipped += 1; continue; }
          orders.push({
            fileName: file.name,
            source: order.source,
            recipient: order.recipient,
            productText: order.productText,
            productLines: order.productLines || null,
            product: product || null,
            orderId: order.orderId || '',
            text,
            dedupKey,
            merchant: md ? md.merchant : '',
            merchantVia: md ? md.via : '',
          });
        }
        setStatus(`${file.name}: parsed (${parsed.length} order${parsed.length > 1 ? 's' : ''}).`, 'ok');
      } catch (err) {
        setStatus(`${file.name}: ${err.message}`, 'err');
      }
    }
    if (skipped) setStatus(`Skipped ${skipped} duplicate order(s) already loaded.`, 'warn');
    renderRows();
    await buildTrackingFromOrders();
    renderAllTracking();
    // Autosave freshly ingested data if enabled.
    if (autosaveOn('fedex')) {
      orders.forEach((o, i) => {
        if (!o.fedexId && o.product && o.product.mid) saveFedexOrder(o, i, { silent: true });
      });
    }
    if (autosaveOn('rows')) {
      trackingRows.forEach((r) => { if (!r.id) saveRow(r, { silent: true }); });
    }
    // Surface a flashing CTA (instead of an interrupting popup) to add the
    // freshly parsed orders to the stock movement sheet.
    const added = orders.length - beforeCount;
    if (added > 0) showAddToStockFlash();
  }

  function showAddToStockFlash() {
    if (!addToStockBtn) return;
    const n = orders.length;
    addToStockBtn.textContent = `➕ Update Stock Movement Sheet (${n} order${n > 1 ? 's' : ''})`;
    addToStockBtn.classList.remove('hidden');
    addToStockBtn.classList.add('flash');
  }

  function clearAddToStockFlash() {
    if (!addToStockBtn) return;
    addToStockBtn.classList.add('hidden');
    addToStockBtn.classList.remove('flash');
  }

  // Flashing CTA: jump to Stock, focus the right merchant, pull + show pending.
  async function goAddToStock() {
    if (!orders.length) { clearAddToStockFlash(); return; }
    if (!stockItems.length && !stockMoves.length) await loadStock();
    await pullOrdersToPending();
    const ms = new Set(orders.map((o) => o.merchant).filter(Boolean));
    stockMerchant = ms.size === 1 ? Array.from(ms)[0] : '';
    if (stockMerchantSel) stockMerchantSel.value = stockMerchant;
    clearAddToStockFlash();
    activateTab('panel-stock'); // reloads stock from D1 + renders with the merchant
    if (stockStatus && stockStatus.scrollIntoView) stockStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Turn a camelCase column key into a readable, space-separated label so the
  // header wraps at word boundaries (e.g. "recipientContactName" -> "Recipient
  // Contact Name") instead of breaking letter-by-letter in narrow columns.
  function humanizeHeader(key) {
    if (/[\s(]/.test(key)) return key; // already friendly (File, Product (MID)...)
    const spaced = key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])(\d)/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  // Render each shipment as a card. The 52 export fields flow in a responsive
  // grid that wraps onto as many lines as needed — every column is visible with
  // no horizontal scrolling, the values stay editable, and the export is
  // unaffected (the xlsx is rebuilt from `orders`, not the DOM).
  function renderRows() {
    cards.innerHTML = '';
    orders.forEach((o, idx) => {
      // Keep an editable copy of the row so inline edits persist into both the
      // export and what gets saved to D1. Recomputed when the product changes.
      if (!o.cells) o.cells = buildRow({ recipient: o.recipient, product: o.product, qty: resolveProducts(o)[0]?.qty }, idx, activeHs);
      const cells = o.cells;
      const hasResolvedProduct = !!o.product && !!o.product.mid;

      const card = document.createElement('div');
      card.className = `card${hasResolvedProduct ? '' : ' invalid'}`;

      // Card header: index, file, source, product picker, save/copy/delete.
      const head = document.createElement('div');
      head.className = 'card-head';

      const num = document.createElement('span');
      num.className = 'card-num';
      num.textContent = `#${idx + 1}`;
      head.appendChild(num);

      const file = document.createElement('span');
      file.className = 'card-file';
      file.textContent = o.fileName || '';
      head.appendChild(file);

      const src = document.createElement('span');
      src.className = 'badge';
      src.textContent = o.source || '';
      head.appendChild(src);

      // Merchant dropdown (auto-detected, learns from corrections).
      const merchSel = document.createElement('select');
      merchSel.className = 'card-merchant';
      merchSel.title = o.merchantVia === 'format'
        ? 'Detected from the PDF format'
        : (o.merchantVia === 'learned' ? 'Detected from a learned pattern' : 'Pick the merchant to teach detection');
      const mEmpty = document.createElement('option');
      mEmpty.value = '';
      mEmpty.textContent = '— merchant —';
      merchSel.appendChild(mEmpty);
      const merchOptions = merchantsList.map((m) => m.name);
      // Show the detected merchant even if it isn't in the saved list yet.
      if (o.merchant && !merchOptions.includes(o.merchant)) merchOptions.push(o.merchant);
      for (const name of merchOptions) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (o.merchant === name) opt.selected = true;
        merchSel.appendChild(opt);
      }
      merchSel.addEventListener('change', () => {
        o.merchant = merchSel.value;
        o.merchantVia = 'manual';
        if (o.merchant) learnMerchant(o);
      });
      head.appendChild(merchSel);

      const sel = document.createElement('select');
      sel.className = 'card-product';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '— pick product —';
      sel.appendChild(empty);
      for (const p of activeCatalogProducts()) {
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = `${p.name}${p.mid ? ` (${p.mid})` : ''}`;
        if (o.product && o.product.key === p.key) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        orders[idx].product = catalogProductByKey(sel.value) || null;
        orders[idx].cells = buildRow({ recipient: orders[idx].recipient, product: orders[idx].product, qty: resolveProducts(orders[idx])[0]?.qty }, idx, activeHs);
        renderRows();
        if (autosaveOn('fedex') && orders[idx].product && orders[idx].product.mid) {
          scheduleAutosave(orders[idx], () => saveFedexOrder(orders[idx], idx, { silent: true }));
        }
      });
      head.appendChild(sel);

      // Quick-add this product to the catalog (prefilled with the parsed text).
      const addProdBtn = document.createElement('button');
      addProdBtn.type = 'button';
      addProdBtn.className = 'mini';
      addProdBtn.textContent = '+ new product';
      addProdBtn.title = 'Add this product to the catalog';
      addProdBtn.addEventListener('click', () => openProductModal(
        { name: (o.productText || '').trim().slice(0, 80) },
        (saved) => {
          orders[idx].product = catalogProductByKey(saved.key) || saved;
          orders[idx].cells = buildRow({ recipient: orders[idx].recipient, product: orders[idx].product, qty: resolveProducts(orders[idx])[0]?.qty }, idx, activeHs);
          renderRows();
          if (autosaveOn('fedex') && orders[idx].product && orders[idx].product.mid) {
            scheduleAutosave(orders[idx], () => saveFedexOrder(orders[idx], idx, { silent: true }));
          }
        }
      ));
      head.appendChild(addProdBtn);

      if (!hasResolvedProduct) {
        const warn = document.createElement('span');
        warn.className = 'badge err';
        warn.textContent = 'no MID — pick a product';
        head.appendChild(warn);
      }

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'primary';
      saveBtn.textContent = o.fedexId ? 'Finalize on update' : 'Save';
      saveBtn.disabled = false;
      saveBtn.title = hasResolvedProduct ? '' : 'Saving without MID — assign a product to complete';
      saveBtn.addEventListener('click', () => saveFedexOrder(o, idx));
      actions.appendChild(saveBtn);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyFedexOrder(o));
      actions.appendChild(copyBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => removeFedexOrder(o));
      actions.appendChild(delBtn);

      head.appendChild(actions);
      card.appendChild(head);

      // Field grid.
      card.appendChild(buildFieldGrid(cells, (colIdx, text) => {
        o.cells[colIdx] = text;
        if (autosaveOn('fedex') && o.product && o.product.mid) {
          scheduleAutosave(o, () => saveFedexOrder(o, idx, { silent: true }));
        }
      }));

      cards.appendChild(card);
    });

    const unresolved = orders.filter((o) => !o.product || !o.product.mid).length;
    downloadBtn.disabled = !orders.length;
    summary.innerHTML = orders.length
      ? `<strong>${orders.length}</strong> shipment${orders.length > 1 ? 's' : ''} loaded${
          unresolved
            ? `, <span style="color:var(--amb)"><strong>${unresolved}</strong> need a product assigned (rows will export without MID)</span>`
            : ''
        }.`
      : 'Drop PDFs above to begin.';

    // Sync sidebar stats + header batch count
    const ready = orders.length - unresolved;
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('sb-total', orders.length);
    setEl('sb-ready', ready);
    setEl('sb-need', unresolved);
    // "Need info" click → scroll to the first invalid card
    const sbNeed = document.getElementById('sb-need');
    if (sbNeed) {
      sbNeed.style.cursor = unresolved ? 'pointer' : '';
      sbNeed.onclick = unresolved ? () => {
        const first = cards.querySelector('.card.invalid');
        if (first) {
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const sel = first.querySelector('select');
          if (sel) sel.focus();
        }
      } : null;
    }
    setEl('badge-batch', orders.length);
    setEl('hs-orders', orders.length);
    // Sender indicator: next sender index after this batch
    const senders = (typeof ModSenders !== 'undefined' && ModSenders.SENDERS) ? ModSenders.SENDERS : [];
    if (senders.length) {
      const nextIdx = orders.length % senders.length;
      setEl('sb-sender', (nextIdx + 1) + '/' + senders.length);
    }
  }

  // Small stable string hash (djb2) for content-based de-dup keys.
  function hashText(str) {
    let h = 5381;
    const s = String(str || '');
    for (let i = 0; i < s.length; i += 1) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // Editable label+value grid for the 52 cells. onEdit(colIdx, text) on input.
  function buildFieldGrid(cells, onEdit) {
    const grid = document.createElement('div');
    grid.className = 'fields';
    cells.forEach((value, colIdx) => {
      const field = document.createElement('div');
      field.className = 'field';
      const label = document.createElement('span');
      label.className = 'flabel';
      label.textContent = humanizeHeader(headers[colIdx]);
      field.appendChild(label);
      const val = document.createElement('div');
      val.className = 'fval';
      val.setAttribute('contenteditable', 'true');
      val.dataset.colIdx = colIdx;
      val.textContent = value;
      val.addEventListener('input', () => onEdit(colIdx, val.textContent));
      field.appendChild(val);
      grid.appendChild(field);
    });
    return grid;
  }

  // ---- FedEx D1 persistence ----

  function setFedexStatus(msg, level = '') {
    if (!fedexStatus) return;
    const line = document.createElement('div');
    line.className = `status-line ${level}`;
    line.textContent = msg;
    fedexStatus.appendChild(line);
    while (fedexStatus.children.length > 8) fedexStatus.removeChild(fedexStatus.firstChild);
    fedexStatus.scrollTop = fedexStatus.scrollHeight;
  }

  function updateFedexBackend() {
    if (!fedexBackend) return;
    const base = getApiBase();
    fedexBackend.textContent = base ? 'D1 (Cloudflare)' : 'this browser (localStorage)';
    fedexBackend.className = `backend-badge ${base ? 'd1' : 'local'}`;
  }

  function recordForOrder(o, idx) {
    const cells = o.cells || buildRow({ recipient: o.recipient, product: o.product }, idx);
    return {
      fileName: o.fileName || '',
      source: o.source || '',
      productKey: o.product ? o.product.key : '',
      productMid: o.product ? o.product.mid : '',
      recipientName: o.recipient ? o.recipient.name || '' : '',
      cells,
      dedupKey: o.dedupKey || '',
    };
  }

  async function saveFedexOrder(o, idx, { silent = false } = {}) {
    if (!o.product || !o.product.mid) {
      if (silent) return;
      // Allow saving without MID — user can assign product later.
      if (!silent) setFedexStatus('Saving without MID — assign a product to complete the shipment.', 'warn');
    }
    const store = makeStore('fedex');
    try {
      if (!silent) setFedexStatus(o.fedexId ? `Overwriting id ${o.fedexId}…` : 'Saving…');
      const rec = recordForOrder(o, idx);
      const saved = o.fedexId ? await store.update(o.fedexId, rec) : await store.save(rec);
      o.fedexId = saved.id;
      setFedexStatus(
        `${silent ? 'Autosaved' : 'Saved'} ${o.recipient && o.recipient.name ? o.recipient.name : 'shipment'} (id ${saved.id}) to ${store.backend === 'd1' ? 'D1' : 'this browser'}.`,
        'ok'
      );
      // Don't re-render on a silent autosave — it would steal focus mid-typing.
      if (!silent) renderRows();
    } catch (err) {
      setFedexStatus(`Save failed: ${err.message}`, 'err');
    }
  }

  async function copyFedexOrder(o, idx) {
    const cells = o.cells || buildRow({ recipient: o.recipient, product: o.product }, idx);
    const text = cells.join('\t');
    try {
      await window.navigator.clipboard.writeText(text);
      setFedexStatus('Shipment row copied to clipboard (tab-separated).', 'ok');
    } catch {
      setFedexStatus(`Copy unavailable here. Row:\n${text}`, 'warn');
    }
  }

  async function removeFedexOrder(o) {
    if (o.fedexId) {
      const store = makeStore('fedex');
      try {
        await store.remove(o.fedexId);
      } catch (err) {
        setFedexStatus(`Delete failed: ${err.message}`, 'err');
        return;
      }
    }
    orders = orders.filter((x) => x !== o);
    setFedexStatus('Shipment removed.', 'ok');
    renderRows();
    await deleteLinkedByDedup('rows', o.dedupKey);
  }

  async function saveAllFedex() {
    const savable = orders.filter((o) => o.product && o.product.mid);
    if (!savable.length) {
      setFedexStatus('No shipments with a product to save.', 'warn');
      return;
    }
    setFedexStatus(`Saving ${savable.length} shipment(s)…`);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i].product && orders[i].product.mid) {
        // eslint-disable-next-line no-await-in-loop
        await saveFedexOrder(orders[i], i, { silent: true });
      }
    }
    setFedexStatus(`Saved ${savable.length} shipment(s).`, 'ok');
  }

  function initFedex() {
    updateFedexBackend();
    if (fedexAutosave) {
      fedexAutosave.checked = autosaveOn('fedex');
      fedexAutosave.addEventListener('change', () => {
        setAutosave('fedex', fedexAutosave.checked);
        setFedexStatus(fedexAutosave.checked ? 'Autosave on — shipments save to D1 as you edit.' : 'Autosave off.', 'ok');
      });
    }
    if (fedexSaveAll) fedexSaveAll.addEventListener('click', saveAllFedex);
  }

  // ---- Generic status helper ----
  function setStatusInto(el, msg, level = '') {
    if (!el) return;
    const line = document.createElement('div');
    line.className = `status-line ${level}`;
    line.textContent = msg;
    el.appendChild(line);
    while (el.children.length > 8) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  // ---- Tabs ----
  const TAB_DEFS = [
    ['tab-builder', 'panel-builder'],
    ['tab-fedex', 'panel-fedex'],
    ['tab-tracking', 'panel-tracking'],
    ['tab-bymerchant', 'panel-bymerchant'],
    ['tab-today', 'panel-today'],
    ['tab-master', 'panel-master'],
    ['tab-stock', 'panel-stock'],
    ['tab-catalog', 'panel-catalog'],
    ['tab-merchants', 'panel-merchants'],
    ['tab-awb', 'panel-awb'],
    ['tab-reports', 'panel-reports'],
  ];
  let tabEls = [];

  // Switch to a panel and always refresh its data from the store.
  function activateTab(panelId) {
    // Deactivate ALL panels first (some panels like panel-trk-sheet are only
    // reachable via sec-tabs and are not in tabEls, so we must clear them here).
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tabEls.forEach(({ btn, panel }) => {
      if (btn) btn.classList.toggle('active', btn.dataset.panel === panelId);
      if (panel) panel.classList.toggle('active', panel.id === panelId);
    });
    if (panelId === 'panel-fedex') loadSavedFedex();
    else if (panelId === 'panel-tracking') loadSavedRows();
    else if (panelId === 'panel-bymerchant') loadSavedRows().then(renderMerchantSubtabs);
    else if (panelId === 'panel-today') loadSavedRows();
    else if (panelId === 'panel-master') loadMaster();
    else if (panelId === 'panel-stock') loadStock();
    else if (panelId === 'panel-catalog') loadCatalog();
    else if (panelId === 'panel-awb') { if (typeof AWB !== 'undefined') AWB.render(); }
    else if (panelId === 'panel-reports') { if (typeof RPT !== 'undefined') RPT.init(); }
  }

  function initTabs() {
    const settingsBtn = document.getElementById('btn-settings');
    const settingsBar = document.getElementById('global-settings');
    if (settingsBtn && settingsBar) {
      settingsBtn.addEventListener('click', () => settingsBar.classList.toggle('hidden'));
    }
    tabEls = TAB_DEFS.map(([t, p]) => ({
      btn: document.getElementById(t),
      panel: document.getElementById(p),
    }));
    tabEls.forEach(({ btn }) => {
      if (!btn) return;
      btn.addEventListener('click', () => activateTab(btn.dataset.panel));
    });
  }

  // ---- Saved FedEx tab ----
  async function loadSavedFedex() {
    const store = makeStore('fedex');
    const status = (m, l) => setStatusInto(savedFedexStatus, m, l);
    try {
      status(`Loading saved shipments from ${store.backend === 'd1' ? 'D1' : 'this browser'}…`);
      savedFedexRows = await store.list();
      status(`Loaded ${savedFedexRows.length} saved shipment(s).`, 'ok');
      renderSavedFedex();
    } catch (err) {
      status(`Load failed: ${err.message}`, 'err');
    }
  }

  function renderSavedFedex() {
    if (!savedFedexCards) return;
    savedFedexCards.innerHTML = '';
    if (!savedFedexRows.length) {
      const empty = document.createElement('div');
      empty.className = 'panel-hint';
      empty.textContent = 'No saved shipments yet. Save some from the Builder tab, then Refresh.';
      savedFedexCards.appendChild(empty);
    }
    savedFedexRows.forEach((s) => {
      if (!Array.isArray(s.cells)) s.cells = [];
      const card = document.createElement('div');
      card.className = 'card collapsed';

      const head = document.createElement('div');
      head.className = 'card-head';

      const num = document.createElement('span');
      num.className = 'card-num';
      num.textContent = `#${s.id}`;
      head.appendChild(num);

      const who = document.createElement('span');
      who.textContent = `${s.recipientName || '—'} · ${s.productKey || '—'} (${s.productMid || '—'})`;
      head.appendChild(who);

      const fileBadge = document.createElement('span');
      fileBadge.className = 'card-file';
      fileBadge.textContent = s.fileName || '';
      head.appendChild(fileBadge);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'View / edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card.classList.toggle('collapsed');
      });
      actions.appendChild(editBtn);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'primary';
      saveBtn.textContent = 'Overwrite';
      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await makeStore('fedex').update(s.id, s);
          setStatusInto(savedFedexStatus, `Saved changes to id ${s.id}.`, 'ok');
        } catch (err) {
          setStatusInto(savedFedexStatus, `Save failed: ${err.message}`, 'err');
        }
      });
      actions.appendChild(saveBtn);

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadCells([s.cells], buildFileName(1), (m, l) => setStatusInto(savedFedexStatus, m, l));
      });
      actions.appendChild(dlBtn);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = s.cells.join('\t');
        try {
          await window.navigator.clipboard.writeText(text);
          setStatusInto(savedFedexStatus, 'Row copied (tab-separated).', 'ok');
        } catch {
          setStatusInto(savedFedexStatus, `Copy unavailable. Row:\n${text}`, 'warn');
        }
      });
      actions.appendChild(copyBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await makeStore('fedex').remove(s.id);
          savedFedexRows = savedFedexRows.filter((r) => r !== s);
          setStatusInto(savedFedexStatus, `Deleted id ${s.id}.`, 'ok');
          renderSavedFedex();
          await deleteLinkedByDedup('rows', s.dedupKey);
        } catch (err) {
          setStatusInto(savedFedexStatus, `Delete failed: ${err.message}`, 'err');
        }
      });
      actions.appendChild(delBtn);

      head.appendChild(actions);
      head.addEventListener('click', () => card.classList.toggle('collapsed'));
      card.appendChild(head);

      // Editable field grid (hidden while collapsed).
      card.appendChild(buildFieldGrid(s.cells, (colIdx, text) => { s.cells[colIdx] = text; }));

      savedFedexCards.appendChild(card);
    });
  }

  // ---- Merchants ----
  async function loadMerchants() {
    const store = makeStore('merchants');
    try {
      const list = await store.list();
      if (list && list.length) {
        merchantsList = list;
        await ensureKrypton2(store);
      } else {
        // Seed the defaults into the store on first run.
        merchantsList = [];
        for (const name of DEFAULT_MERCHANTS) {
          // eslint-disable-next-line no-await-in-loop
          const saved = await store.save({ name });
          merchantsList.push(saved);
        }
      }
    } catch {
      merchantsList = DEFAULT_MERCHANTS.map((name) => ({ name }));
    }
    renderMerchants();
    renderRows();
    renderStock();
  }

  // "LWA" is the old name for Krypton 2. On an existing merchant list, rename it
  // (or add Krypton 2 if neither is present) so detection + the dropdowns match.
  async function ensureKrypton2(store) {
    if (merchantsList.some((m) => m.name === 'Krypton 2')) return;
    const lwa = merchantsList.find((m) => m.name === 'LWA');
    try {
      if (lwa) {
        lwa.name = 'Krypton 2';
        if (lwa.id) await store.update(lwa.id, { name: 'Krypton 2' });
      } else {
        const saved = await store.save({ name: 'Krypton 2' });
        merchantsList.push(saved);
      }
    } catch {}
  }

  async function loadLearnedPatterns() {
    try {
      learnedPatterns = await makeStore('patterns').list();
    } catch {
      learnedPatterns = [];
    }
  }

  function renderMerchants() {
    if (!merchantListEl) return;
    merchantListEl.innerHTML = '';
    merchantsList.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'merchant-row';
      const name = document.createElement('span');
      name.className = 'merchant-name';
      const count = learnedPatterns.filter((p) => p.merchant === m.name).length;
      name.textContent = count ? `${m.name}  (${count} learned)` : m.name;
      row.appendChild(name);
      if (m.id) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger';
        del.textContent = 'Delete';
        del.addEventListener('click', () => deleteMerchant(m));
        row.appendChild(del);
      }
      merchantListEl.appendChild(row);
    });
  }

  async function addMerchant() {
    const name = (merchantNew && merchantNew.value || '').trim();
    if (!name) return;
    if (merchantsList.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setStatusInto(merchantStatus, `${name} already exists.`, 'warn');
      return;
    }
    try {
      const saved = await makeStore('merchants').save({ name });
      merchantsList.push(saved);
      if (merchantNew) merchantNew.value = '';
      setStatusInto(merchantStatus, `Added ${name}.`, 'ok');
      renderMerchants();
      renderRows();
    } catch (err) {
      setStatusInto(merchantStatus, `Add failed: ${err.message}`, 'err');
    }
  }

  async function deleteMerchant(m) {
    try {
      if (m.id) await makeStore('merchants').remove(m.id);
      merchantsList = merchantsList.filter((x) => x !== m);
      setStatusInto(merchantStatus, `Removed ${m.name}.`, 'ok');
      renderMerchants();
      renderRows();
    } catch (err) {
      setStatusInto(merchantStatus, `Delete failed: ${err.message}`, 'err');
    }
  }

  // Teach the detector: store this PDF's fingerprint -> merchant.
  async function learnMerchant(o) {
    if (!o.text || !o.merchant) return;
    const example = learnExample(o.text, o.merchant, o.fileName || '');
    learnedPatterns.push(example);
    try {
      await makeStore('patterns').save(example);
      setFedexStatus(`Learned ${o.merchant} from this format.`, 'ok');
    } catch (err) {
      setFedexStatus(`Couldn't save learned pattern: ${err.message}`, 'warn');
    }
  }

  function initMerchants() {
    if (merchantAdd) merchantAdd.addEventListener('click', addMerchant);
    if (merchantNew) {
      merchantNew.addEventListener('keydown', (e) => { if (e.key === 'Enter') addMerchant(); });
    }
    if (merchantRefresh) {
      merchantRefresh.addEventListener('click', async () => {
        await loadLearnedPatterns();
        await loadMerchants();
      });
    }
    if (savedFedexRefresh) savedFedexRefresh.addEventListener('click', loadSavedFedex);
    if (savedFedexDownload) {
      savedFedexDownload.addEventListener('click', () => {
        const rows = savedFedexRows.map((s) => (Array.isArray(s.cells) ? s.cells : [])).filter((c) => c.length);
        if (!rows.length) {
          setStatusInto(savedFedexStatus, 'Nothing to download — Refresh first.', 'warn');
          return;
        }
        downloadCells(rows, buildFileName(rows.length), (m, l) => setStatusInto(savedFedexStatus, m, l));
      });
    }
    renderMerchants();
  }

  // ---- Stock ----
  function initStock() {
    if (addToStockBtn) addToStockBtn.addEventListener('click', goAddToStock);
    if (stockRefresh) stockRefresh.addEventListener('click', loadStock);
    if (stockFromTracking) stockFromTracking.addEventListener('click', openTrackingPicker);
    if (stockAddManual) stockAddManual.addEventListener('click', addManualMove);
    if (stockPickerAdd) stockPickerAdd.addEventListener('click', addSelectedTracking);
    if (stockPickerCancel) {
      stockPickerCancel.addEventListener('click', () => { if (stockPicker) stockPicker.classList.add('hidden'); });
    }
    if (stockAddItem) stockAddItem.addEventListener('click', addStockItem);
    if (stockMerchantSel) {
      stockMerchantSel.addEventListener('change', () => {
        stockMerchant = stockMerchantSel.value;
        renderStock();
      });
    }
    // Keep stock filter in sync when user picks a merchant in the add-item form
    if (siMerchantSel) {
      siMerchantSel.addEventListener('change', () => {
        if (siMerchantSel.value) {
          stockMerchant = siMerchantSel.value;
          if (stockMerchantSel) stockMerchantSel.value = stockMerchant;
          renderStockPending();
          renderStockItems();
        }
      });
    }
    renderStock();
  }

  async function loadStock() {
    try {
      setStatusInto(stockStatus, 'Loading stock…');
      [stockItems, stockMoves] = await Promise.all([
        makeStore('stockitems').list(),
        makeStore('stockmoves').list(),
      ]);
      setStatusInto(stockStatus, `Loaded ${stockItems.length} item(s), ${stockMoves.length} movement(s).`, 'ok');
      renderStock();
    } catch (err) {
      setStatusInto(stockStatus, `Load failed: ${err.message}`, 'err');
    }
  }

  function merchantNames() {
    return merchantsList.map((m) => m.name).filter(Boolean);
  }

  function fillMerchantSelect(sel, value, placeholder) {
    sel.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = placeholder || '— all merchants —';
    sel.appendChild(blank);
    for (const name of merchantNames()) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === value) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  // Create pending movements from the orders currently loaded in the Builder.
  async function pullOrdersToPending() {
    if (!orders.length) {
      setStatusInto(stockStatus, 'No orders loaded in the Builder.', 'warn');
      return;
    }
    const store = makeStore('stockmoves');
    let made = 0;
    let skippedNoMerchant = 0;
    const today = toISODate(new Date());
    for (const o of orders) {
      if (!o.merchant) { skippedNoMerchant += 1; continue; }
      const products = resolveProducts(o);
      for (const p of products) {
        const dedupKey = movementDedupKey(o.dedupKey, p.label);
        if (stockMoves.some((m) => m.dedupKey === dedupKey)) continue;
        const move = {
          merchant: o.merchant,
          itemId: suggestItemId(stockItems, o.merchant, p.key) || '',
          product: p.label,
          qty: String(-Math.abs(toNum(p.qty) || 1)),
          date: today,
          country: '',
          batch: '',
          section: '',
          status: 'pending',
          orderKey: o.dedupKey || '',
          note: '',
          dedupKey,
        };
        try {
          // eslint-disable-next-line no-await-in-loop
          const saved = await store.save(move);
          saved._matchKey = p.key;
          // Replace if dedup returned an existing row, else add.
          const existingIdx = stockMoves.findIndex((m) => String(m.id) === String(saved.id));
          if (existingIdx >= 0) stockMoves[existingIdx] = saved; else stockMoves.push(saved);
          made += 1;
        } catch (err) {
          setStatusInto(stockStatus, `Save failed: ${err.message}`, 'err');
        }
      }
    }
    let msg = `Added ${made} pending movement(s).`;
    if (skippedNoMerchant) msg += ` Skipped ${skippedNoMerchant} order(s) with no merchant set.`;
    setStatusInto(stockStatus, msg, made ? 'ok' : 'warn');
    renderStock();
  }

  // --- Pull from the tracking sheet (select which rows) ---
  async function openTrackingPicker() {
    if (!stockMerchant) {
      setStatusInto(stockStatus, 'Pick a merchant above first — pulled rows are filed under it.', 'warn');
      return;
    }
    if (!savedTrackingRows.length) await loadSavedRows();
    renderTrackingPicker();
    if (stockPicker) stockPicker.classList.remove('hidden');
    if (!savedTrackingRows.length) {
      setStatusInto(stockStatus, 'No saved tracking rows yet — save some from the Builder first.', 'warn');
    }
  }

  function renderTrackingPicker() {
    if (!stockPickerHead || !stockPickerBody) return;
    stockPickerHead.innerHTML = '';
    const htr = document.createElement('tr');
    for (const h of ['Add', 'Date', 'Order #', 'Client', 'Product', 'Quantity']) {
      const th = document.createElement('th');
      th.textContent = h;
      htr.appendChild(th);
    }
    stockPickerHead.appendChild(htr);

    stockPickerBody.innerHTML = '';
    savedTrackingRows.forEach((row) => {
      const tr = document.createElement('tr');
      const td = (node) => { const c = document.createElement('td'); if (typeof node === 'string') c.textContent = node; else c.appendChild(node); tr.appendChild(c); };
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.id = row.id != null ? row.id : '';
      row._pick = cb;
      td(cb);
      td(row.date || '');
      td(row.orderNumber || '');
      td(row.client || '');
      td(row.product || '');
      td(row.quantity || '');
      stockPickerBody.appendChild(tr);
    });
  }

  async function addSelectedTracking() {
    const chosen = savedTrackingRows.filter((r) => r._pick && r._pick.checked);
    if (!chosen.length) { setStatusInto(stockStatus, 'Tick at least one tracking row.', 'warn'); return; }
    const store = makeStore('stockmoves');
    let made = 0;
    for (const row of chosen) {
      const products = String(row.product || '').split(',').map((s) => s.trim()).filter(Boolean);
      const qtys = String(row.quantity || '').split(',').map((s) => s.trim());
      for (let i = 0; i < products.length; i += 1) {
        const label = products[i];
        const qtyNum = Math.abs(toNum(qtys[i])) || 1;
        const orderKey = `track-${row.id || row.orderNumber}`;
        const dedupKey = movementDedupKey(orderKey, label);
        if (stockMoves.some((m) => m.dedupKey === dedupKey)) continue;
        const move = {
          merchant: stockMerchant,
          itemId: '',
          product: label,
          qty: String(-qtyNum),
          date: row.isoDate || row.date || toISODate(new Date()),
          country: row.destState || '',
          batch: '',
          section: '',
          status: 'pending',
          orderKey,
          note: 'from tracking',
          dedupKey,
        };
        try {
          // eslint-disable-next-line no-await-in-loop
          const saved = await store.save(move);
          const idx = stockMoves.findIndex((m) => String(m.id) === String(saved.id));
          if (idx >= 0) stockMoves[idx] = saved; else stockMoves.push(saved);
          made += 1;
        } catch (err) {
          setStatusInto(stockStatus, `Save failed: ${err.message}`, 'err');
        }
      }
    }
    if (stockPicker) stockPicker.classList.add('hidden');
    setStatusInto(stockStatus, `Added ${made} pending movement(s) from ${chosen.length} tracking row(s).`, made ? 'ok' : 'warn');
    renderStock();
  }

  // Add a blank pending movement to fill in by hand (back-entry).
  async function addManualMove() {
    const merchant = stockMerchant || (merchantNames()[0] || '');
    const move = {
      merchant,
      itemId: '',
      product: 'Manual entry',
      qty: '-1',
      date: toISODate(new Date()),
      country: '',
      batch: '',
      section: '',
      status: 'pending',
      orderKey: '',
      note: 'manual',
      dedupKey: `manual-${Date.now()}`,
    };
    try {
      const saved = await makeStore('stockmoves').save(move);
      stockMoves.push(saved);
      setStatusInto(stockStatus, 'Added a blank pending movement — map an item, set qty/date, then Confirm.', 'ok');
      renderStock();
    } catch (err) {
      setStatusInto(stockStatus, `Add failed: ${err.message}`, 'err');
    }
  }

  function itemsForMerchant(merchant) {
    return stockItems.filter((i) => !merchant || i.merchant === merchant);
  }

  async function addStockItem() {
    // Read from visible select or custom text input; hidden si-name is a fallback
    const siNameSelect = document.getElementById('si-name-select');
    const siNameCustom = document.getElementById('si-name-custom');
    let name = '';
    if (siNameSelect && siNameSelect.value && siNameSelect.value !== '__custom__') {
      name = siNameSelect.value.trim();
    } else if (siNameCustom && siNameCustom.style.display !== 'none') {
      name = siNameCustom.value.trim();
    } else if (siName) {
      name = siName.value.trim();
    }
    if (!name) { setStatusInto(stockStatus, 'Please select a product from the dropdown.', 'warn'); return; }
    const merchant = (siMerchantSel && siMerchantSel.value) || stockMerchant || (merchantNames()[0] || '');
    const item = {
      merchant,
      name,
      section: '',
      country: '',
      batch: (siBatch && siBatch.value || '').trim(),
      expiry: (siExpiry && siExpiry.value || '').trim(),
      opening: String(toNum(siOpening && siOpening.value)),
      matchKey: '',
    };
    try {
      const saved = await makeStore('stockitems').save(item);
      stockItems.push(saved);
      [siName, siBatch, siExpiry, siOpening].forEach((el) => { if (el) el.value = ''; });
      const siNameSelectEl = document.getElementById('si-name-select');
      const siNameCustomEl = document.getElementById('si-name-custom');
      if (siNameSelectEl) siNameSelectEl.value = '';
      if (siNameCustomEl) { siNameCustomEl.value = ''; siNameCustomEl.style.display = 'none'; }
      // Switch the filter to the new item's merchant so user can immediately see it
      if (merchant) {
        stockMerchant = merchant;
        if (stockMerchantSel) stockMerchantSel.value = stockMerchant;
      }
      if (siMerchantSel) siMerchantSel.value = '';
      setStatusInto(stockStatus, `✓ Added "${name}"${merchant ? ` for ${merchant}` : ''}.`, 'ok');
      renderStock();
    } catch (err) {
      setStatusInto(stockStatus, `Add item failed: ${err.message}`, 'err');
    }
  }

  async function saveStockItem(item) {
    try {
      await makeStore('stockitems').update(item.id, item);
      setStatusInto(stockStatus, `Saved item "${item.name}".`, 'ok');
      renderStock();
    } catch (err) {
      setStatusInto(stockStatus, `Save failed: ${err.message}`, 'err');
    }
  }

  async function deleteStockItem(item) {
    try {
      await makeStore('stockitems').remove(item.id);
      stockItems = stockItems.filter((i) => i !== item);
      setStatusInto(stockStatus, `Deleted item "${item.name}".`, 'ok');
      renderStock();
    } catch (err) {
      setStatusInto(stockStatus, `Delete failed: ${err.message}`, 'err');
    }
  }

  async function confirmMove(move) {
    if (!move.itemId) { setStatusInto(stockStatus, 'Assign a stock item before confirming.', 'warn'); return; }
    move.status = 'confirmed';
    try {
      await makeStore('stockmoves').update(move.id, move);
      setStatusInto(stockStatus, `Confirmed: ${move.qty} of ${move.product}.`, 'ok');
      renderStock();
    } catch (err) {
      move.status = 'pending';
      setStatusInto(stockStatus, `Confirm failed: ${err.message}`, 'err');
    }
  }

  async function deleteMove(move) {
    try {
      if (move.id) await makeStore('stockmoves').remove(move.id);
      stockMoves = stockMoves.filter((m) => m !== move);
      setStatusInto(stockStatus, 'Movement removed.', 'ok');
      renderStock();
    } catch (err) {
      setStatusInto(stockStatus, `Delete failed: ${err.message}`, 'err');
    }
  }

  // When a movement is assigned to an item, teach that item the product key.
  async function assignMoveItem(move, itemId) {
    move.itemId = itemId;
    const item = stockItems.find((i) => String(i.id) === String(itemId));
    if (item && !item.matchKey && move._matchKey) {
      item.matchKey = move._matchKey;
      try { await makeStore('stockitems').update(item.id, item); } catch {}
    }
    try { if (move.id) await makeStore('stockmoves').update(move.id, move); } catch {}
  }

  async function copyConfirmedMoves() {
    const moves = stockMoves.filter((m) => !stockMerchant || m.merchant === stockMerchant);
    const rows = movementsToRows(moves, stockItems);
    if (!rows.length) { setStatusInto(stockStatus, 'No confirmed movements to copy.', 'warn'); return; }
    const header = ['Date', 'Item', 'Qty', 'Country', 'Batch', 'Section'];
    const text = [header].concat(rows).map((r) => r.join('\t')).join('\n');
    try {
      await window.navigator.clipboard.writeText(text);
      setStatusInto(stockStatus, `Copied ${rows.length} confirmed movement(s).`, 'ok');
    } catch {
      setStatusInto(stockStatus, `Copy unavailable. Rows:\n${text}`, 'warn');
    }
  }

  function renderStock() {
    if (stockMerchantSel) fillMerchantSelect(stockMerchantSel, stockMerchant, '— all merchants —');
    if (siMerchantSel) fillMerchantSelect(siMerchantSel, siMerchantSel.value || stockMerchant || '', '— Merchant —');
    renderStockPending();
    renderStockItems();
  }

  function makeStockInput(value, onInput, cls = 'w-md') {
    const el = document.createElement('input');
    el.type = 'text';
    el.className = cls;
    el.value = value == null ? '' : String(value);
    el.addEventListener('input', () => onInput(el.value));
    return el;
  }

  function renderStockPending() {
    if (!stockPendingHead || !stockPendingBody) return;
    stockPendingHead.innerHTML = '';
    const htr = document.createElement('tr');
    for (const h of ['Date', 'Merchant', 'Product', 'Stock item', 'Qty', 'Country', 'Batch', 'Section', 'Actions']) {
      const th = document.createElement('th');
      th.textContent = h;
      htr.appendChild(th);
    }
    stockPendingHead.appendChild(htr);

    stockPendingBody.innerHTML = '';
    const pending = stockMoves.filter((m) => m.status !== 'confirmed' && (!stockMerchant || m.merchant === stockMerchant));
    pending.forEach((move) => {
      const tr = document.createElement('tr');
      const cell = (node) => { const td = document.createElement('td'); td.appendChild(node); tr.appendChild(td); };
      const txt = (s) => { const sp = document.createElement('span'); sp.textContent = s == null ? '' : String(s); return sp; };

      cell(makeStockInput(move.date, (v) => { move.date = v; }, 'w-md'));
      cell(txt(move.merchant));
      cell(makeStockInput(move.product, (v) => { move.product = v; }, 'w-md'));

      // Stock item dropdown (only this merchant's items).
      const sel = document.createElement('select');
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— map to item —';
      sel.appendChild(blank);
      for (const it of itemsForMerchant(move.merchant)) {
        const opt = document.createElement('option');
        opt.value = it.id;
        opt.textContent = `${it.name}${it.country ? ` [${it.country}]` : ''}${it.batch ? ` ·${it.batch}` : ''}`;
        if (String(move.itemId) === String(it.id)) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => assignMoveItem(move, sel.value));
      cell(sel);

      cell(makeStockInput(move.qty, (v) => { move.qty = v; }, 'w-sm'));
      cell(makeStockInput(move.country, (v) => { move.country = v; }, 'w-sm'));
      cell(makeStockInput(move.batch, (v) => { move.batch = v; }, 'w-sm'));
      cell(makeStockInput(move.section, (v) => { move.section = v; }, 'w-md'));

      const actTd = document.createElement('td');
      const act = document.createElement('div');
      act.className = 'row-actions';
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'primary';
      confirmBtn.textContent = 'Confirm';
      confirmBtn.addEventListener('click', () => confirmMove(move));
      act.appendChild(confirmBtn);
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteMove(move));
      act.appendChild(delBtn);
      actTd.appendChild(act);
      tr.appendChild(actTd);

      stockPendingBody.appendChild(tr);
    });
    if (!pending.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.className = 'empty-cell';
      td.textContent = 'No pending movements. Use “Pull loaded orders → pending” from the Builder batch.';
      tr.appendChild(td);
      stockPendingBody.appendChild(tr);
    }
  }

  function renderStockItems() {
    if (!stockItemsHead || !stockItemsBody) return;
    stockItemsHead.innerHTML = '';
    const htr = document.createElement('tr');
    for (const h of ['Item', 'Merchant', 'Batch', 'Expiry', 'Opening', 'Current', 'Actions']) {
      const th = document.createElement('th');
      th.textContent = h;
      htr.appendChild(th);
    }
    stockItemsHead.appendChild(htr);

    stockItemsBody.innerHTML = '';
    const items = itemsForMerchant(stockMerchant);
    items.forEach((item) => {
      const tr = document.createElement('tr');
      const cell = (node) => { const td = document.createElement('td'); td.appendChild(node); tr.appendChild(td); };
      cell(makeStockInput(item.name, (v) => { item.name = v; }, 'w-lg'));
      // Merchant cell — editable select
      const mSel = document.createElement('select');
      fillMerchantSelect(mSel, item.merchant || '');
      mSel.addEventListener('change', () => { item.merchant = mSel.value; });
      cell(mSel);
      cell(makeStockInput(item.batch, (v) => { item.batch = v; }, 'w-sm'));
      // Expiry as date input
      const expInp = document.createElement('input');
      expInp.type = 'date'; expInp.value = item.expiry || '';
      expInp.style.cssText = 'width:100%;background:transparent;border:1px solid transparent;color:#cbd5e1;font-size:11.5px;padding:3px 5px;font-family:inherit;border-radius:4px;cursor:pointer;';
      expInp.addEventListener('change', () => { item.expiry = expInp.value; });
      expInp.addEventListener('focus', () => { expInp.style.borderColor = 'var(--tacc)'; expInp.style.background = '#0f1b30'; });
      expInp.addEventListener('blur', () => { expInp.style.borderColor = 'transparent'; expInp.style.background = 'transparent'; });
      cell(expInp);
      cell(makeStockInput(item.opening, (v) => { item.opening = v; }, 'w-sm'));

      const cur = document.createElement('td');
      const curN = currentStock(item, stockMoves);
      cur.innerHTML = `<strong>${curN}</strong>`;
      if (curN < 0) cur.style.color = 'var(--err)';
      tr.appendChild(cur);

      const actTd = document.createElement('td');
      const act = document.createElement('div');
      act.className = 'row-actions';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'primary';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => saveStockItem(item));
      act.appendChild(saveBtn);
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteStockItem(item));
      act.appendChild(delBtn);
      actTd.appendChild(act);
      tr.appendChild(actTd);

      stockItemsBody.appendChild(tr);
    });
    if (!items.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'empty-cell';
      td.textContent = stockMerchant ? `No items for ${stockMerchant} yet — add some above.` : 'Pick a merchant and add items above.';
      tr.appendChild(td);
      stockItemsBody.appendChild(tr);
    }
  }

  // Cross-delete: FedEx shipments and tracking rows from the same order share a
  // dedupKey. After deleting one, offer to delete its linked counterpart so we
  // don't leave orphaned records.
  async function deleteLinkedByDedup(otherResource, dedupKey) {
    if (!dedupKey) return 0;
    const store = makeStore(otherResource);
    let list;
    try { list = await store.list(); } catch { return 0; }
    const matches = (list || []).filter((r) => r.dedupKey && String(r.dedupKey) === String(dedupKey));
    if (!matches.length) return 0;
    const name = otherResource === 'fedex' ? 'FedEx shipment' : 'tracking';
    const ask = typeof window.confirm === 'function'
      ? window.confirm(`Also delete the linked ${name} record? (keeps FedEx and tracking in sync)`)
      : true;
    if (!ask) return 0;
    for (const m of matches) { try { await store.remove(m.id); } catch {} } // eslint-disable-line no-await-in-loop
    const ids = new Set(matches.map((m) => String(m.id)));
    if (otherResource === 'fedex') {
      savedFedexRows = savedFedexRows.filter((r) => !ids.has(String(r.id)));
      orders = orders.map((o) => (ids.has(String(o.fedexId)) ? { ...o, fedexId: undefined } : o));
      renderSavedFedex();
      renderRows();
    } else {
      savedTrackingRows = savedTrackingRows.filter((r) => !ids.has(String(r.id)));
      trackingRows = trackingRows.map((r) => (ids.has(String(r.id)) ? { ...r, id: undefined } : r));
      renderAllTracking();
    }
    return matches.length;
  }

  // ---- Tracking section ----

  function getApiBase() {
    try {
      const stored = window.localStorage.getItem(API_BASE_KEY);
      if (stored !== null) return stored.trim();
    } catch {}
    return DEFAULT_API_BASE;
  }

  function makeStore(resource = 'rows') {
    const baseUrl = getApiBase();
    const fetchImpl = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    return createStore({ baseUrl, fetchImpl, storage: window.localStorage, resource });
  }

  // App settings: cached in memory, mirrored to localStorage, shared via D1.
  // Autosave defaults ON unless explicitly turned off.
  const settingsCache = {};
  function getSetting(key, dflt) {
    if (Object.prototype.hasOwnProperty.call(settingsCache, key)) return settingsCache[key];
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    } catch {}
    return dflt;
  }
  function setSetting(key, value) {
    settingsCache[key] = value;
    try { window.localStorage.setItem(key, value); } catch {}
    // Mirror to D1 (fire-and-forget).
    makeStore('settings').save({ key, value, dedupKey: key }).catch(() => {});
  }
  async function loadSettings() {
    try {
      const list = await makeStore('settings').list();
      for (const s of list) {
        if (s && s.key) {
          settingsCache[s.key] = s.value;
          try { window.localStorage.setItem(s.key, s.value); } catch {}
        }
      }
    } catch {}
    refreshAutosaveChecks();
  }
  function autosaveOn(section) {
    return getSetting(AUTOSAVE_KEYS[section], '1') !== '0';
  }
  function setAutosave(section, on) {
    setSetting(AUTOSAVE_KEYS[section], on ? '1' : '0');
  }
  function refreshAutosaveChecks() {
    if (fedexAutosave) fedexAutosave.checked = autosaveOn('fedex');
    if (trackAutosave) trackAutosave.checked = autosaveOn('rows');
  }

  // Debounced autosave timers keyed by the row/order object.
  const autosaveTimers = new WeakMap();
  function scheduleAutosave(obj, fn) {
    const prev = autosaveTimers.get(obj);
    if (prev) window.clearTimeout(prev);
    autosaveTimers.set(obj, window.setTimeout(fn, 1000));
  }

  function updateBackendBadge() {
    if (!trackBackend) return;
    const base = getApiBase();
    trackBackend.textContent = base ? 'D1 (Cloudflare)' : 'this browser (localStorage)';
    trackBackend.className = `backend-badge ${base ? 'd1' : 'local'}`;
  }

  function setTrackStatus(msg, level = '') {
    if (!trackingStatus) return;
    const line = document.createElement('div');
    line.className = `status-line ${level}`;
    line.textContent = msg;
    trackingStatus.appendChild(line);
    while (trackingStatus.children.length > 8) trackingStatus.removeChild(trackingStatus.firstChild);
    trackingStatus.scrollTop = trackingStatus.scrollHeight;
  }

  // Pull a dose/strength token from a product line, e.g. "100u", "50u",
  // "100IU", "500u", "10mg". Used to tell same-product, different-dose line
  // items apart (e.g. Botox 100u vs Botox 50u).
  function resolveProducts(order) {
    const lines = order.productLines && order.productLines.length
      ? order.productLines
      : (order.productText ? [order.productText] : []);
    return parseProductLines(lines).map((p) => {
      const detected = detect(p.text);
      // Append the dose so different doses of the same product are distinct
      // (Botox 100u vs Botox 50u) across tracking and stock. Catalog products
      // expose `name`; the built-in fallback uses `label`. Unknown products keep
      // their raw text.
      const base = detected ? (detected.name || detected.label || '') : '';
      const label = detected ? (labelWithDose(base, p.text) || base || p.text) : p.text;
      return { qty: p.qty, label, text: p.text, key: detected ? detected.key : '' };
    });
  }

  // Highest N among "prefix-N" order numbers of saved PDMS rows for a date.
  function maxPdmsSeq(prefix, rows) {
    const re = new RegExp(`^${prefix}-(\\d+)$`);
    let max = 0;
    for (const r of rows || []) {
      if (!isPdmsMerchant(r.merchant)) continue;
      const m = String(r.orderNumber || '').match(re);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max;
  }

  async function buildTrackingFromOrders() {
    const today = new Date();
    const prefix = dateCompact4(today);

    // PDMS PDFs carry no order number — generate ddmmyyyy-N, continuing from any
    // already-saved PDMS rows for the same date. Load saved rows first so the
    // sequence doesn't collide across sessions.
    const hasPdms = orders.some((o) => isPdmsMerchant(o.merchant));
    if (hasPdms && !savedTrackingRows.length) {
      try { await loadSavedRows(); } catch {}
    }
    const savedByDedup = new Map(
      savedTrackingRows.filter((r) => r.dedupKey).map((r) => [String(r.dedupKey), r])
    );
    let pdmsSeq = maxPdmsSeq(prefix, savedTrackingRows);

    trackingRows = orders.map((o, idx) => {
      let { orderId } = o;
      if (isPdmsMerchant(o.merchant)) {
        // Reuse the saved row's number if this PDF was saved before; else assign
        // the next sequence for this date.
        const existing = o.dedupKey && savedByDedup.get(String(o.dedupKey));
        const exMatch = existing && String(existing.orderNumber || '').match(new RegExp(`^${prefix}-(\\d+)$`));
        if (exMatch) orderId = exMatch[1];
        else { pdmsSeq += 1; orderId = String(pdmsSeq); }
      }
      const row = buildTrackingRow(
        { recipient: o.recipient, products: resolveProducts(o), merchant: o.merchant, orderId },
        idx,
        today,
        activeHs
      );
      row._origin = 'order';
      row.dedupKey = o.dedupKey || '';
      return row;
    });
  }

  // Wire a view's toolbar: filter box + selected-row action buttons.
  function wireTrackToolbar(view) {
    if (view.filter) {
      view.filter.addEventListener('input', () => {
        view.filterText = view.filter.value;
        renderTrackingRows(view);
      });
    }
    if (view.saveBtn) view.saveBtn.addEventListener('click', () => saveSelected(view));
    if (view.copyBtn) view.copyBtn.addEventListener('click', () => copySelected(view));
    if (view.deleteBtn) view.deleteBtn.addEventListener('click', () => deleteSelected(view));
  }

  // Build the merchant sub-tabs ("All" + one per merchant) for the By Merchant
  // view. Merchants come from the merchant list plus any seen in the data.
  function renderMerchantSubtabs() {
    if (!bmSubtabs) return;
    const view = TRACK_VIEWS.bymerchant;
    const names = new Set(merchantNames());
    savedTrackingRows.forEach((r) => { if (r.merchant) names.add(r.merchant); });
    const tabs = ['', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
    bmSubtabs.innerHTML = '';
    for (const name of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `subtab${view.merchant === name ? ' active' : ''}`;
      const count = savedTrackingRows.filter((r) => (name ? String(r.merchant || '') === name : true)).length;
      btn.textContent = `${name || 'All'} (${count})`;
      btn.addEventListener('click', () => {
        view.merchant = name;
        renderMerchantSubtabs();
        rerenderView(view);
      });
      bmSubtabs.appendChild(btn);
    }
  }

  function bmModeButtons() {
    if (bmDateMode && typeof bmDateMode.querySelectorAll === 'function') {
      return Array.from(bmDateMode.querySelectorAll('button'));
    }
    return [];
  }

  function setBmDateMode(mode) {
    const view = TRACK_VIEWS.bymerchant;
    view.dateMode = mode;
    bmModeButtons().forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    rerenderView(view);
  }

  function initByMerchant() {
    renderTrackingHeader(TRACK_VIEWS.bymerchant);
    wireTrackToolbar(TRACK_VIEWS.bymerchant);
    bmModeButtons().forEach((b) => {
      b.addEventListener('click', () => setBmDateMode(b.dataset.mode));
    });
    const onRange = () => {
      const view = TRACK_VIEWS.bymerchant;
      view.rangeFrom = bmFrom ? bmFrom.value : '';
      view.rangeTo = bmTo ? bmTo.value : '';
      if (view.dateMode !== 'range') setBmDateMode('range'); else rerenderView(view);
    };
    if (bmFrom) bmFrom.addEventListener('change', onRange);
    if (bmTo) bmTo.addEventListener('change', onRange);
    if (bmPaste) bmPaste.addEventListener('click', () => openPasteModal(TRACK_VIEWS.bymerchant));
    if (bmFile) bmFile.addEventListener('change', () => uploadTrackingFile(bmFile, TRACK_VIEWS.bymerchant));
    if (bmTemplate) bmTemplate.addEventListener('click', () => downloadTrackingTemplate(bmStatus));
    if (bmRefresh) bmRefresh.addEventListener('click', () => { loadSavedRows().then(renderMerchantSubtabs); });
    if (bmDownload) {
      bmDownload.addEventListener('click', () => {
        const rows = filteredRows(TRACK_VIEWS.bymerchant);
        if (!rows.length) {
          setStatusInto(bmStatus, 'Nothing to download for this selection.', 'warn');
          return;
        }
        const who = TRACK_VIEWS.bymerchant.merchant || 'all';
        const aoa = [TRACKING_HEADERS].concat(rows.map((r) => trackingRowToCells(r)));
        downloadAoa(aoa, `Tracking_${who}_${dateStamp()}_${rows.length}rows.xlsx`, (m, l) => setStatusInto(bmStatus, m, l));
      });
    }
  }

  function initTracking() {
    renderTrackingHeader(TRACK_VIEWS.builder);
    renderTrackingHeader(TRACK_VIEWS.saved);
    wireTrackToolbar(TRACK_VIEWS.builder);
    wireTrackToolbar(TRACK_VIEWS.saved);
    initByMerchant();
    initToday();
    initMaster();
    if (trackApiUrl) trackApiUrl.value = getApiBase();
    updateBackendBadge();
    if (trackSaveUrl) {
      trackSaveUrl.addEventListener('click', () => {
        const v = (trackApiUrl.value || '').trim().replace(/\/+$/, '');
        try { window.localStorage.setItem(API_BASE_KEY, v); } catch {}
        if (trackApiUrl) trackApiUrl.value = v;
        updateBackendBadge();
        updateFedexBackend();
        setTrackStatus(
          v ? `Sync URL saved — saves now go to D1 at ${v}` : 'Sync URL cleared — saves go to this browser.',
          'ok'
        );
      });
    }
    if (savedTrackPaste) savedTrackPaste.addEventListener('click', () => openPasteModal(TRACK_VIEWS.saved));
    if (savedTrackFile) savedTrackFile.addEventListener('change', () => uploadTrackingFile(savedTrackFile, TRACK_VIEWS.saved));
    if (savedTrackTemplate) savedTrackTemplate.addEventListener('click', () => downloadTrackingTemplate(savedTrackStatus));
    if (savedTrackRefresh) savedTrackRefresh.addEventListener('click', loadSavedRows);
    if (savedTrackDownload) {
      savedTrackDownload.addEventListener('click', () => {
        if (!savedTrackingRows.length) {
          setStatusInto(savedTrackStatus, 'Nothing to download — Refresh first.', 'warn');
          return;
        }
        const aoa = [TRACKING_HEADERS].concat(savedTrackingRows.map((r) => trackingRowToCells(r)));
        downloadAoa(aoa, `Tracking_${dateStamp()}_${savedTrackingRows.length}rows.xlsx`, (m, l) => setStatusInto(savedTrackStatus, m, l));
      });
    }
    if (trackAutosave) {
      trackAutosave.checked = autosaveOn('rows');
      trackAutosave.addEventListener('change', () => {
        setAutosave('rows', trackAutosave.checked);
        setTrackStatus(trackAutosave.checked ? 'Autosave on — rows save as you edit.' : 'Autosave off.', 'ok');
      });
    }
    renderAllTracking();
  }

  function renderTrackingHeader(view) {
    const headEl = view && view.head;
    if (!headEl) return;
    const table = headEl.parentElement;
    const oldCols = table.querySelector('colgroup');
    if (oldCols) oldCols.remove();
    const colgroup = document.createElement('colgroup');
    [TRACKING_SELECT_WIDTH].concat(TRACKING_COL_WIDTHS).forEach((w) => {
      const col = document.createElement('col');
      col.style.width = `${w}%`;
      colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.firstChild);

    headEl.innerHTML = '';
    const tr = document.createElement('tr');

    // Leading "select all" checkbox (Excel-style header toggle).
    const selTh = document.createElement('th');
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.className = 'row-select';
    selectAll.title = 'Select all rows';
    selectAll.addEventListener('change', () => {
      const visible = filteredRows(view);
      visible.forEach((r) => { r._selected = selectAll.checked; });
      renderTrackingRows(view);
    });
    selTh.appendChild(selectAll);
    tr.appendChild(selTh);
    view.selectAll = selectAll;

    // Each column header is an Excel-style dropdown: click to sort and/or filter.
    TRACKING_HEADERS.forEach((h, i) => {
      const key = TRACKING_KEYS[i];
      const th = document.createElement('th');
      th.className = 'col-head';
      th.dataset.colIdx = String(i); // track original index for reorder persistence

      const label = document.createElement('span');
      label.className = 'col-label';
      label.textContent = h;

      const caret = document.createElement('span');
      caret.className = 'col-caret';
      const sorted = view.sort && view.sort.key === key;
      const filtered = view.colFilters[key] && view.colFilters[key].size;
      caret.textContent = sorted ? (view.sort.dir === 'desc' ? '▼' : '▲') : '▾';
      if (sorted || filtered) th.classList.add('col-active');

      th.appendChild(label);
      th.appendChild(caret);
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        openColumnMenu(view, key, th);
      });
      tr.appendChild(th);
    });
    headEl.appendChild(tr);
    _wireColLayout(view, tr);
  }

  function input(value, cls, onInput) {
    const el = document.createElement('input');
    el.type = 'text';
    el.className = cls;
    el.value = value ?? '';
    el.addEventListener('input', () => onInput(el.value));
    return el;
  }

  function dateInput(isoValue, onChange) {
    const el = document.createElement('input');
    el.type = 'date';
    el.className = 'w-md';
    if (isoValue) el.value = isoValue;
    el.addEventListener('change', () => onChange(el.value));
    // Open the native calendar as soon as the field is focused/clicked.
    const pop = () => { try { el.showPicker && el.showPicker(); } catch {} };
    el.addEventListener('focus', pop);
    el.addEventListener('click', pop);
    return el;
  }

  // FedEx "track by number" deep link.
  function fedexTrackUrl(number) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(String(number || '').trim())}`;
  }

  // Tracking-number cell: a text input plus a tiny arrow that opens the FedEx
  // tracking page for the entered number. The arrow shows on focus/hover (CSS)
  // and only when a number is present.
  function trackingNumberCell(row) {
    const wrap = document.createElement('div');
    wrap.className = 'tracknum';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'tracknum-go';
    go.textContent = '↗';
    go.tabIndex = -1;
    go.title = 'Track on fedex.com';
    go.style.display = (row.trackingNumber || '').trim() ? '' : 'none';
    const el = input(row.trackingNumber, 'w-md', (v) => {
      row.trackingNumber = v;
      go.style.display = v.trim() ? '' : 'none';
    });
    // Don't steal focus from the input before the click registers.
    go.addEventListener('mousedown', (e) => e.preventDefault());
    go.addEventListener('click', () => {
      const n = (row.trackingNumber || '').trim();
      if (!n) return;
      try { window.open(fedexTrackUrl(n), '_blank', 'noopener'); } catch {}
    });
    wrap.appendChild(el);
    wrap.appendChild(go);
    return wrap;
  }

  // Distinct status options for the dropdown (defaults + custom, de-duped).
  function statusOptions() {
    const out = [];
    const seen = new Set();
    for (const s of deliveryStatuses) {
      const t = String(s || '').trim();
      if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
    }
    return out;
  }

  // Add a new delivery status to the shared list (persisted) and refresh.
  function addDeliveryStatus(name) {
    const t = String(name || '').trim();
    if (!t) return;
    if (!deliveryStatuses.some((s) => s.toLowerCase() === t.toLowerCase())) {
      deliveryStatuses.push(t);
      try { setSetting('delivery_statuses', JSON.stringify(deliveryStatuses)); } catch {}
    }
    renderAllTracking();
  }

  // Load the saved status list (setting) and merge in defaults.
  function loadDeliveryStatuses() {
    let list = ['Pending', 'Delivered'];
    try {
      const raw = getSetting('delivery_statuses', '');
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) list = arr.map((s) => String(s)); }
    } catch {}
    for (const d of ['Pending', 'Delivered']) {
      if (!list.some((s) => String(s).toLowerCase() === d.toLowerCase())) list.unshift(d);
    }
    deliveryStatuses = list;
  }

  // Union any statuses seen in rows into the option list (no persist).
  function mergeStatusesFromRows(rows) {
    for (const r of rows || []) {
      const t = String(r.deliveryStatus || '').trim();
      if (t && !deliveryStatuses.some((s) => s.toLowerCase() === t.toLowerCase())) deliveryStatuses.push(t);
    }
  }

  // Delivery-status dropdown: options + "+ Add status…". Adding a status keeps
  // it for future rows; the select is colour-coded by status.
  function deliveryStatusCell(row, view) {
    const sel = document.createElement('select');
    const cur = rowStatus(row);
    sel.className = `status-select ${statusClass(cur)}`;
    const opts = statusOptions();
    if (!opts.some((o) => o.toLowerCase() === cur.toLowerCase())) opts.push(cur);
    for (const s of opts) {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      if (s === cur) o.selected = true;
      sel.appendChild(o);
    }
    const addOpt = document.createElement('option');
    addOpt.value = '__add__'; addOpt.textContent = '+ Add status…';
    sel.appendChild(addOpt);
    sel.dataset.prev = cur;
    sel.addEventListener('change', () => {
      if (sel.value === '__add__') {
        const name = (typeof window.prompt === 'function' ? window.prompt('New delivery status:') : '') || '';
        const t = name.trim();
        if (!t) { sel.value = sel.dataset.prev; return; }
        row.deliveryStatus = t;
        addDeliveryStatus(t); // persists + re-renders all selects/dashboards
        return;
      }
      row.deliveryStatus = sel.value;
      sel.dataset.prev = sel.value;
      sel.className = `status-select ${statusClass(sel.value)}`;
      renderStatusDashboard(view);
    });
    return sel;
  }

  // "Delivered on": calendar field + a one-click Today button.
  function deliveredCell(row) {
    const wrap = document.createElement('div');
    wrap.className = 'delivered';
    const el = dateInput(row.deliveredOnIso || '', (iso) => {
      row.deliveredOnIso = iso;
      row.deliveredOn = iso ? formatDateDDMMYY(fromISODate(iso)) : '';
    });
    const today = document.createElement('button');
    today.type = 'button';
    today.className = 'today-btn';
    today.textContent = 'Today';
    today.addEventListener('click', () => {
      const iso = toISODate(new Date());
      el.value = iso;
      row.deliveredOnIso = iso;
      row.deliveredOn = formatDateDDMMYY(new Date());
      if (autosaveOn('rows')) scheduleAutosave(row, () => saveRow(row, { silent: true }));
    });
    wrap.appendChild(el);
    wrap.appendChild(today);
    return wrap;
  }

  function renderAllTracking() {
    renderTrackingRows(TRACK_VIEWS.builder);
    renderTrackingRows(TRACK_VIEWS.saved);
    renderTrackingRows(TRACK_VIEWS.bymerchant);
    renderTrackingRows(TRACK_VIEWS.today);
    renderTrackingRows(TRACK_VIEWS.master);
  }

  // The displayed text of a column cell (used for the toolbar filter + column
  // filter checkboxes — matches what the user sees).
  function cellText(row, key) {
    return String(row[key] ?? '');
  }

  // The value a column sorts by. Dates sort chronologically via their ISO form.
  function cellSortValue(row, key) {
    if (key === 'date') return row.isoDate || '';
    if (key === 'deliveredOn') return row.deliveredOnIso || '';
    return cellText(row, key);
  }

  // Apply only the top toolbar's free-text filter (across all cells).
  function globalFiltered(rows, filterText) {
    const q = (filterText || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => trackingRowToCells(r).join(' ').toLowerCase().includes(q));
  }

  // Distinct values present in a column (after the global filter), for the
  // column dropdown's checkbox list.
  function columnValues(view, key) {
    let base = view.getRows();
    if (view.prefilter) base = base.filter(view.prefilter);
    const set = new Set();
    globalFiltered(base, view.filterText).forEach((r) => set.add(cellText(r, key)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  // Rows matching the view's toolbar filter + every active column filter, in the
  // current sort order.
  // True if a row passes the By Merchant view's merchant + date scope.
  function bmRowMatches(view, row) {
    if (view.merchant && String(row.merchant || '') !== view.merchant) return false;
    const iso = row.isoDate || '';
    if (view.dateMode === 'today') return iso === toISODate(new Date());
    if (view.dateMode === 'range') {
      if (view.rangeFrom && (!iso || iso < view.rangeFrom)) return false;
      if (view.rangeTo && (!iso || iso > view.rangeTo)) return false;
      return true;
    }
    return true; // 'all'
  }

  // The status shown for a row, defaulting blank/legacy rows to Pending.
  function rowStatus(row) {
    return String(row.deliveryStatus || '').trim() || 'Pending';
  }

  // Rows after merchant/date prefilter + free-text + column filters, but BEFORE
  // the dashboard status filter — so the dashboard counts stay stable.
  function scopedRows(view) {
    let rows = view.getRows();
    if (view.prefilter) rows = rows.filter(view.prefilter);
    rows = globalFiltered(rows, view.filterText);
    const cf = view.colFilters || {};
    for (const key of Object.keys(cf)) {
      const allowed = cf[key];
      if (allowed && allowed.size) rows = rows.filter((r) => allowed.has(cellText(r, key)));
    }
    return rows;
  }

  function filteredRows(view) {
    let rows = scopedRows(view);
    if (view.statusFilter) rows = rows.filter((r) => rowStatus(r) === view.statusFilter);
    if (view.sort && view.sort.key) {
      const { key, dir } = view.sort;
      const factor = dir === 'desc' ? -1 : 1;
      rows = rows.slice().sort((a, b) =>
        factor * cellSortValue(a, key).localeCompare(cellSortValue(b, key), undefined, { numeric: true, sensitivity: 'base' }));
    }
    return rows;
  }

  // Normalise a status to a CSS class for colour-coding.
  function statusClass(s) {
    const t = String(s || '').trim().toLowerCase();
    if (!t) return 'st-all';
    if (t === 'delivered') return 'st-delivered';
    if (t === 'pending') return 'st-pending';
    return 'st-other';
  }

  // Colour-coded, clickable totals above a table. Counts come from scopedRows
  // (ignoring the active status filter); clicking a chip filters the table.
  function renderStatusDashboard(view) {
    const el = view.dash;
    if (!el) return;
    const rows = scopedRows(view);
    const counts = {};
    for (const r of rows) { const s = rowStatus(r); counts[s] = (counts[s] || 0) + 1; }
    el.innerHTML = '';
    const chip = (label, key, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dash-chip ${statusClass(key)}${view.statusFilter === key ? ' active' : ''}`;
      b.textContent = `${label}: ${n}`;
      b.addEventListener('click', () => {
        view.statusFilter = view.statusFilter === key ? '' : key;
        renderTrackingRows(view);
      });
      el.appendChild(b);
    };
    chip('All', '', rows.length);
    const seen = new Set();
    const ordered = [];
    for (const s of deliveryStatuses.concat(Object.keys(counts))) {
      const t = String(s || '').trim();
      if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); ordered.push(t); }
    }
    for (const s of ordered) chip(s, s, counts[s] || 0);
  }

  // Re-render a view's header (to refresh sort arrows / active markers) and body.
  function rerenderView(view) {
    renderTrackingHeader(view);
    renderTrackingRows(view);
  }

  // --- Excel-style column dropdown (sort + per-value filter) ---
  let openColMenu = null;
  function closeColumnMenu() {
    if (openColMenu) {
      if (openColMenu.parentNode) openColMenu.parentNode.removeChild(openColMenu);
      document.removeEventListener('mousedown', onColMenuOutside, true);
      openColMenu = null;
    }
  }
  function onColMenuOutside(e) {
    if (!openColMenu) return;
    if (openColMenu.contains(e.target)) return;
    // Let header clicks be handled by their own toggle logic.
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('.col-head')) return;
    closeColumnMenu();
  }
  function menuButton(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    if (cls) b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function openColumnMenu(view, key, anchor) {
    const reopen = openColMenu && openColMenu.dataset.key === key && openColMenu.dataset.view === view.body.id;
    closeColumnMenu();
    if (reopen) return; // clicking the same header again closes it

    const menu = document.createElement('div');
    menu.className = 'col-menu';
    menu.dataset.key = key;
    menu.dataset.view = view.body.id;
    menu.addEventListener('click', (e) => e.stopPropagation());

    // Sort controls.
    const sortRow = document.createElement('div');
    sortRow.className = 'col-menu-sort';
    sortRow.appendChild(menuButton('Sort ↑ A–Z', '', () => { view.sort = { key, dir: 'asc' }; closeColumnMenu(); rerenderView(view); }));
    sortRow.appendChild(menuButton('Sort ↓ Z–A', '', () => { view.sort = { key, dir: 'desc' }; closeColumnMenu(); rerenderView(view); }));
    menu.appendChild(sortRow);

    // Search within the value list.
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'col-menu-search';
    search.placeholder = 'Search values…';
    menu.appendChild(search);

    // (Select all) + distinct value checkboxes.
    const list = document.createElement('div');
    list.className = 'col-menu-list';
    const current = view.colFilters[key]; // Set, or undefined = "all selected"
    const checks = [];

    const allLabel = document.createElement('label');
    allLabel.className = 'col-menu-item col-menu-all';
    const allBox = document.createElement('input');
    allBox.type = 'checkbox';
    allBox.checked = !current;
    allLabel.appendChild(allBox);
    allLabel.appendChild(document.createTextNode('(Select all)'));
    list.appendChild(allLabel);

    columnValues(view, key).forEach((val) => {
      const item = document.createElement('label');
      item.className = 'col-menu-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !current || current.has(val);
      cb.dataset.val = val;
      item.appendChild(cb);
      item.appendChild(document.createTextNode(val === '' ? '(blank)' : val));
      list.appendChild(item);
      checks.push(cb);
    });
    menu.appendChild(list);

    allBox.addEventListener('change', () => { checks.forEach((cb) => { cb.checked = allBox.checked; }); });
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      list.querySelectorAll('.col-menu-item').forEach((el) => {
        if (el === allLabel) return;
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Footer: Apply / Clear.
    const footer = document.createElement('div');
    footer.className = 'col-menu-footer';
    footer.appendChild(menuButton('Apply', 'primary', () => {
      const allowed = new Set();
      let allChecked = true;
      checks.forEach((cb) => { if (cb.checked) allowed.add(cb.dataset.val); else allChecked = false; });
      if (allChecked) delete view.colFilters[key];
      else view.colFilters[key] = allowed;
      closeColumnMenu();
      rerenderView(view);
    }));
    footer.appendChild(menuButton('Clear', 'danger', () => {
      delete view.colFilters[key];
      if (view.sort && view.sort.key === key) view.sort = null;
      closeColumnMenu();
      rerenderView(view);
    }));
    menu.appendChild(footer);

    document.body.appendChild(menu);
    positionColumnMenu(menu, anchor);
    openColMenu = menu;
    window.setTimeout(() => document.addEventListener('mousedown', onColMenuOutside, true), 0);
  }

  function positionColumnMenu(menu, anchor) {
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;
    const r = anchor.getBoundingClientRect();
    const sx = window.scrollX || 0;
    const sy = window.scrollY || 0;
    const vw = (window.innerWidth || document.documentElement.clientWidth || 0);
    let left = r.left + sx;
    const top = r.bottom + sy + 2;
    const width = menu.offsetWidth || 220;
    if (vw && left + width > sx + vw) left = Math.max(sx + 4, sx + vw - width - 4);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  // Selected rows across the whole view (selection persists through filtering).
  function selectedRows(view) {
    return view.getRows().filter((r) => r._selected);
  }

  // Sync the toolbar's selected-count + the header "select all" checkbox state.
  function updateTrackToolbar(view) {
    const selected = selectedRows(view);
    const n = selected.length;
    if (view.count) view.count.textContent = `${n} selected`;
    for (const btn of [view.saveBtn, view.copyBtn, view.deleteBtn]) {
      if (btn) btn.disabled = n === 0;
    }
    if (view.selectAll) {
      const visible = filteredRows(view);
      const visSel = visible.filter((r) => r._selected).length;
      view.selectAll.checked = visible.length > 0 && visSel === visible.length;
      view.selectAll.indeterminate = visSel > 0 && visSel < visible.length;
    }
  }

  function renderTrackingRows(view) {
    const tbody = view && view.body;
    if (!tbody) return;
    tbody.innerHTML = '';
    filteredRows(view).forEach((row) => {
      const tr = document.createElement('tr');
      if (row.id) tr.classList.add('saved');
      if (row._selected) tr.classList.add('row-selected');

      const tdMap = {};
      const cell = (key, node) => {
        const td = document.createElement('td');
        td.appendChild(node);
        tr.appendChild(td);
        tdMap[key] = node;
      };

      // Leading select checkbox — drives the toolbar actions.
      const selTd = document.createElement('td');
      const selBox = document.createElement('input');
      selBox.type = 'checkbox';
      selBox.className = 'row-select';
      selBox.checked = !!row._selected;
      selBox.addEventListener('change', () => {
        row._selected = selBox.checked;
        tr.classList.toggle('row-selected', selBox.checked);
        updateTrackToolbar(view);
      });
      selTd.appendChild(selBox);
      tr.appendChild(selTd);

      // day (dropdown) — linked to date + order number
      const daySel = document.createElement('select');
      for (const wd of WEEKDAYS) {
        const opt = document.createElement('option');
        opt.value = wd;
        opt.textContent = wd;
        if (wd === row.day) opt.selected = true;
        daySel.appendChild(opt);
      }
      daySel.addEventListener('change', () => {
        const base = fromISODate(row.isoDate) || new Date();
        const moved = setWeekdayWithinWeek(base, WEEKDAYS.indexOf(daySel.value));
        applyDate(row, moved, tdMap, false);
      });
      cell('day', daySel);

      // Date (calendar) — linked to day + order number
      cell('date', dateInput(row.isoDate, (iso) => {
        const d = fromISODate(iso);
        if (d) applyDate(row, d, tdMap, true);
      }));

      cell('orderNumber', input(row.orderNumber, 'w-md', (v) => { row.orderNumber = v; }));
      cell('trackingNumber', trackingNumberCell(row));
      cell('product', input(row.product, 'w-xl', (v) => { row.product = v; }));
      cell('quantity', input(row.quantity, 'w-sm', (v) => { row.quantity = v; }));
      cell('productDescription', input(row.productDescription, 'w-xl', (v) => { row.productDescription = v; }));
      cell('destCity', input(row.destCity, 'w-md', (v) => { row.destCity = v; }));
      {
        const stateInput = input(row.destState, 'w-md', (v) => { row.destState = v; });
        const fullName = expandState(row.destState);
        if (fullName && fullName !== row.destState) stateInput.title = fullName;
        cell('destState', stateInput);
      }

      // Account dropdown
      const accSel = document.createElement('select');
      for (const a of ACCOUNTS) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        if (a === row.account) opt.selected = true;
        accSel.appendChild(opt);
      }
      accSel.addEventListener('change', () => { row.account = accSel.value; });
      cell('account', accSel);

      cell('client', input(row.client, 'w-md', (v) => { row.client = v; }));

      // Delivered on (calendar + one-click Today, empty by default)
      cell('deliveredOn', deliveredCell(row));
      cell('deliveryStatus', deliveryStatusCell(row, view));

      cell('comments', input(row.comments, 'w-lg', (v) => { row.comments = v; }));
      cell('directionRemarks', input(row.directionRemarks, 'w-lg', (v) => { row.directionRemarks = v; }));

      // Krypton invoice fields — global columns, filled in manually for Krypton.
      cell('supplier', input(row.supplier, 'w-md', (v) => { row.supplier = v; }));
      cell('pfi', input(row.pfi, 'w-sm', (v) => { row.pfi = v; }));
      cell('totalValue', input(row.totalValue, 'w-md', (v) => { row.totalValue = v; }));
      cell('gapDdp', input(row.gapDdp, 'w-sm', (v) => { row.gapDdp = v; }));
      cell('boxDim', input(row.boxDim, 'w-md', (v) => { row.boxDim = v; }));
      // "From Whom" pre-fills for Ph.Chic, blank elsewhere; both stay editable.
      cell('fromWhom', input(row.fromWhom, 'w-md', (v) => { row.fromWhom = v; }));
      cell('shippingCost', input(row.shippingCost, 'w-sm', (v) => { row.shippingCost = v; }));

      // Merchant dropdown — drives the By Merchant tab; editable to re-file a row.
      const merchSel = document.createElement('select');
      const names = merchantNames();
      const opts = [''].concat(names);
      if (row.merchant && !names.includes(row.merchant)) opts.push(row.merchant);
      for (const m of opts) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m || '— merchant —';
        if (m === (row.merchant || '')) opt.selected = true;
        merchSel.appendChild(opt);
      }
      merchSel.addEventListener('change', () => { row.merchant = merchSel.value; });
      cell('merchant', merchSel);

      // Autosave: any edit (typing or dropdown/date change) within the row.
      // Ticking the select checkbox isn't an edit — don't trigger a save for it.
      const queueAutosave = (e) => {
        if (e && e.target && e.target.classList.contains('row-select')) return;
        if (autosaveOn('rows')) scheduleAutosave(row, () => saveRow(row, { silent: true, resource: view.resource || 'rows' }));
      };
      tr.addEventListener('input', queueAutosave);
      tr.addEventListener('change', queueAutosave);

      _applyColLayoutToRow(view, tr);
      tbody.appendChild(tr);
    });
    updateTrackToolbar(view);
    renderStatusDashboard(view);
  }

  // --- Toolbar actions: operate on the view's selected rows ---
  async function saveSelected(view) {
    const sel = selectedRows(view);
    if (!sel.length) return;
    const store = makeStore(view.resource || 'rows');
    let ok = 0;
    let fail = 0;
    for (const row of sel) {
      try {
        const saved = row.id ? await store.update(row.id, row) : await store.save(row); // eslint-disable-line no-await-in-loop
        row.id = saved.id;
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setStatusInto(
      view.status,
      `Saved ${ok} row(s)${fail ? `, ${fail} failed` : ''} to ${store.backend === 'd1' ? 'D1' : 'this browser'}.`,
      fail ? 'warn' : 'ok'
    );
    renderAllTracking();
  }

  async function copySelected(view) {
    const sel = selectedRows(view);
    if (!sel.length) return;
    const text = sel.map((r) => trackingRowToCells(r).join('\t')).join('\n');
    try {
      await window.navigator.clipboard.writeText(text);
      setStatusInto(view.status, `Copied ${sel.length} row(s) to clipboard (tab-separated).`, 'ok');
    } catch {
      setStatusInto(view.status, `Copy unavailable here.\n${text}`, 'warn');
    }
  }

  async function deleteSelected(view) {
    const sel = selectedRows(view);
    if (!sel.length) return;
    if (typeof window.confirm === 'function' && !window.confirm(`Delete ${sel.length} selected row(s)?`)) return;
    const store = makeStore(view.resource || 'rows');
    for (const row of sel) {
      if (row.id) { try { await store.remove(row.id); } catch {} } // eslint-disable-line no-await-in-loop
    }
    const selSet = new Set(sel);
    if ((view.resource || 'rows') === 'master') {
      masterRows = masterRows.filter((r) => !selSet.has(r));
    } else {
      trackingRows = trackingRows.filter((r) => !selSet.has(r));
      savedTrackingRows = savedTrackingRows.filter((r) => !selSet.has(r));
    }
    setStatusInto(view.status, `Deleted ${sel.length} row(s).`, 'ok');
    renderAllTracking();
  }

  // --- Paste from Excel: upsert saved rows from a copied table ---
  function blankTrackingRow() {
    const r = {};
    for (const k of TRACKING_KEYS) r[k] = '';
    r.isoDate = '';
    r.deliveredOnIso = '';
    r.dedupKey = '';
    r._origin = 'paste';
    return r;
  }

  // Apply pasted date cells: re-derive isoDate/day from the Date cell and the
  // delivered-on ISO from its cell, when they parse.
  function applyPastedDates(row, fields) {
    if ('date' in fields) {
      const d = parseFlexibleDate(fields.date);
      if (d && !Number.isNaN(d.getTime())) {
        row.isoDate = toISODate(d);
        row.date = formatDateDDMMYY(d);
        row.day = weekdayName(d);
      }
    }
    if ('deliveredOn' in fields) {
      const d = parseFlexibleDate(fields.deliveredOn);
      if (d && !Number.isNaN(d.getTime())) {
        row.deliveredOnIso = toISODate(d);
        row.deliveredOn = formatDateDDMMYY(d);
      } else if (!String(fields.deliveredOn || '').trim()) {
        row.deliveredOnIso = '';
      }
    }
  }

  // Parse a copied Excel table and upsert it into the view's rows, matching
  // existing rows by Order number (others are added). Writes to the view's own
  // store/resource, so the right dataset is updated.
  async function applyPaste(text, view) {
    const statusEl = view.status;
    const parsed = parsePastedTable(text);
    if (!parsed.length) { setStatusInto(statusEl, 'Nothing to paste — copy the table from Excel first.', 'warn'); return; }
    const store = makeStore(view.resource || 'rows');
    const rows = view.getRows();
    let updated = 0;
    let added = 0;
    let skipped = 0;
    let failed = 0;
    for (const fields of parsed) {
      const on = String(fields.orderNumber || '').trim();
      if (!on) { skipped += 1; continue; } // need a key to match/insert
      let target = rows.find((r) => String(r.orderNumber || '').trim() === on);
      if (target) { updated += 1; } else { target = blankTrackingRow(); rows.push(target); added += 1; }
      Object.assign(target, fields);
      applyPastedDates(target, fields);
      try {
        const saved = target.id ? await store.update(target.id, target) : await store.save(target); // eslint-disable-line no-await-in-loop
        target.id = saved.id;
      } catch { failed += 1; }
    }
    setStatusInto(
      statusEl,
      `Paste: updated ${updated}, added ${added}`
        + `${skipped ? `, skipped ${skipped} (no order number)` : ''}`
        + `${failed ? `, ${failed} failed` : ''}.`,
      failed ? 'warn' : 'ok'
    );
    renderAllTracking();
    renderMerchantSubtabs();
  }

  // Read an uploaded .xlsx/.csv file and upsert it into the view (same logic as
  // paste). Reuses the catalog file reader (xlsx -> CSV via SheetJS).
  function uploadTrackingFile(fileInput, view) {
    return handleCatalogFile(fileInput, (text) => applyPaste(text, view), view.status);
  }

  // Example row for the downloadable Excel template, so the format is obvious.
  const TRACKING_EXAMPLE = {
    day: 'Monday', date: '01.06.26', orderNumber: '010626-1', trackingNumber: '794600000000',
    product: 'Botox 100u (ENG)', quantity: '1',
    productDescription: 'Advanced formulation for aesthetic applications',
    destCity: 'Charlotte', destState: 'North Carolina', account: 'Fedex', client: 'Jane Doe',
    deliveredOn: '', deliveryStatus: 'Pending', comments: '', directionRemarks: '',
    supplier: '', pfi: '', totalValue: '', gapDdp: '', boxDim: '', fromWhom: '', shippingCost: '',
    merchant: 'Krypton 2',
  };

  // Download an .xlsx template: the exact header row + one example row to fill.
  function downloadTrackingTemplate(statusEl) {
    const example = TRACKING_KEYS.map((k) => TRACKING_EXAMPLE[k] ?? '');
    downloadAoa([TRACKING_HEADERS, example], 'Tracking_template.xlsx', (m, l) => setStatusInto(statusEl, m, l));
  }

  // Modal with a textarea for the user to paste the copied Excel table into.
  function openPasteModal(view) {
    const overlay = document.createElement('div');
    overlay.className = 'paste-overlay';
    const box = document.createElement('div');
    box.className = 'paste-box';
    const h = document.createElement('h3');
    h.textContent = 'Paste from Excel';
    const p = document.createElement('p');
    p.textContent = 'Copy the whole table in Excel (including the header row), click in the box below and paste (Ctrl/Cmd+V), then Apply. Rows are matched to existing ones by Order number; unknown order numbers are added.';
    const ta = document.createElement('textarea');
    ta.className = 'paste-textarea';
    ta.setAttribute('aria-label', 'Pasted table');
    const actions = document.createElement('div');
    actions.className = 'paste-actions';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'primary';
    apply.textContent = 'Apply';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    apply.addEventListener('click', () => { const v = ta.value; close(); applyPaste(v, view); });
    cancel.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    actions.appendChild(apply);
    actions.appendChild(cancel);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(ta);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    ta.focus();
  }

  // Apply a new Date to a row, syncing day / date / order-number controls.
  function applyDate(row, date, tdMap, fromCalendar) {
    row.isoDate = toISODate(date);
    row.date = formatDateDDMMYY(date);
    row.day = weekdayName(date);
    // Activa and PDMS order numbers carry a date prefix (ddmmyyyy-<suffix>), so
    // they re-derive when the Date changes. Other merchants use the PDF order
    // number verbatim and are left untouched.
    if (isDatePrefixedMerchant(row.merchant)) {
      const dash = String(row.orderNumber).indexOf('-');
      const suffix = dash >= 0 ? String(row.orderNumber).slice(dash + 1) : '';
      row.orderNumber = suffix ? `${dateCompact4(date)}-${suffix}` : dateCompact4(date);
      if (tdMap.orderNumber) tdMap.orderNumber.value = row.orderNumber;
    }
    if (tdMap.day) tdMap.day.value = row.day;
    if (tdMap.date && !fromCalendar) tdMap.date.value = row.isoDate;
  }

  async function saveRow(row, { silent = false, resource = 'rows' } = {}) {
    const store = makeStore(resource);
    try {
      if (!silent) setTrackStatus(row.id ? `Overwriting id ${row.id}…` : 'Saving…');
      const saved = row.id ? await store.update(row.id, row) : await store.save(row);
      row.id = saved.id;
      setTrackStatus(
        `${silent ? 'Autosaved' : 'Saved'} order ${row.orderNumber} (id ${saved.id}) to ${store.backend === 'd1' ? 'D1' : 'this browser'}.`,
        'ok'
      );
      // Don't re-render on a silent autosave — it would steal focus mid-typing.
      // row.id is already set in memory, so the next save correctly updates.
      if (!silent) renderAllTracking();
    } catch (err) {
      setTrackStatus(`Save failed: ${err.message}`, 'err');
    }
  }

  // Loads saved tracking rows into the "Saved Tracking" tab.
  async function loadSavedRows() {
    const store = makeStore('rows');
    const status = (m, l) => setStatusInto(savedTrackStatus, m, l);
    try {
      status(`Loading saved rows from ${store.backend === 'd1' ? 'D1' : 'this browser'}…`);
      const saved = await store.list();
      savedTrackingRows = saved.map((s) => ({
        ...s,
        isoDate: s.isoDate || '',
        deliveredOnIso: s.deliveredOnIso || '',
        _origin: 'db',
      }));
      mergeStatusesFromRows(savedTrackingRows);
      const filled = await backfillMerchants();
      status(`Loaded ${savedTrackingRows.length} saved row(s)${filled ? `, detected merchant for ${filled}` : ''}.`, 'ok');
      renderAllTracking();
    } catch (err) {
      status(`Load failed: ${err.message}`, 'err');
    }
  }

  // Loads the Master List (its own table) into memory.
  async function loadMaster() {
    const store = makeStore('master');
    const status = (m, l) => setStatusInto(masterStatus, m, l);
    try {
      status(`Loading master list from ${store.backend === 'd1' ? 'D1' : 'this browser'}…`);
      const rows = await store.list();
      masterRows = rows.map((s) => ({
        ...s, isoDate: s.isoDate || '', deliveredOnIso: s.deliveredOnIso || '', _origin: 'master',
      }));
      mergeStatusesFromRows(masterRows);
      status(`Loaded ${masterRows.length} master row(s).`, 'ok');
      renderAllTracking();
    } catch (err) {
      status(`Load failed: ${err.message}`, 'err');
    }
  }

  // A stable per-order key for upserting into the master list, so re-promoting
  // an order updates its master record instead of duplicating it.
  function masterKeyFor(row) {
    return String(row.dedupKey || `${row.orderNumber || ''}|${row.date || ''}`);
  }

  // Promote today's rows (or the current selection) into the master list. Only
  // the promoted orders are upserted; previously promoted master rows are left
  // untouched.
  async function promoteToMaster() {
    const view = TRACK_VIEWS.today;
    const selected = selectedRows(view);
    const rows = selected.length ? selected : filteredRows(view);
    if (!rows.length) { setStatusInto(todayStatus, 'No today rows to promote.', 'warn'); return; }
    if (typeof window.confirm === 'function'
      && !window.confirm(`Update the master list with ${rows.length} order(s)? Existing master records for these orders are overwritten; all other master rows are untouched.`)) return;
    const store = makeStore('master');
    let ok = 0;
    let fail = 0;
    for (const row of rows) {
      const record = {};
      for (const k of TRACKING_FIELDS) record[k] = row[k] ?? '';
      record.dedupKey = masterKeyFor(row); // upsert key
      try { await store.save(record); ok += 1; } catch { fail += 1; } // eslint-disable-line no-await-in-loop
    }
    setStatusInto(todayStatus, `Promoted ${ok} order(s) to the master list${fail ? `, ${fail} failed` : ''}.`, fail ? 'warn' : 'ok');
    await loadMaster();
  }

  function initToday() {
    renderTrackingHeader(TRACK_VIEWS.today);
    wireTrackToolbar(TRACK_VIEWS.today);
    if (todayRefresh) todayRefresh.addEventListener('click', loadSavedRows);
    if (todayPromote) todayPromote.addEventListener('click', promoteToMaster);
    if (todayPaste) todayPaste.addEventListener('click', () => openPasteModal(TRACK_VIEWS.today));
    if (todayFile) todayFile.addEventListener('change', () => uploadTrackingFile(todayFile, TRACK_VIEWS.today));
    if (todayTemplate) todayTemplate.addEventListener('click', () => downloadTrackingTemplate(todayStatus));
    if (todayDownload) {
      todayDownload.addEventListener('click', () => {
        const rows = filteredRows(TRACK_VIEWS.today);
        if (!rows.length) { setStatusInto(todayStatus, 'No today rows to download.', 'warn'); return; }
        const aoa = [TRACKING_HEADERS].concat(rows.map((r) => trackingRowToCells(r)));
        downloadAoa(aoa, `Today_${dateStamp()}_${rows.length}rows.xlsx`, (m, l) => setStatusInto(todayStatus, m, l));
      });
    }
  }

  function initMaster() {
    renderTrackingHeader(TRACK_VIEWS.master);
    wireTrackToolbar(TRACK_VIEWS.master);
    if (masterRefresh) masterRefresh.addEventListener('click', loadMaster);
    if (masterPaste) masterPaste.addEventListener('click', () => openPasteModal(TRACK_VIEWS.master));
    if (masterFile) masterFile.addEventListener('change', () => uploadTrackingFile(masterFile, TRACK_VIEWS.master));
    if (masterTemplate) masterTemplate.addEventListener('click', () => downloadTrackingTemplate(masterStatus));
    if (masterDownload) {
      masterDownload.addEventListener('click', () => {
        if (!masterRows.length) { setStatusInto(masterStatus, 'Nothing to download — Refresh first.', 'warn'); return; }
        const aoa = [TRACKING_HEADERS].concat(masterRows.map((r) => trackingRowToCells(r)));
        downloadAoa(aoa, `Master_${dateStamp()}_${masterRows.length}rows.xlsx`, (m, l) => setStatusInto(masterStatus, m, l));
      });
    }
  }

  // Legacy rows (saved before the merchant column existed) have no merchant.
  // Recover it the same way detection does — from the parser source — by
  // matching each row to its saved FedEx shipment via the shared dedupKey and
  // mapping source -> merchant. In-memory only; persists when the row is saved.
  async function backfillMerchants() {
    if (!savedTrackingRows.some((r) => !r.merchant && r.dedupKey)) return 0;
    let fedexRows = savedFedexRows;
    if (!fedexRows || !fedexRows.length) {
      try { fedexRows = await makeStore('fedex').list(); } catch { fedexRows = []; }
    }
    const merchantByDedup = new Map();
    for (const f of (fedexRows || [])) {
      const m = f && f.source ? SOURCE_TO_MERCHANT[f.source] : '';
      if (f && f.dedupKey && m) merchantByDedup.set(String(f.dedupKey), m);
    }
    let filled = 0;
    savedTrackingRows.forEach((r) => {
      if (!r.merchant && r.dedupKey && merchantByDedup.has(String(r.dedupKey))) {
        r.merchant = merchantByDedup.get(String(r.dedupKey));
        filled += 1;
      }
    });
    return filled;
  }

  async function readDataTransfer(dt) {
    const items = dt.items ? Array.from(dt.items) : [];
    const out = [];
    if (items.length && typeof items[0].webkitGetAsEntry === 'function') {
      const entries = items.map((it) => it.webkitGetAsEntry()).filter(Boolean);
      await Promise.all(entries.map((e) => walkEntry(e, out)));
      return out;
    }
    return Array.from(dt.files);
  }

  async function walkEntry(entry, out) {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      out.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      while (true) {
        const batch = await new Promise((resolve, reject) =>
          reader.readEntries(resolve, reject)
        );
        if (!batch.length) break;
        all.push(...batch);
      }
      await Promise.all(all.map((e) => walkEntry(e, out)));
    }
  }

  // ================= Catalog tab: products + HS codes =================
  const PRODUCT_COLS = [
    ['name', 'Name', 'w-md'], ['mid', 'MID', 'w-md'], ['country', 'Country', 'w-sm'],
    ['description', 'Description', 'w-lg'], ['hsCode', 'HS code', 'w-md'],
    ['manufacturerName', 'Manufacturer', 'w-md'], ['manufacturingCountry', 'Mfg country', 'w-sm'],
    ['manufacturingAddress', 'Mfg address', 'w-lg'], ['keywords', 'Keywords', 'w-md'],
  ];
  const PRODUCT_ALIASES = {
    'product name': 'name', name: 'name', product: 'name', key: 'key',
    mid: 'mid', 'mid code': 'mid', country: 'country', origin: 'country',
    description: 'description', desc: 'description',
    'hs code': 'hsCode', hs: 'hsCode', hscode: 'hsCode', 'harmonized code': 'hsCode',
    'manufacturer name': 'manufacturerName', manufacturer: 'manufacturerName',
    'manufacturing country': 'manufacturingCountry', 'mfg country': 'manufacturingCountry',
    'manufacturing address': 'manufacturingAddress', 'mfg address': 'manufacturingAddress', address: 'manufacturingAddress',
    keywords: 'keywords', aliases: 'keywords', status: 'status',
  };
  const HS_ALIASES = {
    description: 'description', desc: 'description', code: 'code', 'hs code': 'code',
    hscode: 'code', 'harmonized code': 'code', status: 'status', position: 'position',
  };

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40) || `p${Date.now()}`;
  }
  function blankProduct() {
    return {
      key: '', name: '', mid: '', country: '', description: '', hsCode: '',
      manufacturerName: '', manufacturingCountry: '', manufacturingAddress: '',
      keywords: '', status: 'active',
    };
  }

  function renderHeadRow(headEl, labels) {
    if (!headEl) return;
    headEl.innerHTML = '';
    const tr = document.createElement('tr');
    for (const label of labels) { const th = document.createElement('th'); th.textContent = label; tr.appendChild(th); }
    headEl.appendChild(tr);
  }

  function renderProductsTable() {
    renderHeadRow(productsHead, PRODUCT_COLS.map(([, l]) => l).concat(['Status', '']));
    if (!productsBody) return;
    productsBody.innerHTML = '';
    const filt = productStatusFilter ? productStatusFilter.value : 'active';
    const rows = productsList.filter((p) => (filt === 'all' ? true : (p.status || 'active') === filt));
    rows.forEach((p) => {
      const tr = document.createElement('tr');
      if ((p.status || 'active') !== 'active') tr.classList.add('row-inactive');
      for (const [key, , cls] of PRODUCT_COLS) {
        const td = document.createElement('td');
        td.appendChild(input(p[key], cls || 'w-md', (v) => { p[key] = v; }));
        tr.appendChild(td);
      }
      const stTd = document.createElement('td');
      const stSel = document.createElement('select');
      for (const s of PRODUCT_STATUSES) {
        const o = document.createElement('option'); o.value = s; o.textContent = s;
        if ((p.status || 'active') === s) o.selected = true; stSel.appendChild(o);
      }
      stSel.addEventListener('change', () => { p.status = stSel.value; saveProduct(p); });
      stTd.appendChild(stSel); tr.appendChild(stTd);
      const actTd = document.createElement('td');
      const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Save';
      save.addEventListener('click', () => saveProduct(p));
      actTd.appendChild(save); tr.appendChild(actTd);
      productsBody.appendChild(tr);
    });
  }

  async function saveProduct(p) {
    const store = makeStore('products');
    if (!p.key) p.key = slug(p.name);
    p.dedupKey = `prod:${p.key}`;
    try {
      const saved = p.id ? await store.update(p.id, p) : await store.save(p);
      p.id = saved.id;
      rebuildCatalog(); renderRows();
      setStatusInto(productStatus, `Saved ${p.name || p.key} (${p.status || 'active'}).`, 'ok');
    } catch (e) { setStatusInto(productStatus, `Save failed: ${e.message}`, 'err'); }
  }

  function addProductRow() {
    productsList.push(blankProduct());
    if (productStatusFilter) productStatusFilter.value = 'all';
    renderProductsTable();
  }

  async function importProducts(text) {
    const recs = parseRecords(text, PRODUCT_ALIASES);
    if (!recs.length) {
      setStatusInto(productStatus, 'No rows recognised — include a header row with at least a "Product name" column.', 'warn');
      return;
    }
    openImportConfirm(recs.length, 'products', (mode) => applyProductImport(recs, mode));
  }

  async function applyProductImport(recs, mode) {
    const store = makeStore('products');
    if (mode === 'replace') {
      for (const p of productsList.slice()) {
        if (p.id) { try { await store.remove(p.id); } catch {} } // eslint-disable-line no-await-in-loop
      }
      productsList = [];
    }
    let added = 0; let updated = 0; let failed = 0;
    for (const rec of recs) {
      if (!rec.name && !rec.key) continue;
      const key = (rec.key && rec.key.trim()) || slug(rec.name);
      let target = productsList.find((p) => p.key === key);
      if (!target) { target = blankProduct(); productsList.push(target); added += 1; } else updated += 1;
      Object.assign(target, rec, { key, status: rec.status || target.status || 'active', dedupKey: `prod:${key}` });
      try {
        const saved = target.id ? await store.update(target.id, target) : await store.save(target); // eslint-disable-line no-await-in-loop
        target.id = saved.id;
      } catch { failed += 1; }
    }
    rebuildCatalog(); renderProductsTable(); renderRows();
    setStatusInto(
      productStatus,
      `${mode === 'replace' ? 'Replaced catalogue —' : 'Import:'} added ${added}, updated ${updated}${failed ? `, ${failed} failed` : ''}.`,
      failed ? 'warn' : 'ok',
    );
  }

  function downloadProductTemplate() {
    const headers = ['Product name', 'MID', 'Country', 'Description', 'HS code',
      'Manufacturer name', 'Manufacturing country', 'Manufacturing address', 'Keywords', 'Status'];
    const example = ['Example Drug 50mg', 'XXEXAMPLE001', 'IE',
      'Advanced formulation for aesthetic applications', '3304991000',
      'Acme Pharma Ltd', 'IE', '1 Example Street, Dublin', 'exampledrug, ex-50', 'active'];
    downloadAoa([headers, example], 'Products_template.xlsx', (m, l) => setStatusInto(productStatus, m, l));
  }

  // ---- HS codes ----
  function renderHsTable() {
    renderHeadRow(hsHead, ['Description', 'Code', 'Position', 'Status', '']);
    if (!hsBody) return;
    hsBody.innerHTML = '';
    const rows = hsList.slice().sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
    rows.forEach((h) => {
      const tr = document.createElement('tr');
      if ((h.status || 'active') !== 'active') tr.classList.add('row-inactive');
      tr.appendChild((() => { const td = document.createElement('td'); td.appendChild(input(h.description, 'w-xl', (v) => { h.description = v; })); return td; })());
      tr.appendChild((() => { const td = document.createElement('td'); td.appendChild(input(h.code, 'w-md', (v) => { h.code = v; })); return td; })());
      tr.appendChild((() => { const td = document.createElement('td'); td.appendChild(input(String(h.position ?? ''), 'w-sm', (v) => { h.position = v; })); return td; })());
      const stTd = document.createElement('td');
      const stSel = document.createElement('select');
      for (const s of PRODUCT_STATUSES) { const o = document.createElement('option'); o.value = s; o.textContent = s; if ((h.status || 'active') === s) o.selected = true; stSel.appendChild(o); }
      stSel.addEventListener('change', () => { h.status = stSel.value; saveHs(h); });
      stTd.appendChild(stSel); tr.appendChild(stTd);
      const actTd = document.createElement('td');
      const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Save';
      save.addEventListener('click', () => saveHs(h));
      actTd.appendChild(save); tr.appendChild(actTd);
      hsBody.appendChild(tr);
    });
  }

  async function saveHs(h) {
    const store = makeStore('hscodes');
    if (h.position === '' || h.position == null) h.position = hsList.length;
    h.position = Number(h.position) || 0;
    h.dedupKey = `hs:${h.position}`;
    try {
      const saved = h.id ? await store.update(h.id, h) : await store.save(h);
      h.id = saved.id;
      rebuildCatalog();
      setStatusInto(hsStatus, `Saved HS code #${h.position}.`, 'ok');
    } catch (e) { setStatusInto(hsStatus, `Save failed: ${e.message}`, 'err'); }
  }

  function addHsRow() {
    const maxPos = hsList.reduce((m, h) => Math.max(m, Number(h.position) || 0), -1);
    hsList.push({ description: '', code: '', status: 'active', position: maxPos + 1 });
    renderHsTable();
  }

  async function importHs(text) {
    const recs = parseRecords(text, HS_ALIASES);
    if (!recs.length) { setStatusInto(hsStatus, 'No rows recognised — include a header row with a "Description" and/or "Code" column.', 'warn'); return; }
    openImportConfirm(recs.length, 'HS codes', (mode) => applyHsImport(recs, mode));
  }

  async function applyHsImport(recs, mode) {
    const store = makeStore('hscodes');
    if (mode === 'replace') {
      for (const h of hsList.slice()) {
        if (h.id) { try { await store.remove(h.id); } catch {} } // eslint-disable-line no-await-in-loop
      }
      hsList = [];
    }
    let added = 0; let updated = 0; let failed = 0;
    let nextPos = hsList.reduce((m, h) => Math.max(m, Number(h.position) || 0), -1) + 1;
    for (const rec of recs) {
      const pos = (rec.position !== undefined && rec.position !== '') ? Number(rec.position) : (nextPos += 1, nextPos - 1);
      let target = hsList.find((h) => Number(h.position) === pos);
      if (!target) { target = { description: '', code: '', status: 'active', position: pos }; hsList.push(target); added += 1; } else updated += 1;
      Object.assign(target, rec, { position: pos, status: rec.status || target.status || 'active', dedupKey: `hs:${pos}` });
      try {
        const saved = target.id ? await store.update(target.id, target) : await store.save(target); // eslint-disable-line no-await-in-loop
        target.id = saved.id;
      } catch { failed += 1; }
    }
    rebuildCatalog(); renderHsTable();
    setStatusInto(
      hsStatus,
      `${mode === 'replace' ? 'Replaced HS list —' : 'Import:'} added ${added}, updated ${updated}${failed ? `, ${failed} failed` : ''}.`,
      failed ? 'warn' : 'ok',
    );
  }

  function downloadHsTemplate() {
    const headers = ['Description', 'Code', 'Position', 'Status'];
    const example = ['Example cosmetic description, non-animal origin, non-colorant, EN packaging', '3304991000', '0', 'active'];
    downloadAoa([headers, example], 'HS_codes_template.xlsx', (m, l) => setStatusInto(hsStatus, m, l));
  }

  // Ask whether an import should replace the whole catalogue/list or add to it.
  // "Replace all" is guarded by a second confirm so it can't happen by mistake.
  function openImportConfirm(count, what, onChoose) {
    const overlay = document.createElement('div');
    overlay.className = 'paste-overlay';
    const box = document.createElement('div');
    box.className = 'paste-box';
    const h = document.createElement('h3');
    h.textContent = `Import ${count} ${what}`;
    const p = document.createElement('p');
    p.textContent = `Choose how to import. "Add / update" keeps the current ${what} and adds new entries or updates matches. "Replace all" first DELETES every current ${what} entry, then loads the imported ${count} — use this only for a fresh catalogue. This cannot be undone.`;
    const actions = document.createElement('div');
    actions.className = 'paste-actions';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'primary'; add.textContent = 'Add / update';
    const replace = document.createElement('button'); replace.type = 'button'; replace.className = 'danger'; replace.textContent = 'Replace all';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    add.addEventListener('click', () => { close(); onChoose('add'); });
    replace.addEventListener('click', () => {
      const ok = typeof window.confirm !== 'function'
        || window.confirm(`Delete ALL current ${what} and replace them with the imported ${count}? This cannot be undone.`);
      if (ok) { close(); onChoose('replace'); }
    });
    cancel.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    actions.appendChild(add); actions.appendChild(replace); actions.appendChild(cancel);
    box.appendChild(h); box.appendChild(p); box.appendChild(actions);
    overlay.appendChild(box); document.body.appendChild(overlay);
  }

  // ---- Catalog load / seed ----
  async function loadCatalog() {
    const pStore = makeStore('products');
    const hStore = makeStore('hscodes');
    try {
      let products = await pStore.list();
      if (!products.length) {
        for (const s of builtinSeedProducts()) { await pStore.save({ ...s, dedupKey: `prod:${s.key}` }); } // eslint-disable-line no-await-in-loop
        products = await pStore.list();
      }
      if (products.length) productsList = products;
    } catch { /* keep built-in seed */ }
    try {
      let hs = await hStore.list();
      if (!hs.length) {
        for (const s of builtinSeedHsCodes()) { await hStore.save({ ...s, dedupKey: `hs:${s.position}` }); } // eslint-disable-line no-await-in-loop
        hs = await hStore.list();
      }
      if (hs.length) hsList = hs;
    } catch { /* keep built-in seed */ }
    rebuildCatalog();
    renderProductsTable();
    renderHsTable();
    renderRows();
  }

  // ---- File + modal helpers ----
  async function handleCatalogFile(fileInput, applyFn, statusEl) {
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const name = (file.name || '').toLowerCase();
      let text;
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      } else {
        text = await file.text();
      }
      await applyFn(text);
    } catch (e) {
      setStatusInto(statusEl, `File import failed: ${e.message}`, 'err');
    }
    fileInput.value = '';
  }

  // Generic paste-text modal (used by catalog imports).
  function openTextModal(title, hint, onApply) {
    const overlay = document.createElement('div');
    overlay.className = 'paste-overlay';
    const box = document.createElement('div');
    box.className = 'paste-box';
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = hint;
    const ta = document.createElement('textarea'); ta.className = 'paste-textarea';
    const actions = document.createElement('div'); actions.className = 'paste-actions';
    const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'primary'; apply.textContent = 'Apply';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    apply.addEventListener('click', () => { const v = ta.value; close(); onApply(v); });
    cancel.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    actions.appendChild(apply); actions.appendChild(cancel);
    box.appendChild(h); box.appendChild(p); box.appendChild(ta); box.appendChild(actions);
    overlay.appendChild(box); document.body.appendChild(overlay); ta.focus();
  }

  // Single-product add/edit modal (used by the builder quick-add).
  function openProductModal(prefill, onSaved) {
    const p = { ...blankProduct(), ...(prefill || {}) };
    const overlay = document.createElement('div');
    overlay.className = 'paste-overlay';
    const box = document.createElement('div');
    box.className = 'paste-box';
    const h = document.createElement('h3'); h.textContent = 'Add product to catalog';
    box.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'prod-form';
    const fields = [
      ['name', 'Product name'], ['mid', 'MID code'], ['country', 'Country'],
      ['description', 'Description'], ['hsCode', 'HS code'],
      ['manufacturerName', 'Manufacturer name'], ['manufacturingCountry', 'Manufacturing country'],
      ['manufacturingAddress', 'Manufacturing address'], ['keywords', 'Keywords (comma-separated)'],
    ];
    for (const [key, label] of fields) {
      const wrap = document.createElement('label'); wrap.className = 'prod-field';
      const span = document.createElement('span'); span.textContent = label;
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = p[key] || '';
      inp.addEventListener('input', () => { p[key] = inp.value; });
      wrap.appendChild(span); wrap.appendChild(inp); grid.appendChild(wrap);
    }
    box.appendChild(grid);
    const actions = document.createElement('div'); actions.className = 'paste-actions';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Save product';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    save.addEventListener('click', async () => {
      if (!p.name.trim()) return;
      p.key = slug(p.name);
      if (!p.manufacturingCountry) p.manufacturingCountry = p.country;
      productsList.push(p);
      await saveProduct(p);
      renderProductsTable();
      close();
      if (typeof onSaved === 'function') onSaved(p);
    });
    cancel.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    actions.appendChild(save); actions.appendChild(cancel);
    box.appendChild(actions);
    overlay.appendChild(box); document.body.appendChild(overlay);
  }

  function initCatalog() {
    renderHeadRow(productsHead, PRODUCT_COLS.map(([, l]) => l).concat(['Status', '']));
    renderHeadRow(hsHead, ['Description', 'Code', 'Position', 'Status', '']);
    if (productAdd) productAdd.addEventListener('click', addProductRow);
    if (productImport) productImport.addEventListener('click', () => openTextModal(
      'Import products',
      'Paste rows (CSV or tab-separated) with a header row. Columns: Product name, MID, Country, Description, HS code, Manufacturer name, Manufacturing country, Manufacturing address, Keywords, Status. Matched/updated by name.',
      importProducts,
    ));
    if (productTemplate) productTemplate.addEventListener('click', downloadProductTemplate);
    if (productFile) productFile.addEventListener('change', () => handleCatalogFile(productFile, importProducts, productStatus));
    if (productRefresh) productRefresh.addEventListener('click', loadCatalog);
    if (productStatusFilter) productStatusFilter.addEventListener('change', renderProductsTable);
    if (hsAdd) hsAdd.addEventListener('click', addHsRow);
    if (hsImport) hsImport.addEventListener('click', () => openTextModal(
      'Import HS codes',
      'Paste rows (CSV or tab-separated) with a header row. Columns: Description, Code, Position, Status. Matched/updated by Position.',
      importHs,
    ));
    if (hsTemplate) hsTemplate.addEventListener('click', downloadHsTemplate);
    if (hsFile) hsFile.addEventListener('change', () => handleCatalogFile(hsFile, importHs, hsStatus));
    if (hsRefresh) hsRefresh.addEventListener('click', loadCatalog);
  }

  // Initialise the save/tracking sections last and defensively: a failure here
  // must never prevent the upload listeners above from being wired up.
  try {
    initTabs();
    initFedex();
    initTracking();
    initCatalog();
    initMerchants();
    initStock();
    // Load settings (autosave toggles) + merchants + learned patterns (async).
    loadSettings().then(() => { loadDeliveryStatuses(); renderAllTracking(); }).catch(() => {});
    loadLearnedPatterns().then(loadMerchants).catch(() => {});
    loadCatalog().catch(() => {});
  } catch (err) {
    setTrackStatus(`Save sections failed to initialise: ${err.message}`, 'err');
    if (window.console) window.console.error(err);
  }

  return {
    get orders() { return orders; },
    get masterRows() { return masterRows; },
    ingestFiles,
  };
}

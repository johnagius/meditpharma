import { dispatch } from './parsers/index.js';
import { readPdfText } from './pdfReader.js';
import { PRODUCTS, detectProduct, findProductByKey } from './data/midCodes.js';
import { buildFileName } from './excelExporter.js';
import { HEADER_ROW, buildRow } from './buildRow.js';
import {
  TRACKING_HEADERS,
  ACCOUNTS,
  WEEKDAYS,
  buildTrackingRow,
  trackingRowToCells,
  parseProductLines,
  formatDateDDMMYY,
  weekdayName,
  orderNumberFor,
  setWeekdayWithinWeek,
  toISODate,
  fromISODate,
} from './trackingRow.js';
import { createStore } from './trackingStore.js';

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
  const fedexLoad = document.getElementById('btn-fedex-load');
  const fedexBackend = document.getElementById('fedex-backend');
  const fedexStatus = document.getElementById('fedex-status');

  // Tracking section elements
  const trackApiUrl = document.getElementById('track-api-url');
  const trackSaveUrl = document.getElementById('btn-track-save-url');
  const trackLoadSaved = document.getElementById('btn-track-load');
  const trackAutosave = document.getElementById('chk-track-autosave');
  const trackBackend = document.getElementById('track-backend');
  const trackingHead = document.getElementById('tracking-head');
  const trackingBody = document.getElementById('tracking-body');
  const trackingStatus = document.getElementById('tracking-status');

  const AUTOSAVE_KEYS = {
    fedex: 'pharmaconsulta_autosave_fedex',
    rows: 'pharmaconsulta_autosave_rows',
  };

  const API_BASE_KEY = 'pharmaconsulta_tracking_api_base';
  // Default Cloudflare Worker (D1) endpoint. Used unless the user overrides it
  // via the Sync API URL box (saving an explicit value — including blank).
  const DEFAULT_API_BASE = 'https://pharmaconsulta-tracking.labrint.workers.dev';
  // Proportional column widths (%) aligned with TRACKING_HEADERS + Actions.
  const TRACKING_COL_WIDTHS = [5, 6, 6, 6, 8, 4, 10, 7, 6, 7, 7, 6, 8, 8, 6];

  const headers = HEADER_ROW();
  let orders = [];
  let trackingRows = [];

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
    // Keep rows loaded from the database; drop the order-derived ones.
    orders = orders.filter((o) => o._loaded);
    statusEl.textContent = '';
    renderRows();
    trackingRows = trackingRows.filter((r) => r._origin === 'db');
    renderTracking();
  });

  downloadBtn.addEventListener('click', () => {
    if (!orders.length) return;
    // Use each row's editable `cells` (kept in sync with inline edits and what
    // is saved to D1); fall back to a fresh buildRow for any row without them.
    const aoa = [HEADER_ROW()].concat(
      orders.map((o, i) => o.cells || buildRow({ recipient: o.recipient, product: o.product }, i))
    );
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
    a.download = buildFileName(orders.length);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
    setStatus(`Downloaded ${a.download}`, 'ok');
  });

  function setStatus(msg, level = '') {
    const line = document.createElement('div');
    line.className = `status-line ${level}`;
    line.textContent = msg;
    statusEl.appendChild(line);
    while (statusEl.children.length > 12) statusEl.removeChild(statusEl.firstChild);
  }

  async function ingestFiles(fileList) {
    const pdfs = fileList.filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      setStatus('No PDF files found in selection.', 'warn');
      renderRows();
      return;
    }
    setStatus(`Reading ${pdfs.length} PDF(s)…`);
    for (const file of pdfs) {
      try {
        const text = await readPdfText(file, pdfjsLib);
        const parsed = dispatch(text);
        if (!parsed.length) {
          setStatus(`${file.name}: format not recognised.`, 'err');
          continue;
        }
        for (const order of parsed) {
          const product = detectProduct(order.productText) || detectProduct(text);
          orders.push({
            fileName: file.name,
            source: order.source,
            recipient: order.recipient,
            productText: order.productText,
            productLines: order.productLines || null,
            product: product || null,
            orderId: order.orderId || '',
          });
        }
        setStatus(`${file.name}: parsed (${parsed.length} order${parsed.length > 1 ? 's' : ''}).`, 'ok');
      } catch (err) {
        setStatus(`${file.name}: ${err.message}`, 'err');
      }
    }
    renderRows();
    buildTrackingFromOrders();
    renderTracking();
    // Autosave freshly ingested data if enabled.
    if (autosaveOn('fedex')) {
      orders.forEach((o, i) => {
        if (!o.fedexId && o.product && o.product.mid) saveFedexOrder(o, i, { silent: true });
      });
    }
    if (autosaveOn('rows')) {
      trackingRows.forEach((r) => { if (!r.id) saveRow(r, { silent: true }); });
    }
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
      if (!o.cells) o.cells = buildRow({ recipient: o.recipient, product: o.product }, idx);
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

      const sel = document.createElement('select');
      sel.className = 'card-product';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '— pick product —';
      sel.appendChild(empty);
      for (const p of PRODUCTS) {
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = `${p.label}${p.mid ? ` (${p.mid})` : ''}`;
        if (o.product && o.product.key === p.key) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        orders[idx].product = findProductByKey(sel.value) || null;
        orders[idx].cells = buildRow({ recipient: orders[idx].recipient, product: orders[idx].product }, idx);
        renderRows();
        if (autosaveOn('fedex') && orders[idx].product && orders[idx].product.mid) {
          scheduleAutosave(orders[idx], () => saveFedexOrder(orders[idx], idx, { silent: true }));
        }
      });
      head.appendChild(sel);

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
      saveBtn.textContent = o.fedexId ? 'Overwrite' : 'Save';
      saveBtn.disabled = !hasResolvedProduct;
      saveBtn.title = hasResolvedProduct ? '' : 'Pick a product first';
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
        val.addEventListener('input', () => {
          o.cells[colIdx] = val.textContent;
          if (autosaveOn('fedex') && o.product && o.product.mid) {
            scheduleAutosave(o, () => saveFedexOrder(o, idx, { silent: true }));
          }
        });
        field.appendChild(val);

        grid.appendChild(field);
      });
      card.appendChild(grid);

      cards.appendChild(card);
    });

    const unresolved = orders.filter((o) => !o.product || !o.product.mid).length;
    downloadBtn.disabled = !orders.length || unresolved > 0;
    summary.innerHTML = orders.length
      ? `<strong>${orders.length}</strong> shipment${orders.length > 1 ? 's' : ''} loaded${
          unresolved
            ? `, <span style="color:var(--err)"><strong>${unresolved}</strong> need a product assigned</span>`
            : ''
        }.`
      : 'Drop PDFs above to begin.';
  }

  // ---- FedEx D1 persistence ----

  function setFedexStatus(msg, level = '') {
    if (!fedexStatus) return;
    const line = document.createElement('div');
    line.className = `status-line ${level}`;
    line.textContent = msg;
    fedexStatus.appendChild(line);
    while (fedexStatus.children.length > 8) fedexStatus.removeChild(fedexStatus.firstChild);
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
    };
  }

  async function saveFedexOrder(o, idx, { silent = false } = {}) {
    if (!o.product || !o.product.mid) {
      if (!silent) setFedexStatus('Pick a product before saving this shipment.', 'warn');
      return;
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

  async function loadSavedFedex() {
    const store = makeStore('fedex');
    try {
      setFedexStatus(`Loading saved shipments from ${store.backend === 'd1' ? 'D1' : 'this browser'}…`);
      const saved = await store.list();
      const existing = new Set(orders.filter((o) => o.fedexId).map((o) => String(o.fedexId)));
      let added = 0;
      for (const s of saved) {
        if (existing.has(String(s.id))) continue;
        orders.push({
          fileName: s.fileName || '',
          source: s.source || '',
          recipient: { name: s.recipientName || '' },
          product: findProductByKey(s.productKey) || (s.productMid ? { key: s.productKey, mid: s.productMid } : null),
          cells: Array.isArray(s.cells) ? s.cells : null,
          fedexId: s.id,
          _loaded: true,
        });
        added += 1;
      }
      setFedexStatus(`Loaded ${saved.length} saved shipment(s); ${added} new added.`, 'ok');
      renderRows();
    } catch (err) {
      setFedexStatus(`Load failed: ${err.message}`, 'err');
    }
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
    if (fedexLoad) fedexLoad.addEventListener('click', loadSavedFedex);
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

  function autosaveOn(section) {
    try { return window.localStorage.getItem(AUTOSAVE_KEYS[section]) === '1'; } catch { return false; }
  }
  function setAutosave(section, on) {
    try { window.localStorage.setItem(AUTOSAVE_KEYS[section], on ? '1' : '0'); } catch {}
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
  }

  function resolveProducts(order) {
    const lines = order.productLines && order.productLines.length
      ? order.productLines
      : (order.productText ? [order.productText] : []);
    return parseProductLines(lines).map((p) => {
      const detected = detectProduct(p.text);
      return { qty: p.qty, label: detected ? detected.label : p.text, text: p.text };
    });
  }

  function buildTrackingFromOrders() {
    const dbRows = trackingRows.filter((r) => r._origin === 'db');
    const today = new Date();
    const orderRows = orders.map((o, idx) => {
      const row = buildTrackingRow(
        { recipient: o.recipient, products: resolveProducts(o) },
        idx,
        today
      );
      row._origin = 'order';
      return row;
    });
    trackingRows = orderRows.concat(dbRows);
  }

  function initTracking() {
    if (!trackingHead) return;
    renderTrackingHeader();
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
    if (trackLoadSaved) trackLoadSaved.addEventListener('click', loadSavedRows);
    if (trackAutosave) {
      trackAutosave.checked = autosaveOn('rows');
      trackAutosave.addEventListener('change', () => {
        setAutosave('rows', trackAutosave.checked);
        setTrackStatus(trackAutosave.checked ? 'Autosave on — rows save as you edit.' : 'Autosave off.', 'ok');
      });
    }
    renderTracking();
  }

  function renderTrackingHeader() {
    const table = trackingHead.parentElement;
    const oldCols = table.querySelector('colgroup');
    if (oldCols) oldCols.remove();
    const colgroup = document.createElement('colgroup');
    TRACKING_COL_WIDTHS.forEach((w) => {
      const col = document.createElement('col');
      col.style.width = `${w}%`;
      colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.firstChild);

    trackingHead.innerHTML = '';
    const tr = document.createElement('tr');
    for (const h of TRACKING_HEADERS.concat(['Actions'])) {
      const th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    }
    trackingHead.appendChild(tr);
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

  function renderTracking() {
    if (!trackingBody) return;
    trackingBody.innerHTML = '';
    trackingRows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.id) tr.classList.add('saved');

      const tdMap = {};
      const cell = (key, node) => {
        const td = document.createElement('td');
        td.appendChild(node);
        tr.appendChild(td);
        tdMap[key] = node;
      };

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
      cell('trackingNumber', input(row.trackingNumber, 'w-md', (v) => { row.trackingNumber = v; }));
      cell('product', input(row.product, 'w-xl', (v) => { row.product = v; }));
      cell('quantity', input(row.quantity, 'w-sm', (v) => { row.quantity = v; }));
      cell('productDescription', input(row.productDescription, 'w-xl', (v) => { row.productDescription = v; }));
      cell('destCity', input(row.destCity, 'w-md', (v) => { row.destCity = v; }));
      cell('destState', input(row.destState, 'w-md', (v) => { row.destState = v; }));

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

      cell('comments', input(row.comments, 'w-lg', (v) => { row.comments = v; }));
      cell('directionRemarks', input(row.directionRemarks, 'w-lg', (v) => { row.directionRemarks = v; }));

      // Actions
      const actTd = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'primary';
      saveBtn.textContent = row.id ? 'Overwrite' : 'Save';
      saveBtn.addEventListener('click', () => saveRow(row));
      actions.appendChild(saveBtn);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyRow(row));
      actions.appendChild(copyBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => removeRow(row));
      actions.appendChild(delBtn);

      actTd.appendChild(actions);
      tr.appendChild(actTd);

      // Autosave: any edit (typing or dropdown/date change) within the row.
      const queueAutosave = () => {
        if (autosaveOn('rows')) scheduleAutosave(row, () => saveRow(row, { silent: true }));
      };
      tr.addEventListener('input', queueAutosave);
      tr.addEventListener('change', queueAutosave);

      trackingBody.appendChild(tr);
    });
  }

  // Apply a new Date to a row, syncing day / date / order-number controls.
  function applyDate(row, date, tdMap, fromCalendar) {
    row.isoDate = toISODate(date);
    row.date = formatDateDDMMYY(date);
    row.day = weekdayName(date);
    // Re-derive the order number only if the user hasn't manually overridden it.
    const seqMatch = String(row.orderNumber).match(/-(\d+)\s*$/);
    const seq = seqMatch ? seqMatch[1] : '1';
    row.orderNumber = orderNumberFor(date, seq);
    if (tdMap.day) tdMap.day.value = row.day;
    if (tdMap.date && !fromCalendar) tdMap.date.value = row.isoDate;
    if (tdMap.orderNumber) tdMap.orderNumber.value = row.orderNumber;
  }

  async function saveRow(row, { silent = false } = {}) {
    const store = makeStore('rows');
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
      if (!silent) renderTracking();
    } catch (err) {
      setTrackStatus(`Save failed: ${err.message}`, 'err');
    }
  }

  async function copyRow(row) {
    const text = trackingRowToCells(row).join('\t');
    try {
      await window.navigator.clipboard.writeText(text);
      setTrackStatus(`Copied order ${row.orderNumber} to clipboard (tab-separated).`, 'ok');
    } catch {
      setTrackStatus(`Copy unavailable here. Row:\n${text}`, 'warn');
    }
  }

  async function removeRow(row) {
    if (row.id) {
      const store = makeStore();
      try {
        await store.remove(row.id);
      } catch (err) {
        setTrackStatus(`Delete failed: ${err.message}`, 'err');
        return;
      }
    }
    trackingRows = trackingRows.filter((r) => r !== row);
    setTrackStatus('Row removed.', 'ok');
    renderTracking();
  }

  async function loadSavedRows() {
    const store = makeStore();
    try {
      setTrackStatus(`Loading saved rows from ${store.backend === 'd1' ? 'D1' : 'this browser'}…`);
      const saved = await store.list();
      const existingIds = new Set(trackingRows.filter((r) => r.id).map((r) => String(r.id)));
      let added = 0;
      for (const s of saved) {
        if (existingIds.has(String(s.id))) continue;
        const d = fromISODate(s.isoDate);
        trackingRows.push({
          ...s,
          isoDate: s.isoDate || '',
          deliveredOnIso: s.deliveredOnIso || '',
          _origin: 'db',
        });
        added += 1;
      }
      setTrackStatus(`Loaded ${saved.length} saved row(s); ${added} new added to the table.`, 'ok');
      renderTracking();
    } catch (err) {
      setTrackStatus(`Load failed: ${err.message}`, 'err');
    }
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

  // Initialise the save/tracking sections last and defensively: a failure here
  // must never prevent the upload listeners above from being wired up.
  try {
    initFedex();
    initTracking();
  } catch (err) {
    setTrackStatus(`Save sections failed to initialise: ${err.message}`, 'err');
    if (window.console) window.console.error(err);
  }

  return {
    get orders() { return orders; },
    ingestFiles,
  };
}

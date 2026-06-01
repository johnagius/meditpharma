import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

// Minimal DOM/window stub — just enough to run createApp's init path and prove
// it wires up without throwing (guards against TDZ / ordering regressions that
// would silently break the upload listeners).
function makeElement() {
  const listeners = {};
  const el = {
    listeners,
    children: [],
    style: {},
    dataset: {},
    classList: { add() {}, remove() {} },
    _innerHTML: '',
    textContent: '',
    value: '',
    type: '',
    className: '',
    firstChild: null,
    disabled: false,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); return child; },
    insertBefore(child) { this.children.unshift(child); return child; },
    querySelector() { return null; },
    setAttribute() {},
    remove() {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = v; el.children = []; },
  });
  el.parentElement = { querySelector: () => null, insertBefore: () => {}, firstChild: null };
  return el;
}

function makeDocument() {
  const byId = {};
  return {
    _byId: byId,
    getElementById(id) { return (byId[id] ||= makeElement()); },
    createElement() { return makeElement(); },
    get body() { return (byId.__body__ ||= makeElement()); },
  };
}

function makeWindow() {
  const store = new Map();
  return {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    fetch: async () => ({ ok: true, json: async () => [] }),
    console: { error() {} },
    navigator: { clipboard: { writeText: async () => {} } },
  };
}

describe('createApp init (smoke)', () => {
  it('initialises without throwing and wires the upload + tracking UI', () => {
    const document = makeDocument();
    const window = makeWindow();

    expect(() => createApp({ document, window, pdfjsLib: {}, XLSX: {} })).not.toThrow();

    // Upload listeners must be attached (broken if init throws before them).
    const dropZone = document.getElementById('drop-zone');
    expect(dropZone.listeners.click).toBeTruthy();
    expect(dropZone.listeners.drop).toBeTruthy();
    expect(document.getElementById('file-picker').listeners.change).toBeTruthy();

    // Tracking init must have completed fully (sets the backend badge text).
    expect(document.getElementById('track-backend').textContent).toBeTruthy();
  });
});

export async function readPdfText(file, pdfjsLib, { onProgress } = {}) {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(renderPage(content));
  }
  const text = pages.join('\n');

  // If the PDF yielded no meaningful text it is image-only — try OCR.
  if (text.replace(/\s/g, '').length < 50) {
    return ocrPdf(buf, pdf, pdfjsLib, { onProgress });
  }
  return text;
}

async function ocrPdf(buf, pdf, pdfjsLib, { onProgress } = {}) {
  // Lazy-load Tesseract.js from CDN only when needed.
  if (onProgress) onProgress('OCR: loading engine…');
  const mod = await import(
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'
  );
  // v5 ESM build: named export or on the default object
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (typeof createWorker !== 'function') throw new Error('Tesseract.js failed to load');
  const worker = await createWorker('eng');
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(`OCR: page ${i}/${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const { data: { text } } = await worker.recognize(canvas);
    pageTexts.push(text);
  }
  await worker.terminate();
  return pageTexts.join('\n');
}

function renderPage(content) {
  const lines = new Map();
  for (const item of content.items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    const w = item.width || 0;
    const entry = lines.get(y) || [];
    entry.push({ x, w, str: item.str, hasEOL: item.hasEOL });
    lines.set(y, entry);
  }
  const keys = Array.from(lines.keys()).sort((a, b) => b - a);
  const rows = keys.map((y) => {
    const items = lines.get(y).sort((a, b) => a.x - b.x);
    let line = '';
    let prevEnd = null;
    let avgCharWidth = 5;
    for (const it of items) {
      if (it.w && it.str.length) {
        avgCharWidth = Math.max(2, it.w / it.str.length);
      }
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > avgCharWidth * 0.6) {
          const spaces = Math.max(1, Math.min(20, Math.round(gap / avgCharWidth)));
          line += ' '.repeat(spaces);
        }
      }
      line += it.str;
      prevEnd = it.x + (it.w || it.str.length * avgCharWidth);
    }
    return line.replace(/[ \t]+/g, ' ').trim();
  });
  return rows.filter((l) => l.length).join('\n');
}

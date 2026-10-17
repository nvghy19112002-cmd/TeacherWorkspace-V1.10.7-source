import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;
export interface FigureImage {
  url: string;
  width: number;
  height: number;
}
const cache = new Map<string, FigureImage>();
let bytes = 0;
let cacheGeneration = 0;
export function figureCacheStats() {
  return { entries: cache.size, bytes };
}
export function clearFigureCache() {
  cache.clear();
  bytes = 0;
  cacheGeneration++;
}

/** Draw only the cropped figure page, without a browser PDF frame or toolbar. */
export async function pdfFigure(
  pdf: number[],
  signal: AbortSignal,
  key = '',
): Promise<FigureImage> {
  signal.throwIfAborted();
  const generation = cacheGeneration;
  const data = new Uint8Array(pdf);
  // A reused caller label must never return an image of different PDF bytes.
  if (key && globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    key += ':' + [...digest].map((n) => n.toString(16).padStart(2, '0')).join('');
  } else key = '';
  signal.throwIfAborted();
  if (key && cache.has(key)) {
    const image = cache.get(key)!;
    cache.delete(key);
    cache.set(key, image);
    return image;
  }
  const loading = getDocument({
    data,
    useSystemFonts: true,
  });
  const cancel = () => {
    void loading.destroy().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const doc = await loading.promise;
    signal.throwIfAborted();
    const page = await doc.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    if (
      !Number.isFinite(natural.width) ||
      !Number.isFinite(natural.height) ||
      natural.width <= 0 ||
      natural.height <= 0
    )
      throw new Error('Trang PDF không có kích thước hợp lệ.');
    const width = Math.min(680, Math.max(140, natural.width * 1.6));
    const height = (width * natural.height) / natural.width;
    const quality = Math.min(2, Math.sqrt(4_000_000 / (width * height)));
    const viewport = page.getViewport({ scale: (width / natural.width) * quality });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không tạo được vùng vẽ hình.');
    const task = page.render({
      canvas,
      canvasContext: context,
      viewport,
      background: 'rgb(255,255,255)',
    });
    await task.promise;
    signal.throwIfAborted();
    const image = { url: canvas.toDataURL('image/png'), width, height };
    canvas.width = 0;
    canvas.height = 0;
    if (key && generation === cacheGeneration && image.url.length < 2_000_000) {
      bytes -= cache.get(key)?.url.length ?? 0;
      cache.set(key, image);
      bytes += image.url.length;
      while (cache.size > 24 || bytes > 12_000_000) {
        const first = cache.keys().next().value!;
        bytes -= cache.get(first)!.url.length;
        cache.delete(first);
      }
    }
    return image;
  } finally {
    signal.removeEventListener('abort', cancel);
    await loading.destroy().catch(() => undefined);
  }
}

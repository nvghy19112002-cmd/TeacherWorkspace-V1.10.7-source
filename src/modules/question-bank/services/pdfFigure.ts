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

/** Draw only the cropped figure page, without a browser PDF frame or toolbar. */
export async function pdfFigure(
  pdf: number[],
  signal: AbortSignal,
  key = '',
): Promise<FigureImage> {
  signal.throwIfAborted();
  if (key && cache.has(key)) {
    const image = cache.get(key)!;
    cache.delete(key);
    cache.set(key, image);
    return image;
  }
  const loading = getDocument({
    data: new Uint8Array(pdf),
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
    if (key && image.url.length < 2_000_000) {
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
    await loading.destroy();
  }
}

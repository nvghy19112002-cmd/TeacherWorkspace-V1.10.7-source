import { invoke } from '@tauri-apps/api/core';
import type { TexPreviewSettings } from '../domain/texPreview';
export interface TexCompileResult {
  success: boolean;
  pdf: number[];
  log: string;
}
interface Args {
  settings: TexPreviewSettings;
  document: string;
  question: string;
}
let tail: Promise<unknown> = Promise.resolve();
const cache = new Map<string, TexCompileResult>();
let cacheBytes = 0;

/** Shared by inline figures and the PDF dialog: never cancel another caller's job. */
export function queuedTexCompile(
  args: Args,
  signal: AbortSignal,
  cacheKey = '',
): Promise<TexCompileResult> {
  const task = tail
    .catch(() => undefined)
    .then(async () => {
      signal.throwIfAborted();
      if (cacheKey && cache.has(cacheKey)) {
        const value = cache.get(cacheKey)!;
        cache.delete(cacheKey);
        cache.set(cacheKey, value);
        return value;
      }
      let cancelling: Promise<unknown> | undefined;
      const cancel = () => {
        cancelling = invoke('tex_preview_cancel').catch(() => undefined);
      };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const result = await invoke<TexCompileResult>(
          'tex_preview_compile',
          args as unknown as Record<string, unknown>,
        );
        signal.throwIfAborted();
        if (result.success && cacheKey && result.pdf.length <= 4 * 1024 * 1024) {
          cache.set(cacheKey, result);
          cacheBytes += result.pdf.length;
          while (cache.size > 40 || cacheBytes > 4 * 1024 * 1024) {
            const first = cache.keys().next().value!;
            cacheBytes -= cache.get(first)!.pdf.length;
            cache.delete(first);
          }
        }
        return result;
      } finally {
        signal.removeEventListener('abort', cancel);
        if (cancelling) await cancelling;
      }
    });
  tail = task.catch(() => undefined);
  return task;
}

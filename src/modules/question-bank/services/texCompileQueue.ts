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
let cacheGeneration = 0;
export function texCacheStats() {
  return { entries: cache.size, bytes: cacheBytes };
}
export function clearTexCompileCache() {
  cache.clear();
  cacheBytes = 0;
  cacheGeneration++;
}
const entryBytes = (key: string, value: TexCompileResult) =>
  key.length * 2 + value.pdf.length * 8 + value.log.length * 2;

/** Shared by inline figures and the PDF dialog: never cancel another caller's job. */
export function queuedTexCompile(
  args: Args,
  signal: AbortSignal,
  cacheKey = '',
): Promise<TexCompileResult> {
  const generation = cacheGeneration;
  const dependencies = args.document.replace(/\\input\s*\{question\.tex\}/g, '') + args.question;
  const external =
    args.settings.mode === 'project' ||
    /\\(?:input|include|includegraphics)\b|\\addplot(?:\+)?\s+graphics\b/.test(dependencies);
  // Caller labels are never enough: bind cached output to the exact source and settings.
  const key = cacheKey && !external ? JSON.stringify([cacheKey, args]) : '';
  const task = tail
    .catch(() => undefined)
    .then(async () => {
      signal.throwIfAborted();
      if (key && cache.has(key)) {
        const value = cache.get(key)!;
        cache.delete(key);
        cache.set(key, value);
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
        if (
          result.success &&
          key &&
          generation === cacheGeneration &&
          result.pdf.length <= 4 * 1024 * 1024
        ) {
          cache.set(key, result);
          cacheBytes += entryBytes(key, result);
          while (cache.size > 40 || cacheBytes > 4 * 1024 * 1024) {
            const first = cache.keys().next().value!;
            cacheBytes -= entryBytes(first, cache.get(first)!);
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

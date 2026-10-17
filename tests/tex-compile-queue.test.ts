import { expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
import { queuedTexCompile } from '../src/modules/question-bank/services/texCompileQueue';
import { DEFAULT_TEX_PREVIEW_SETTINGS } from '../src/modules/question-bank/domain/texPreview';
const args = { settings: DEFAULT_TEX_PREVIEW_SETTINGS, document: 'doc', question: 'q' };
it('serializes requests and reuses figures with the same exact configuration key', async () => {
  let active = 0,
    max = 0;
  invoke.mockImplementation(async (command: string) => {
    if (command !== 'tex_preview_compile') return;
    active++;
    max = Math.max(max, active);
    await Promise.resolve();
    active--;
    return { success: true, pdf: [37, 80, 68, 70], log: '' };
  });
  await Promise.all([
    queuedTexCompile(args, new AbortController().signal, 'figure-one'),
    queuedTexCompile(args, new AbortController().signal, 'figure-one'),
  ]);
  expect(max).toBe(1);
  expect(invoke).toHaveBeenCalledTimes(1);
  await queuedTexCompile(args, new AbortController().signal, 'figure-settings-changed');
  expect(invoke).toHaveBeenCalledTimes(2);
});
it('does not compile or cancel another request when a queued request is aborted', async () => {
  invoke.mockClear();
  let release!: () => void;
  invoke.mockImplementation(async () => {
    await new Promise<void>((r) => {
      release = r;
    });
    return { success: true, pdf: [], log: '' };
  });
  const active = queuedTexCompile(args, new AbortController().signal);
  await Promise.resolve();
  await Promise.resolve();
  const controller = new AbortController();
  const cancelled = queuedTexCompile(args, controller.signal);
  const check = expect(cancelled).rejects.toThrow();
  controller.abort();
  release();
  await active;
  await check;
  expect(invoke).toHaveBeenCalledTimes(1);
});
it('binds caller cache labels to the actual source and does not cache external dependencies', async () => {
  const { clearTexCompileCache } =
    await import('../src/modules/question-bank/services/texCompileQueue');
  clearTexCompileCache();
  invoke.mockClear();
  invoke.mockResolvedValue({ success: true, pdf: [37, 80, 68, 70], log: '' });
  await queuedTexCompile(args, new AbortController().signal, 'same-label');
  await queuedTexCompile(
    { ...args, question: 'changed source' },
    new AbortController().signal,
    'same-label',
  );
  expect(invoke).toHaveBeenCalledTimes(2);
  const external = { ...args, question: String.raw`\includegraphics{figure.png}` };
  await queuedTexCompile(external, new AbortController().signal, 'external');
  await queuedTexCompile(external, new AbortController().signal, 'external');
  expect(invoke).toHaveBeenCalledTimes(4);
});
it('clearing during an in-flight request does not repopulate the old cache', async () => {
  const { clearTexCompileCache, texCacheStats } =
    await import('../src/modules/question-bank/services/texCompileQueue');
  clearTexCompileCache();
  invoke.mockClear();
  let release!: () => void;
  invoke.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return { success: true, pdf: [1, 2, 3], log: '' };
  });
  const pending = queuedTexCompile(args, new AbortController().signal, 'in-flight');
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  clearTexCompileCache();
  release();
  await pending;
  expect(texCacheStats()).toEqual({ entries: 0, bytes: 0 });
});

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

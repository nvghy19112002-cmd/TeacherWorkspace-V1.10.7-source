import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ raw: '' }));
vi.mock('../src/app/store', () => ({
  useWorkspace: {
    getState: () => ({ data: { settings: { moduleState: { aiKeyPool: state.raw } } } }),
  },
}));
vi.mock('../src/database/driver', () => ({ isDesktop: false }));
import { storeKey, withPreferredKeys } from '../src/modules/ai-tools/services/credentials';
import { GeminiHttpError } from '../src/modules/ai-tools/services/geminiDiagnostics';
function pool(ids: string[], rotation = 'priority', enabled = true) {
  state.raw = JSON.stringify({
    version: 1,
    automatic: true,
    activeId: ids[0],
    rotation,
    keys: ids.map((id, priority) => ({
      id,
      label: id,
      masked: '••••test',
      priority,
      enabled,
      status: 'unchecked',
      lastCheckedAt: null,
    })),
  });
}
it('uses round robin for real AI Tools requests', async () => {
  pool(['rotate-one', 'rotate-two'], 'round_robin');
  await storeKey('fake-rotate-key-one', 'rotate-one');
  await storeKey('fake-rotate-key-two', 'rotate-two');
  const run = vi.fn(async (key: string) => key);
  await withPreferredKeys(run, new AbortController().signal);
  await withPreferredKeys(run, new AbortController().signal);
  expect(run.mock.calls.map((c) => c[0])).toEqual(['fake-rotate-key-one', 'fake-rotate-key-two']);
});
it('stops on quota errors without switching credentials, and stops on invalid models', async () => {
  pool(['quota-one', 'quota-two']);
  await storeKey('fake-quota-key-one', 'quota-one');
  await storeKey('fake-quota-key-two', 'quota-two');
  const run = vi
    .fn()
    .mockRejectedValueOnce(new GeminiHttpError('quota', 429))
    .mockResolvedValueOnce('ok');
  await expect(withPreferredKeys(run, new AbortController().signal)).rejects.toThrow('quota');
  expect(run).toHaveBeenCalledTimes(1);
  const invalid = vi.fn().mockRejectedValue(new GeminiHttpError('bad model', 404));
  await expect(withPreferredKeys(invalid, new AbortController().signal)).rejects.toThrow(
    'bad model',
  );
  expect(invalid).toHaveBeenCalledTimes(1);
});
it('never falls back to a disabled legacy default key', async () => {
  pool(['default'], 'priority', false);
  await storeKey('fake-disabled-default', 'default');
  const run = vi.fn();
  await expect(withPreferredKeys(run, new AbortController().signal)).rejects.toThrow('đang bật');
  expect(run).not.toHaveBeenCalled();
});

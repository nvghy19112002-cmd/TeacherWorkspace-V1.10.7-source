import { it, expect } from 'vitest';
import { runScanQueue } from '../src/modules/question-bank/domain/scanQueue';
it('continues past a question failure, skips duplicates and reports every result', async () => {
  const seen: string[] = [];
  const rows = await runScanQueue(
    ['a', 'b', 'a', 'c'],
    new AbortController().signal,
    async (id) => {
      seen.push(id);
      if (id === 'b') throw new Error('bad question');
      if (id === 'c') return 'locked';
    },
    () => {},
  );
  expect(seen).toEqual(['a', 'b', 'c']);
  expect(rows.map((r) => r.status)).toEqual(['completed', 'failed', 'needs_review']);
});
it('leaves pending questions after a fatal configuration failure', async () => {
  const rows = await runScanQueue(
    ['a', 'b'],
    new AbortController().signal,
    async () => {
      throw new Error('bad model');
    },
    () => {},
    () => true,
  );
  expect(rows.map((r) => r.status)).toEqual(['failed', 'paused']);
});
it('does not process more questions after cancellation', async () => {
  const abort = new AbortController();
  const seen: string[] = [];
  const rows = await runScanQueue(
    ['a', 'b'],
    abort.signal,
    async (id) => {
      seen.push(id);
      abort.abort();
    },
    () => {},
  );
  expect(seen).toEqual(['a']);
  expect(rows.map((r) => r.status)).toEqual(['completed', 'paused']);
});
it('checkpoints a 200-question job and resumes without reprocessing 36 saved results', async () => {
  const { restoreScanJob, resumableRow } =
    await import('../src/modules/question-bank/domain/scanQueue');
  const abort = new AbortController();
  let checkpoint = '';
  const seen: string[] = [];
  await runScanQueue(
    Array.from({ length: 200 }, (_, i) => String(i + 1)),
    abort.signal,
    async (id) => {
      seen.push(id);
      if (id === '37') {
        abort.abort();
        abort.signal.throwIfAborted();
      }
    },
    async (rows) => {
      checkpoint = JSON.stringify({
        version: 1,
        id: 'job',
        model: 'test',
        scopeId: '',
        promptFingerprint: 'v2',
        updatedAt: new Date().toISOString(),
        rows,
      });
    },
  );
  const restored = restoreScanJob(checkpoint)!;
  expect(restored.rows.filter((r) => r.status === 'completed')).toHaveLength(36);
  expect(restored.rows[36].status).toBe('cancelled');
  const remaining = restored.rows.filter(resumableRow).map((r) => r.id);
  expect(remaining).toHaveLength(164);
  const after: string[] = [];
  await runScanQueue(
    remaining,
    new AbortController().signal,
    async (id) => {
      after.push(id);
    },
    () => {},
  );
  expect(after[0]).toBe('37');
  expect(after).not.toContain('36');
  expect(after).toHaveLength(164);
});
it('restores interrupted running and retrying rows as paused, not fictitious active work', async () => {
  const { restoreScanJob } = await import('../src/modules/question-bank/domain/scanQueue');
  const job = restoreScanJob(
    JSON.stringify({
      version: 1,
      id: 'job',
      model: 'test',
      scopeId: '',
      promptFingerprint: 'v2',
      updatedAt: new Date().toISOString(),
      rows: [
        { id: 'a', status: 'running', message: '' },
        { id: 'b', status: 'retrying', message: '' },
        { id: 'c', status: 'completed', message: '' },
      ],
    }),
  )!;
  expect(job.rows.map((r) => r.status)).toEqual(['paused', 'paused', 'completed']);
});
it('does not start a network request if the durable checkpoint fails', async () => {
  let called = false;
  await expect(
    runScanQueue(
      ['a'],
      new AbortController().signal,
      async () => {
        called = true;
      },
      async () => {
        throw new Error('disk full');
      },
    ),
  ).rejects.toThrow('disk full');
  expect(called).toBe(false);
});
it('retains a provider cooldown after restoring and does not send a resumed request early', async () => {
  const { vi } = await import('vitest');
  vi.useFakeTimers();
  try {
    const seen: string[] = [];
    const pending = runScanQueue(
      ['a'],
      new AbortController().signal,
      async (id) => {
        seen.push(id);
      },
      () => {},
      () => false,
      [
        {
          id: 'a',
          status: 'paused',
          message: '',
          retryAt: new Date(Date.now() + 20000).toISOString(),
        },
      ],
    );
    await vi.advanceTimersByTimeAsync(19000);
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(seen).toEqual(['a']);
  } finally {
    vi.useRealTimers();
  }
});

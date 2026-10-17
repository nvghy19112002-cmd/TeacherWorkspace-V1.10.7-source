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
  expect(rows.map((r) => r.status)).toEqual(['done', 'failed', 'skipped']);
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
  expect(rows.map((r) => r.status)).toEqual(['failed', 'pending']);
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
  expect(rows.map((r) => r.status)).toEqual(['pending', 'pending']);
});

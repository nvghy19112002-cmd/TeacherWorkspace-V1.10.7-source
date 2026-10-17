import { afterEach, expect, it, vi } from 'vitest';
import {
  AiRequestError,
  managedRequest,
  retryAfterMs,
} from '../src/modules/ai-tools/services/requestManager';
import { geminiHttpError } from '../src/modules/ai-tools/services/geminiDiagnostics';
afterEach(() => vi.useRealTimers());
it('503 three times then success uses bounded exponential jitter and emits cooldown states', async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new AiRequestError('busy', 'service', 503))
    .mockRejectedValueOnce(new AiRequestError('busy', 'service', 503))
    .mockRejectedValueOnce(new AiRequestError('busy', 'service', 503))
    .mockResolvedValue('ok');
  const sleep = vi.fn(async (ms: number) => {
      void ms;
    }),
    onRetry = vi.fn();
  expect(
    await managedRequest(request, {
      signal: new AbortController().signal,
      random: () => 0.5,
      sleep,
      onRetry,
    }),
  ).toBe('ok');
  expect(sleep.mock.calls.map((args) => args[0])).toEqual([1000, 2000, 4000]);
  expect(onRetry.mock.calls.map((args) => args[0].attempt)).toEqual([1, 2, 3]);
  expect(onRetry.mock.calls[0][0].message).toContain('quá tải');
});
it('Retry-After supports seconds and HTTP dates without truncating to five seconds', async () => {
  const now = Date.parse('2026-10-17T00:00:00Z');
  expect(retryAfterMs('20', now)).toBe(20000);
  expect(retryAfterMs('Sat, 17 Oct 2026 00:00:30 GMT', now)).toBe(30000);
  expect(retryAfterMs('not a date', now)).toBe(0);
  const error = new AiRequestError('rate', 'rate_limit', 429, 20000);
  const request = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  await managedRequest(request, { signal: new AbortController().signal, sleep });
  expect(sleep.mock.calls[0][0]).toBe(20000);
});
it('long cooldowns pause immediately instead of retrying before the provider permits', async () => {
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  const request = vi.fn().mockRejectedValue(new AiRequestError('later', 'rate_limit', 429, 180000));
  await expect(
    managedRequest(request, { signal: new AbortController().signal, sleep }),
  ).rejects.toThrow('later');
  expect(request).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
});
it.each([400, 401, 403, 404, 429])('permanent HTTP %s does not retry', async (status) => {
  const error = await geminiHttpError(
    new Response(JSON.stringify({ error: { message: 'quota exceeded for daily usage' } }), {
      status,
    }),
    'test-key',
  );
  const request = vi.fn().mockRejectedValue(error);
  await expect(managedRequest(request, { signal: new AbortController().signal })).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
it('distinguishes rate limits with Retry-After from daily quota exhaustion', async () => {
  const rate = await geminiHttpError(
    new Response('{}', { status: 429, headers: { 'Retry-After': '8' } }),
    'secret',
  );
  expect(rate.kind).toBe('rate_limit');
  expect(rate.retryable).toBe(true);
  const quota = await geminiHttpError(
    new Response(JSON.stringify({ error: { message: 'daily quota exceeded; secret' } }), {
      status: 429,
      headers: { 'Retry-After': '8' },
    }),
    'secret',
  );
  expect(quota.kind).toBe('quota');
  expect(quota.retryable).toBe(false);
  expect(quota.diagnostic).not.toContain('secret');
});
it.each([408, 500, 502, 503, 504])(
  'temporary HTTP %s retries and has a friendly message',
  async (status) => {
    const error = await geminiHttpError(new Response('{}', { status }), 'test-key', 'model-a');
    const request = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');
    expect(
      await managedRequest(request, {
        signal: new AbortController().signal,
        sleep: async () => {},
      }),
    ).toBe('ok');
    expect(error.message).not.toContain('HTTP');
    expect(error.diagnostic).toContain(String(status));
  },
);
it('network failure retries only a bounded number of times', async () => {
  const request = vi.fn().mockRejectedValue(new TypeError('offline'));
  await expect(
    managedRequest(request, { signal: new AbortController().signal, sleep: async () => {} }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(request).toHaveBeenCalledTimes(4);
});
it('cancels during cooldown without an extra network request', async () => {
  vi.useFakeTimers();
  const abort = new AbortController(),
    request = vi.fn().mockRejectedValue(new AiRequestError('busy', 'service', 503));
  const pending = managedRequest(request, { signal: abort.signal });
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(1);
  abort.abort();
  await assertion;
  expect(request).toHaveBeenCalledTimes(1);
});
it('schema and invalid JSON errors remain per-question failures and are not blindly retried', async () => {
  for (const kind of ['schema', 'invalid_json'] as const) {
    const request = vi.fn().mockRejectedValue(new AiRequestError('invalid', kind));
    await expect(managedRequest(request, { signal: new AbortController().signal })).rejects.toThrow(
      'invalid',
    );
    expect(request).toHaveBeenCalledTimes(1);
  }
});
it('uses RetryInfo when a browser cannot read Retry-After, while keeping minute quotas distinct', async () => {
  const error = await geminiHttpError(
    new Response(
      JSON.stringify({
        error: {
          message: 'Quota exceeded for RequestsPerMinute',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12.5s' }],
        },
      }),
      { status: 429 },
    ),
    'test-key',
  );
  expect(error.kind).toBe('rate_limit');
  expect(error.retryAfterMs).toBe(12500);
});

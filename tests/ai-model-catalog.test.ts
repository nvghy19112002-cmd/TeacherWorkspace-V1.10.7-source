import { afterEach, expect, it, vi } from 'vitest';
import { geminiProvider, testGeminiModel } from '../src/modules/ai-tools/services/aiProvider';
import { geminiHttpError } from '../src/modules/ai-tools/services/geminiDiagnostics';
import { readKeyPool, requestKeys } from '../src/modules/ai-tools/domain/keyPool';
import { recommendedStructuredTextModels } from '../src/modules/ai-tools/domain/modelCapabilities';
afterEach(() => vi.unstubAllGlobals());
it('loads all model pages and excludes models without generateContent', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-test-a', supportedGenerationMethods: ['generateContent'] },
            {
              name: 'models/gemini-3.8-flash-tts',
              supportedGenerationMethods: ['generateContent'],
            },
            { name: 'models/gemini-live-test', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/embed', supportedGenerationMethods: ['embedContent'] },
          ],
          nextPageToken: 'next/a',
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-test-b', supportedGenerationMethods: ['generateContent'] },
          ],
        }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  expect(
    await geminiProvider.testConnection('fake-key-catalog', new AbortController().signal),
  ).toEqual(['gemini-test-a', 'gemini-test-b']);
  expect(fetcher.mock.calls[1][0]).toContain('pageToken=next%2Fa');
});
it('preserves useful provider details and redacts credentials', async () => {
  const error = await geminiHttpError(
    new Response(
      JSON.stringify({ error: { message: 'unsupported temperature; secret-key-catalog' } }),
      { status: 400 },
    ),
    'secret-key-catalog',
    'gemini-test',
  );
  expect(error.diagnostic).toContain('HTTP 400');
  expect(error.diagnostic).toContain('unsupported temperature');
  expect(error.message).not.toContain('secret-key-catalog');
});
it('probes JSON generation without forcing unsupported sampling parameters', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }],
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  await testGeminiModel('gemini-test', 'fake-key-model', new AbortController().signal);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.generationConfig.temperature).toBeUndefined();
  expect(body.generationConfig.responseMimeType).toBe('application/json');
});
it('rejects non-text Gemini models before sending a structured-output request', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    testGeminiModel('gemini-3.8-flash-tts', 'fake-key-model', new AbortController().signal),
  ).rejects.toThrow(/TTS/);
  expect(fetcher).not.toHaveBeenCalled();
});
it('shows at most five recommended text models with newer Pro and Flash models first', () => {
  expect(
    recommendedStructuredTextModels([
      'gemini-1.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-3-flash-preview',
      'gemini-3-pro-preview',
      'gemini-2.5-flash',
      'gemini-3-live-preview',
      'gemini-2.0-flash',
    ]),
  ).toEqual([
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ]);
});
it('rotates enabled keys and keeps legacy priority settings compatible', () => {
  const pool = readKeyPool(
    JSON.stringify({
      version: 1,
      automatic: true,
      activeId: 'b',
      rotation: 'round_robin',
      keys: ['a', 'b', 'c'].map((id, priority) => ({
        id,
        label: id,
        masked: '••••test',
        priority,
        enabled: id !== 'c',
        status: 'unchecked',
        lastCheckedAt: null,
      })),
    }),
  );
  expect(requestKeys(pool).map((k) => k.id)).toEqual(['b', 'a']);
  expect(requestKeys(pool).map((k) => k.id)).toEqual(['a', 'b']);
  expect(requestKeys(pool).map((k) => k.id)).toEqual(['b', 'a']);
  expect(requestKeys({ ...pool, rotation: 'priority' }).map((k) => k.id)).toEqual(['b', 'a']);
});

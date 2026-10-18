import { afterEach, expect, it, vi } from 'vitest';
import { mergeKntt } from '../src/modules/question-bank/domain/kntt';
import {
  scanPreflight,
  classificationContext,
} from '../src/modules/question-bank/domain/classificationContext';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';

const configured = vi.hoisted(() => ({
  moduleState: {} as Record<string, string>,
  model: 'test-model',
}));
vi.mock('../src/app/store', () => ({
  errorText: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  useWorkspace: {
    getState: () => ({ data: { settings: { moduleState: configured.moduleState } } }),
  },
}));
vi.mock('../src/modules/ai-tools/services/state', () => ({
  readAiState: () => ({ model: configured.model }),
}));
vi.mock('../src/modules/ai-tools/domain/keyPool', () => ({
  readKeyPool: () => ({ activeId: 'chosen', automatic: false }),
  requestKeys: () => [
    { id: 'chosen', label: 'Chosen' },
    { id: 'first', label: 'First' },
  ],
  saveKeyPool: vi.fn(),
}));
vi.mock('../src/modules/ai-tools/services/credentials', () => ({
  readKey: async (id: string) => `test-key-${id}`,
  redact: (text: string, key: string) => text.replaceAll(key, '[REDACTED]'),
}));
import {
  classifyQuestionOnline,
  supportedJsonSchema,
} from '../src/modules/question-bank/services/classificationProvider';
afterEach(() => {
  configured.moduleState = {};
  configured.model = 'test-model';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('blocks a TTS model before sending a classification request', async () => {
  configured.model = 'gemini-3.8-flash-tts';
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(
    classifyQuestionOnline(
      snapshot(),
      parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ fatalBatch: true });
  await expect(
    classifyQuestionOnline(
      snapshot(),
      parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/TTS/);
  expect(fetch).not.toHaveBeenCalled();
});
function snapshot() {
  const s = emptyBankSnapshot();
  s.curriculumNodes = mergeKntt([]);
  const lesson = s.curriculumNodes.find((n) => n.kind === 'lesson' && n.code === '20')!;
  s.curriculumNodes.push({
    ...lesson,
    id: lesson.id + '-f1',
    parentId: lesson.id,
    kind: 'form',
    code: '1',
    name: 'Dạng đã duyệt',
  });
  return s;
}

it('uses the selected API key and leaves the question ID unchanged when AI fails', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
  vi.stubGlobal('fetch', fetch);
  const question = parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]);
  const before = JSON.stringify(question);
  await expect(
    classifyQuestionOnline(snapshot(), question, new AbortController().signal),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-key-chosen');
  expect(JSON.stringify(question)).toBe(before);
});

it('returns a suggestion without assigning its proposed code to the source question', async () => {
  const suggestion = {
    proposedClassificationCode: '',
    grade: '10',
    domain: 'D',
    chapterId: null,
    lessonId: null,
    formId: null,
    level: 'N',
    primaryLearningOutcomeId: null,
    secondaryLearningOutcomeIds: [],
    alignment: 'insufficient_data',
    confidence: 0.2,
    reasoningSummary: 'Cây chưa đầy đủ',
    evidence: [],
    independentAnswer: '',
    answerCheck: 'missing',
    dataCheck: 'insufficient',
    warnings: ['Thiếu dạng'],
    alternativeClassifications: [],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [
            { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(suggestion) }] } },
          ],
        }),
    }),
  );
  const question = parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]);
  const result = await classifyQuestionOnline(snapshot(), question, new AbortController().signal);
  expect(result.result).toEqual(suggestion);
  expect(result.keyId).toBe('chosen');
  expect(question.displayId).toBe('');
  expect(question.gradeNodeId).toBeNull();
});

it('does not call Gemini when the form catalogue or external images are missing', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const q = parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]);
  await expect(
    classifyQuestionOnline(emptyBankSnapshot(), q, new AbortController().signal),
  ).rejects.toThrow(/dạng/);
  q.rawSource += '\\includegraphics{a.pdf}';
  await expect(classifyQuestionOnline(snapshot(), q, new AbortController().signal)).rejects.toThrow(
    /hình/,
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('ignores commented external references and drops unsupported schema keywords', () => {
  const q = parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]);
  q.rawSource += '\n% \\includegraphics{old.pdf}';
  expect(scanPreflight(snapshot(), q)).toBe('');
  expect(
    supportedJsonSchema({
      $schema: 'x',
      type: 'object',
      properties: { a: { type: 'string', maxLength: 5, minLength: 1 } },
    }),
  ).toEqual({ type: 'object', properties: { a: { type: 'string' } } });
});
it('limits the prompt tree to the selected lesson and its ancestors', () => {
  const s = snapshot(),
    lesson = s.curriculumNodes.find((n) => n.kind === 'lesson' && n.code === '20')!;
  const c = classificationContext(s, lesson.id);
  expect(c.forms).toHaveLength(1);
  expect(c.nodes.filter((n) => n.kind === 'lesson')).toHaveLength(1);
  expect(c.nodes.some((n) => n.kind === 'grade')).toBe(true);
});
it('retries transient server errors with bounded backoff and respects cancellation during backoff', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  vi.stubGlobal('fetch', fetch);
  const q = parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]);
  const abort = new AbortController();
  const pending = classifyQuestionOnline(snapshot(), q, abort.signal);
  const check = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetch).toHaveBeenCalledTimes(4);
  await check;
  fetch.mockClear();
  const again = new AbortController();
  const request = classifyQuestionOnline(snapshot(), q, again.signal);
  const cancelled = expect(request).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10);
  again.abort();
  await cancelled;
  expect(fetch).toHaveBeenCalledTimes(1);
});
function uncertainProposal() {
  return {
    proposedClassificationCode: '',
    grade: '10',
    domain: 'D',
    chapterId: null,
    lessonId: null,
    formId: null,
    level: 'N',
    primaryLearningOutcomeId: null,
    secondaryLearningOutcomeIds: [],
    alignment: 'insufficient_data',
    confidence: 0.2,
    reasoningSummary: 'Cần giáo viên kiểm tra',
    evidence: [],
    independentAnswer: '',
    answerCheck: 'missing',
    dataCheck: 'insufficient',
    warnings: ['Thiếu dữ kiện'],
    alternativeClassifications: [],
  };
}
const proposalResponse = (result: unknown) => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      candidates: [
        { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } },
      ],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
    }),
});
it.each([400, 401, 403, 404, 429])(
  'HTTP %s neither rotates credentials nor repeats a permanent failure',
  async (status) => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status });
    vi.stubGlobal('fetch', fetch);
    await expect(
      classifyQuestionOnline(
        snapshot(),
        parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status, fatalBatch: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
it('rejects unknown database IDs and invalid structured output without saving a guessed result', async () => {
  const q = parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]);
  const original = JSON.stringify(q);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(proposalResponse({ ...uncertainProposal(), formId: 'invented-form' }))
    .mockResolvedValueOnce(proposalResponse({ arbitrary: true }));
  vi.stubGlobal('fetch', fetch);
  await expect(classifyQuestionOnline(snapshot(), q, new AbortController().signal)).rejects.toThrow(
    'ngoài danh mục',
  );
  await expect(classifyQuestionOnline(snapshot(), q, new AbortController().signal)).rejects.toThrow(
    'schema',
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(q)).toBe(original);
});
it('uses only an explicitly configured and key-verified fallback after bounded service retries', async () => {
  vi.useFakeTimers();
  configured.moduleState = {
    classificationFallbacks: JSON.stringify(['fallback-model']),
    aiModelChecks: JSON.stringify([
      {
        model: 'fallback-model',
        keyId: 'chosen',
        checkedAt: new Date().toISOString(),
        structuredOutput: true,
      },
    ]),
  };
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  fetch
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce(proposalResponse(uncertainProposal()));
  vi.stubGlobal('fetch', fetch);
  const pending = classifyQuestionOnline(
    snapshot(),
    parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]),
    new AbortController().signal,
  );
  await vi.advanceTimersByTimeAsync(15000);
  expect((await pending).model).toBe('fallback-model');
  expect(fetch).toHaveBeenCalledTimes(5);
  expect(fetch.mock.calls[4][0]).toContain('fallback-model');
  expect(new Set(fetch.mock.calls.map((call) => call[1].headers['x-goog-api-key'])).size).toBe(1);
});
it('does not use a fallback whose structured output was checked with another key', async () => {
  vi.useFakeTimers();
  configured.moduleState = {
    classificationFallbacks: JSON.stringify(['fallback-model']),
    aiModelChecks: JSON.stringify([
      {
        model: 'fallback-model',
        keyId: 'other',
        checkedAt: new Date().toISOString(),
        structuredOutput: true,
      },
    ]),
  };
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  vi.stubGlobal('fetch', fetch);
  const pending = classifyQuestionOnline(
    snapshot(),
    parsedToQuestion(parseExTest('\\begin{ex}Q\\end{ex}')[0]),
    new AbortController().signal,
  );
  const rejected = expect(pending).rejects.toMatchObject({ status: 503 });
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(4);
});

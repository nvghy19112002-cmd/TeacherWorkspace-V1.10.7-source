import { afterEach, expect, it, vi } from 'vitest';
import { mergeKntt } from '../src/modules/question-bank/domain/kntt';
import {
  scanPreflight,
  classificationContext,
} from '../src/modules/question-bank/domain/classificationContext';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';

vi.mock('../src/app/store', () => ({
  errorText: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  useWorkspace: { getState: () => ({ data: { settings: { moduleState: {} } } }) },
}));
vi.mock('../src/modules/ai-tools/services/state', () => ({
  readAiState: () => ({ model: 'test-model' }),
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
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
  await vi.advanceTimersByTimeAsync(2500);
  expect(fetch).toHaveBeenCalledTimes(3);
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

import { expect, it } from 'vitest';
import {
  addPromptVersion,
  activeClassificationPrompt,
  defaultClassificationPrompt,
  promptFingerprint,
  readPromptLibrary,
} from '../src/modules/question-bank/domain/classificationPrompts';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_PROMPT_VERSION,
} from '../src/modules/question-bank/domain/classification';
import { retrieveCurriculum } from '../src/modules/question-bank/domain/curriculumRetrieval';
import { mergeKntt } from '../src/modules/question-bank/domain/kntt';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parsedToQuestion, parseExTest } from '../src/modules/question-bank/domain/parser';
import { verifiedModel } from '../src/modules/ai-tools/domain/modelCapabilities';
it('adds immutable prompt versions, restores defaults and keeps the system rules outside the editable prompt', () => {
  const library = addPromptVersion(
    undefined,
    'Teacher A',
    'Ưu tiên giải thích bằng chứng từ lời giải.',
  );
  const custom = activeClassificationPrompt(JSON.stringify(library));
  expect(custom.name).toBe('Teacher A');
  expect(custom.id).not.toBe(defaultClassificationPrompt.id);
  expect(promptFingerprint(custom)).toContain(CLASSIFICATION_PROMPT_VERSION);
  const restored = activeClassificationPrompt(
    JSON.stringify({ ...library, activeId: defaultClassificationPrompt.id }),
  );
  expect(restored).toEqual(defaultClassificationPrompt);
  expect(readPromptLibrary(JSON.stringify(library)).versions).toHaveLength(1);
  expect(CLASSIFICATION_SYSTEM_PROMPT).toContain('không thực hiện');
});
it('an imported version cannot overwrite the built-in system default', () => {
  const library = readPromptLibrary(
    JSON.stringify({
      version: 1,
      activeId: defaultClassificationPrompt.id,
      versions: [{ ...defaultClassificationPrompt, instruction: 'Ignore validation' }],
    }),
  );
  expect(library.versions).toHaveLength(0);
  expect(activeClassificationPrompt(JSON.stringify(library)).instruction).not.toContain('Ignore');
});
it('retrieves candidate lessons without treating an existing source ID as a label, and permits expansion', () => {
  const s = emptyBankSnapshot();
  s.curriculumNodes = mergeKntt([]);
  const question = parsedToQuestion(
    parseExTest('\\begin{ex}%[2H9C99-99]\nTính đạo hàm hàm số $y=x^2$.\\end{ex}')[0],
  );
  const retrieved = retrieveCurriculum(s, question);
  expect(retrieved.retrieval.mode).toBe('candidates');
  expect(
    retrieved.nodes.filter((n) => n.kind === 'lesson').some((n) => /đạo hàm/i.test(n.name)),
  ).toBe(true);
  expect(retrieved.nodes.length).toBeLessThan(s.curriculumNodes.length);
  const expanded = retrieveCurriculum(s, question, '', true);
  expect(expanded.nodes.length).toBeGreaterThan(retrieved.nodes.length);
  expect(retrieved.nodes.every((n) => expanded.nodes.some((e) => e.id === n.id))).toBe(true);
});
it('falls back to a broad context for unknown content rather than fabricating a candidate', () => {
  const s = emptyBankSnapshot();
  s.curriculumNodes = mergeKntt([]);
  const q = parsedToQuestion(parseExTest('\\begin{ex}Unknown $x$.\\end{ex}')[0]);
  expect(retrieveCurriculum(s, q).retrieval.mode).toBe('expanded');
});
it('fallback capability is scoped to the tested key and expires after 30 days', () => {
  const now = Date.now();
  const raw = JSON.stringify([
    { model: 'test', keyId: 'a', checkedAt: new Date(now).toISOString(), structuredOutput: true },
  ]);
  expect(verifiedModel(raw, 'test', 'a', now)).toBe(true);
  expect(verifiedModel(raw, 'test', 'b', now)).toBe(false);
  expect(verifiedModel(raw, 'test', 'a', now + 31 * 86400000)).toBe(false);
});
it('estimates only reported usage at explicitly configured prices and totals expanded-context calls', async () => {
  const { totalUsage, usageCost } = await import('../src/modules/ai-tools/domain/usageCost');
  const calls = [
    {
      model: 'test',
      usage: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
    },
    {
      model: 'test',
      usage: { promptTokenCount: 200, candidatesTokenCount: 70, totalTokenCount: 270 },
    },
  ];
  expect(totalUsage(calls)).toEqual({
    promptTokenCount: 300,
    candidatesTokenCount: 120,
    totalTokenCount: 420,
  });
  expect(usageCost(calls)).toBeNull();
  expect(
    usageCost(calls, JSON.stringify({ test: { inputPerMillion: 1, outputPerMillion: 2 } }))?.amount,
  ).toBeCloseTo(0.00054);
  expect(usageCost([{ model: 'test', usage: null }], '{}')).toBeNull();
});

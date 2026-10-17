import { expect, it } from 'vitest';
import {
  activeKnttNodes,
  classificationContext,
} from '../src/modules/question-bank/domain/classificationContext';
import { mergeKntt } from '../src/modules/question-bank/domain/kntt';
import { mergeMathHubId6 } from '../src/modules/question-bank/domain/mathhubCurriculum';
import {
  gradeNumber,
  questionGrade,
} from '../src/modules/question-bank/domain/curriculumPresentation';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parsedToQuestion, parseExTest } from '../src/modules/question-bank/domain/parser';
import { promptInput } from '../src/modules/question-bank/services/classificationProvider';

it('shows only the three KNTT grade roots while preserving old linked nodes', () => {
  const s = emptyBankSnapshot();
  const legacy = mergeMathHubId6([]);
  s.curriculumNodes = mergeKntt(legacy);
  const before = JSON.stringify(s);
  const visible = activeKnttNodes(s);
  expect(visible.filter((n) => n.kind === 'grade').map((n) => gradeNumber(n.code))).toEqual([
    10, 11, 12,
  ]);
  expect(legacy.every((n) => s.curriculumNodes.includes(n))).toBe(true);
  expect(JSON.stringify(s)).toBe(before);
});

it('counts legacy linked and unlinked questions under the correct grade without remapping lessons', () => {
  const nodes = mergeKntt(mergeMathHubId6([]));
  const source = String.raw`\begin{ex}%[0D1N1-1]
  Test\end{ex}`;
  const linked = parsedToQuestion(parseExTest(source)[0], 'old.tex', nodes);
  const unlinked = parsedToQuestion(parseExTest(source)[0]);
  const before = JSON.stringify(linked);
  expect(questionGrade(linked, nodes)).toBe(10);
  expect(questionGrade(unlinked, nodes)).toBe(10);
  expect(linked.gradeNodeId).not.toMatch(/^kntt-2026-/);
  expect(JSON.stringify(linked)).toBe(before);
  expect(questionGrade({ ...unlinked, classificationCode: '' }, nodes)).toBeNull();
  expect(gradeNumber('6')).toBe(6);
});

it('uses the same 24 chapters and 79 numbered lessons in the AI context, excluding old trees', () => {
  const s = emptyBankSnapshot();
  s.curriculumNodes = mergeKntt(mergeMathHubId6([]));
  const q = parsedToQuestion(parseExTest('\\begin{ex}Test\\end{ex}')[0]);
  const context = classificationContext(s);
  const input = JSON.parse(promptInput(s, q));
  expect(input.curriculum.nodes.map((n: { id: string }) => n.id)).toEqual(
    context.nodes.map((n) => n.id),
  );
  expect(context.nodes.filter((n) => n.kind === 'chapter')).toHaveLength(24);
  expect(context.nodes.filter((n) => n.kind === 'lesson')).toHaveLength(79);
  expect(context.forms).toHaveLength(6);
  expect(context.missingLessons.length).toBeGreaterThan(0);
  for (const [grade, lessons] of [
    [10, 27],
    [11, 33],
    [12, 19],
  ]) {
    const scoped = classificationContext(s, `kntt-2026-g${grade}`);
    expect(
      scoped.nodes
        .filter((n) => n.kind === 'lesson')
        .map((n) => Number(n.code))
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: lessons }, (_, i) => i + 1));
  }
});

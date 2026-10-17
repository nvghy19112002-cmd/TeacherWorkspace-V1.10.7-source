import { expect, it } from 'vitest';
import {
  acceptKnttBatch,
  pendingKnttRuns,
} from '../src/modules/question-bank/domain/batchApproval';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { mergeKntt } from '../src/modules/question-bank/domain/kntt';
import {
  scanMetadata,
  resultForSelection,
} from '../src/modules/question-bank/domain/classificationContext';
import { classificationResultSchema } from '../src/modules/question-bank/domain/classification';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';

function fixture() {
  const s = emptyBankSnapshot();
  s.curriculumNodes = mergeKntt([]);
  const form = s.curriculumNodes.find((n) => n.kind === 'form')!;
  const result = resultForSelection(
    s,
    classificationResultSchema.parse({
      proposedClassificationCode: '',
      grade: '10',
      domain: 'D',
      chapterId: null,
      lessonId: null,
      formId: null,
      level: 'N',
      primaryLearningOutcomeId: null,
      secondaryLearningOutcomeIds: [],
      alignment: 'direct',
      confidence: 0.9,
      reasoningSummary: 'Đã đối chiếu',
      evidence: [],
      independentAnswer: '',
      answerCheck: 'missing',
      dataCheck: 'valid',
      warnings: [],
      alternativeClassifications: [],
    }),
    form.id,
    'N',
  );
  for (const [index, text] of ['Alpha', 'Beta'].entries()) {
    const q = parsedToQuestion(parseExTest(`\\begin{ex}${text}\\end{ex}`)[0]);
    s.questions.push(q);
    s.classificationRuns.push({
      id: `run-${index}`,
      questionId: q.id,
      provider: 'gemini',
      model: 'test',
      resultJson: JSON.stringify({ ...result, ...scanMetadata(s, q) }),
      accepted: false,
      createdAt: q.createdAt,
    });
  }
  return s;
}
it('applies a batch without changing sources, with unique sequences and review status', () => {
  const s = fixture(),
    before = JSON.stringify(s);
  const report = acceptKnttBatch(
    s,
    s.questions.map((q) => q.id),
  );
  expect(report.applied).toHaveLength(2);
  expect(report.skipped).toEqual([]);
  expect(report.snapshot.questions.map((q) => q.sequenceNumber)).toEqual([1, 2]);
  expect(report.snapshot.questions.map((q) => q.rawSource)).toEqual(
    s.questions.map((q) => q.rawSource),
  );
  expect(report.snapshot.questions.every((q) => q.status === 'review')).toBe(true);
  expect(report.snapshot.revisions).toHaveLength(2);
  expect(JSON.stringify(s)).toBe(before);
});
it('skips a stale or locked question while applying valid proposals', () => {
  const s = fixture();
  s.questions[1].rawSource += ' changed';
  let report = acceptKnttBatch(
    s,
    s.questions.map((q) => q.id),
  );
  expect(report.applied).toEqual([s.questions[0].id]);
  expect(report.skipped).toHaveLength(1);
  expect(report.snapshot.questions[1]).toEqual(s.questions[1]);
  const locked = fixture();
  locked.questions[1].idLocked = true;
  report = acceptKnttBatch(
    locked,
    locked.questions.map((q) => q.id),
  );
  expect(report.applied).toHaveLength(1);
  expect(report.skipped[0].message).toContain('khóa');
});
it('never falls back to an older proposal after the latest is accepted or invalid', () => {
  const s = fixture();
  s.classificationRuns.push({ ...s.classificationRuns[0], id: 'newest', accepted: true });
  expect(pendingKnttRuns(s, [s.questions[0].id])).toEqual([]);
  expect(acceptKnttBatch(s, [s.questions[0].id]).applied).toEqual([]);
  s.classificationRuns.at(-1)!.accepted = false;
  s.classificationRuns.at(-1)!.resultJson = '{}';
  const report = acceptKnttBatch(s, [s.questions[0].id, s.questions[0].id]);
  expect(report.applied).toEqual([]);
  expect(report.skipped).toHaveLength(1);
});

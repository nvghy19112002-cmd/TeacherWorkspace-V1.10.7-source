import { it, expect } from 'vitest';
import {
  scanMetadata,
  classificationFingerprint,
  resultForSelection,
} from '../src/modules/question-bank/domain/classificationContext';
import { mergeKntt, acceptKnttRun } from '../src/modules/question-bank/domain/kntt';
import { emptyBankSnapshot, type BankSnapshot } from '../src/modules/question-bank/domain/model';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';
import { buildClassificationCode } from '../src/modules/question-bank/domain/ids';
function fixture() {
  const s: BankSnapshot = emptyBankSnapshot();
  s.curriculumNodes = mergeKntt([]);
  const lesson = s.curriculumNodes.find((n) => n.kind === 'lesson' && n.code === '20')!;
  const chapter = s.curriculumNodes.find((n) => n.id === lesson.parentId)!;
  const domain = s.curriculumNodes.find((n) => n.id === chapter.parentId)!;
  const grade = s.curriculumNodes.find((n) => n.id === domain.parentId)!;
  const form = {
    ...lesson,
    id: lesson.id + '-f1',
    parentId: lesson.id,
    kind: 'form' as const,
    code: '1',
    name: 'Dạng đã đối chiếu',
  };
  s.curriculumNodes.push(form);
  const q = parsedToQuestion(parseExTest('\\begin{ex}Test\\end{ex}')[0]);
  s.questions = [q];
  const code = buildClassificationCode(s.curriculumNodes, {
    gradeNodeId: grade.id,
    domainNodeId: domain.id,
    chapterNodeId: chapter.id,
    lessonNodeId: lesson.id,
    formNodeId: form.id,
    level: 'N',
  });
  const result = {
    ...scanMetadata(s, q),
    proposedClassificationCode: code,
    grade: String(Number(grade.code) + 10),
    domain: domain.code,
    chapterId: chapter.id,
    lessonId: lesson.id,
    formId: form.id,
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
  };
  s.classificationRuns = [
    {
      id: 'run',
      questionId: q.id,
      provider: 'gemini',
      model: 'test',
      resultJson: JSON.stringify(result),
      accepted: false,
      createdAt: q.createdAt,
    },
  ];
  return { s, result, lesson, form };
}
it('approves textbook global lesson number, atomically links and preserves original source', () => {
  const { s, lesson, form } = fixture();
  const next = acceptKnttRun(s, 'run');
  expect(next.questions[0].lessonNodeId).toBe(lesson.id);
  expect(next.questions[0].formNodeId).toBe(form.id);
  expect(next.questions[0].classificationCode).toContain('N20-1');
  expect(next.questions[0].rawSource).toBe(s.questions[0].rawSource);
  expect(next.questions[0].id).toBe(s.questions[0].id);
  expect(next.classificationRuns[0].accepted).toBe(true);
  expect(next.revisions).toHaveLength(1);
  expect(s.classificationRuns[0].accepted).toBe(false);
});
it('rejects stale scans and locked saved-exam questions', () => {
  const { s } = fixture();
  s.questions[0].updatedAt = '2030-01-01T00:00:00.000Z';
  expect(() => acceptKnttRun(s, 'run')).toThrow();
  const other = fixture().s;
  other.questions[0].idLocked = true;
  expect(() => acceptKnttRun(other, 'run')).toThrow();
});
it('rejects guessed textbook codes, missing information and mismatched paths', () => {
  for (const patch of [
    { proposedClassificationCode: '0D1N1-1' },
    { dataCheck: 'insufficient' },
    { lessonId: 'wrong' },
  ]) {
    const { s, result } = fixture();
    s.classificationRuns[0].resultJson = JSON.stringify({ ...result, ...patch });
    expect(() => acceptKnttRun(s, 'run')).toThrow();
  }
});
it('seeding keeps existing taxonomies and is idempotent', () => {
  const rows = mergeKntt([]);
  expect(mergeKntt(rows)).toEqual(rows);
  expect(rows.filter((n) => n.kind === 'grade')).toHaveLength(3);
});

it('does not make a new question ready merely because AI checked the answer', () => {
  const { s, result } = fixture();
  s.classificationRuns[0].resultJson = JSON.stringify({ ...result, answerCheck: 'correct' });
  expect(acceptKnttRun(s, 'run').questions[0].status).toBe('review');
});
it('retains sequence when a classification is unchanged', () => {
  const { s, result } = fixture();
  const q = s.questions[0];
  q.classificationCode = result.proposedClassificationCode;
  q.sequenceNumber = 9;
  q.displayId = q.classificationCode + '-009';
  expect(acceptKnttRun(s, 'run').questions[0].displayId).toBe(q.displayId);
});
it('rejects changed taxonomy, old metadata and exact source changes hidden by normalized hash', () => {
  const a = fixture();
  a.s.curriculumNodes.find((n) => n.id === a.form.id)!.name = 'Tên dạng mới';
  expect(() => acceptKnttRun(a.s, 'run')).toThrow(/cây KNTT/);
  const b = fixture();
  b.s.questions[0].rawSource += '% comment changed';
  expect(() => acceptKnttRun(b.s, 'run')).toThrow();
  const c = fixture();
  const raw = JSON.parse(c.s.classificationRuns[0].resultJson);
  delete raw.__contextFingerprint;
  c.s.classificationRuns[0].resultJson = JSON.stringify(raw);
  expect(() => acceptKnttRun(c.s, 'run')).toThrow();
});
it('teacher correction builds all links and keeps original AI evidence in history', () => {
  const { s, result, form } = fixture();
  s.classificationRuns[0].resultJson = JSON.stringify({
    ...result,
    grade: '12',
    chapterId: 'wrong',
  });
  const next = acceptKnttRun(s, 'run', {
    formId: form.id,
    level: 'H',
    reason: 'Đối chiếu bài và mức độ',
  });
  expect(next.questions[0].classificationCode).toContain('H20-1');
  expect(next.questions[0].rawSource).toBe(s.questions[0].rawSource);
  const saved = JSON.parse(next.classificationRuns[0].resultJson);
  expect(saved.__aiOriginal.chapterId).toBe('wrong');
  expect(saved.__teacherCorrection.reason).toContain('Đối chiếu');
});
it('cannot link an unrelated learning outcome or leave the explicitly selected scope', () => {
  const { s, result, form } = fixture();
  const other = s.curriculumNodes.find((n) => n.kind === 'lesson' && n.id !== form.parentId)!;
  s.learningOutcomes.push({
    id: 'foreign',
    nodeId: other.id,
    code: 'Y1',
    content: 'Other lesson',
    source: 'teacher',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const q = s.questions[0];
  s.classificationRuns[0].resultJson = JSON.stringify({
    ...result,
    ...scanMetadata(s, q),
    primaryLearningOutcomeId: 'foreign',
  });
  expect(() => acceptKnttRun(s, 'run')).toThrow(/Yêu cầu/);
  s.classificationRuns[0].resultJson = JSON.stringify({
    ...result,
    ...scanMetadata(s, q, other.id),
  });
  expect(() => acceptKnttRun(s, 'run')).toThrow(/phạm vi/);
});
it('preserves parser warnings and marks incorrect answer as needing a fix', () => {
  const { s, result } = fixture();
  s.questions[0].warnings = ['Thiếu bộ khai báo'];
  s.classificationRuns[0].resultJson = JSON.stringify({ ...result, answerCheck: 'incorrect' });
  const q = acceptKnttRun(s, 'run').questions[0];
  expect(q.status).toBe('needs_fix');
  expect(q.warnings).toContain('Thiếu bộ khai báo');
});
it('context fingerprint ignores storage ordering and timestamps', () => {
  const { s, result, form } = fixture();
  const before = classificationFingerprint(s);
  s.curriculumNodes.reverse();
  s.curriculumNodes[0].updatedAt = new Date().toISOString();
  expect(classificationFingerprint(s)).toBe(before);
  expect(
    resultForSelection(s, result as Parameters<typeof resultForSelection>[1], form.id, 'V')
      .proposedClassificationCode,
  ).toContain('V20-1');
});

it('imports the six existing source forms and does not overwrite a teacher form with the same code', () => {
  const nodes = mergeKntt([]);
  expect(nodes.filter((n) => n.kind === 'form')).toHaveLength(6);
  const form = nodes.find((n) => n.kind === 'form')!;
  form.name = 'Tên do giáo viên chỉnh';
  form.id = 'custom-approved-form';
  const again = mergeKntt(nodes);
  expect(
    again.filter((n) => n.parentId === form.parentId && n.kind === 'form' && n.code === form.code),
  ).toHaveLength(1);
  expect(again.find((n) => n.id === form.id)?.name).toBe('Tên do giáo viên chỉnh');
});

it('recognizes teacher-created UUID forms by their KNTT ancestry', () => {
  const { s, result, form } = fixture();
  form.id = 'teacher-form-uuid';
  s.classificationRuns[0].resultJson = JSON.stringify({
    ...result,
    formId: form.id,
    ...scanMetadata(s, s.questions[0]),
  });
  const q = acceptKnttRun(s, 'run').questions[0];
  expect(q.formNodeId).toBe('teacher-form-uuid');
  expect(q.classificationCode).toContain('N20-1');
});

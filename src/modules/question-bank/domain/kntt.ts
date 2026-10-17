import tree from '../data/mathhub/TOAN-6-12-KNTT.json';
import { buildClassificationCode, nextQuestionId } from './ids';
import { classificationResultSchema } from './classification';
import type { BankSnapshot, CurriculumNode, Question } from './model';
import {
  KNTT_PREFIX,
  classificationContext,
  classificationFingerprint,
  scanSourceFingerprint,
  resultForSelection,
  resultPathError,
  knttPath,
} from './classificationContext';
export { KNTT_PREFIX, isKntt } from './classificationContext';
export function mergeKntt(current: CurriculumNode[]): CurriculumNode[] {
  const rows = [...current];
  const now = new Date().toISOString();
  const add = (
    id: string,
    parentId: string | null,
    kind: CurriculumNode['kind'],
    code: string,
    name: string,
    sortOrder: number,
  ) => {
    if (
      !rows.some(
        (n) =>
          n.id === id ||
          (parentId !== null && n.parentId === parentId && n.kind === kind && n.code === code),
      )
    )
      rows.push({
        id,
        parentId,
        kind,
        code,
        name,
        sortOrder,
        archived: false,
        description:
          'KNTT 2026 · Số chương/bài từ cây KNTT do người dùng cung cấp. Dạng bài do giáo viên duyệt.',
        createdAt: now,
        updatedAt: now,
      });
  };
  for (const grade of tree.nodes.filter((g) => ['10', '11', '12'].includes(g.code))) {
    const g = `${KNTT_PREFIX}g${grade.code}`;
    add(
      g,
      null,
      'grade',
      String(Number(grade.code) - 10),
      `Lớp ${grade.code} · KNTT`,
      Number(grade.code),
    );
    for (const chapter of grade.children) {
      const chapterNumber = chapter.code.replace(/^C/, '');
      const h = (
        grade.code === '10' ? ['3', '4', '7'] : grade.code === '11' ? ['4', '7'] : ['2', '5']
      ).includes(chapterNumber);
      const domain = h ? 'H' : 'D';
      const d = `${g}-${domain}`;
      add(d, g, 'domain', domain, h ? 'Hình học' : 'Đại số · Thống kê · Xác suất', h ? 1 : 0);
      const c = `${d}-c${chapterNumber}`;
      add(c, d, 'chapter', chapterNumber, chapter.name, Number(chapterNumber));
      for (const lesson of chapter.children) {
        const lessonId = `${c}-b${lesson.code}`;
        add(lessonId, c, 'lesson', lesson.code, lesson.name, Number(lesson.code));
        const forms =
          (lesson as { children?: Array<{ code: string; name: string }> }).children ?? [];
        for (const form of forms)
          add(
            `${lessonId}-f${form.code}`,
            lessonId,
            'form',
            form.code,
            form.name,
            Number(form.code),
          );
      }
    }
  }
  return rows;
}
export function acceptKnttRun(
  snapshot: BankSnapshot,
  runId: string,
  correction?: { formId: string; level: Question['level']; reason: string },
): BankSnapshot {
  const run = snapshot.classificationRuns.find((r) => r.id === runId);
  if (!run || run.accepted) throw new Error('Đề xuất không tồn tại hoặc đã áp dụng.');
  const raw = JSON.parse(run.resultJson);
  const original = classificationResultSchema.parse(raw);
  const result = correction
    ? resultForSelection(snapshot, original, correction.formId, correction.level)
    : original;
  if (correction && correction.reason.trim().length < 5)
    throw new Error('Ghi lý do sửa phân loại (ít nhất 5 ký tự).');
  const q = snapshot.questions.find((q) => q.id === run.questionId && !q.deletedAt);
  if (!q || raw.__sourceHash !== q.contentHash || raw.__sourceUpdatedAt !== q.updatedAt)
    throw new Error(
      'Câu đã đổi hoặc đề xuất cũ chưa có kiểm tra phiên bản. Quét lại trước khi duyệt.',
    );
  if (
    raw.__scheme !== 'kntt-2026' ||
    raw.__sourceFingerprint !== scanSourceFingerprint(q) ||
    raw.__contextFingerprint !== classificationFingerprint(snapshot)
  )
    throw new Error('Nguồn câu hoặc cây KNTT đã đổi; quét lại trước khi duyệt.');
  if (q.idLocked) throw new Error('ID câu đã dùng trong đề bị khóa; nhân bản để phân loại lại.');
  if (
    result.dataCheck !== 'valid' ||
    (!correction && ['insufficient_data', 'out_of_scope', 'off_target'].includes(result.alignment))
  )
    throw new Error('AI chưa đủ căn cứ. Kiểm tra và quét lại; không áp dụng đề xuất này.');
  if (
    raw.__scopeId &&
    !classificationContext(snapshot, raw.__scopeId).forms.some((n) => n.id === result.formId)
  )
    throw new Error('Đề xuất nằm ngoài phạm vi đã chọn. Quét lại với phạm vi đúng.');
  const pathError = resultPathError(snapshot, result);
  if (pathError) throw new Error(pathError);
  const { form, lesson, chapter, domain, grade } = knttPath(snapshot, result.formId ?? '');
  const path = {
    gradeNodeId: grade.id,
    domainNodeId: domain.id,
    chapterNodeId: chapter.id,
    lessonNodeId: lesson.id,
    formNodeId: form.id,
    level: result.level,
  };
  const code = buildClassificationCode(snapshot.curriculumNodes, path);
  if (result.proposedClassificationCode !== code)
    throw new Error(`ID đề xuất phải là ${code}, đúng số chương/bài KNTT.`);
  const outcomeIds = [
    result.primaryLearningOutcomeId,
    ...result.secondaryLearningOutcomeIds,
  ].filter(Boolean);
  const pathIds = new Set([grade.id, domain.id, chapter.id, lesson.id, form.id]);
  if (
    outcomeIds.some(
      (id) =>
        !snapshot.learningOutcomes.some((o) => o.id === id && o.active && pathIds.has(o.nodeId)),
    )
  )
    throw new Error('Yêu cầu cần đạt không có trong dữ liệu đã duyệt.');
  const existing =
    q.classificationCode === code &&
    q.sequenceNumber &&
    q.displayId === `${code}-${String(q.sequenceNumber).padStart(3, '0')}`;
  const nextId = existing
    ? { displayId: q.displayId, sequenceNumber: q.sequenceNumber! }
    : nextQuestionId(
        snapshot.questions.filter((row) => row.id !== q.id),
        code,
      );
  if (code.length > 80)
    throw new Error('Mã phân loại vượt giới hạn lưu trữ. Kiểm tra mã chương/bài/dạng.');
  const tags = [...q.tags.filter((t) => !t.startsWith('curriculum:')), 'curriculum:kntt-2026'];
  if (tags.length > 100)
    throw new Error('Câu đã đủ 100 thẻ. Gỡ bớt thẻ trước khi áp dụng phân loại.');
  const now = new Date().toISOString();
  return {
    ...snapshot,
    questions: snapshot.questions.map((row) =>
      row.id === q.id
        ? {
            ...row,
            ...path,
            ...nextId,
            classificationCode: code,
            tags,
            primaryOutcomeId: result.primaryLearningOutcomeId,
            secondaryOutcomeIds: result.secondaryLearningOutcomeIds,
            status:
              result.answerCheck === 'correct' && row.status === 'approved'
                ? 'approved'
                : result.answerCheck === 'incorrect'
                  ? 'needs_fix'
                  : 'review',
            reasoning: correction
              ? `${result.reasoningSummary}\nGiáo viên sửa: ${correction.reason.trim()}`
              : result.reasoningSummary,
            confidence: Math.round(result.confidence * 100),
            warnings: [
              ...new Set([
                ...row.warnings,
                ...result.warnings,
                ...(result.answerCheck !== 'correct'
                  ? [`Cần kiểm tra đáp án: ${result.answerCheck}`]
                  : []),
              ]),
            ].slice(0, 100),
            updatedAt: now,
          }
        : row,
    ),
    classificationRuns: snapshot.classificationRuns.map((r) =>
      r.id === run.id
        ? {
            ...r,
            accepted: true,
            resultJson: JSON.stringify({
              ...raw,
              ...result,
              ...(correction
                ? {
                    __aiOriginal: {
                      proposedClassificationCode: original.proposedClassificationCode,
                      grade: original.grade,
                      domain: original.domain,
                      chapterId: original.chapterId,
                      lessonId: original.lessonId,
                      formId: original.formId,
                      level: original.level,
                      primaryLearningOutcomeId: original.primaryLearningOutcomeId,
                      secondaryLearningOutcomeIds: original.secondaryLearningOutcomeIds,
                    },
                    __teacherCorrection: { ...correction, reason: correction.reason.trim() },
                  }
                : {}),
            }),
          }
        : r,
    ),
    revisions: [
      ...snapshot.revisions,
      {
        id: crypto.randomUUID(),
        questionId: q.id,
        snapshot: JSON.stringify(q),
        reason: correction
          ? `Giáo viên sửa ID6: ${correction.reason.trim().slice(0, 400)}`
          : 'Giáo viên duyệt ID6 KNTT 2026',
        createdAt: now,
      },
    ],
  };
}

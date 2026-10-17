import { applyParsedMetadata, parseExTest } from './parser';
import { buildClassificationCode, nextQuestionId } from './ids';
import { normalizeQuestionSource, questionHash } from './normalize';
import { questionSchema, type CurriculumNode, type Question } from './model';
import { flagSourceIdConflicts } from './sourceIdConflicts';
import { id6NodePath } from './mathhubCurriculum';

/** LaTeX is authoritative for type, answers and solution; source bytes are never rewritten. */
export function prepareEditedQuestion(
  draft: Question,
  previous: Question | undefined,
  questions: Question[],
  nodes: CurriculumNode[],
): Question {
  if (!draft.rawSource.trim()) throw new Error('Nội dung câu hỏi không được để trống.');
  const rows = parseExTest(draft.rawSource);
  if (rows.length !== 1)
    throw new Error('Trình sửa chỉ nhận một câu. Dùng Nhập .tex hoặc Dán LaTeX để nhập nhiều câu.');
  const duplicate = questions.find(
    (q) => q.id !== draft.id && !q.deletedAt && q.rawSource.trim() === draft.rawSource.trim(),
  );
  if (duplicate)
    throw new Error(
      `Mã LaTeX này đã có trong kho (${duplicate.displayId || duplicate.classificationCode || 'câu chưa có ID'}).`,
    );
  const kntt = draft.tags.includes('curriculum:kntt-2026');
  let refreshed = applyParsedMetadata(kntt ? { ...draft, idLocked: false } : draft, rows[0], nodes);
  if (kntt)
    refreshed = {
      ...refreshed,
      classificationCode: draft.classificationCode,
      displayId: draft.displayId,
      sequenceNumber: draft.sequenceNumber,
      gradeNodeId: draft.gradeNodeId,
      domainNodeId: draft.domainNodeId,
      chapterNodeId: draft.chapterNodeId,
      lessonNodeId: draft.lessonNodeId,
      formNodeId: draft.formNodeId,
      level: draft.level,
      idLocked: draft.idLocked,
    };
  if (previous) {
    // Older banks allowed answers/solutions outside LaTeX. Keep that user data;
    // removing an existing inline command still clears its derived metadata.
    let oldParsed: ReturnType<typeof parseExTest>[number] | undefined;
    try {
      oldParsed = parseExTest(previous.rawSource)[0];
    } catch {
      /* Preserve legacy metadata if its old source cannot be parsed. */
    }
    const externalAnswer = !rows[0].answer && !oldParsed?.answer && previous.answer;
    const externalSolution = !rows[0].solution && !oldParsed?.solution && previous.solution;
    if (externalAnswer || externalSolution)
      refreshed = {
        ...refreshed,
        answer: externalAnswer || refreshed.answer,
        solution: externalSolution || refreshed.solution,
        warnings: [
          ...refreshed.warnings,
          ...(draft.rawSource !== previous.rawSource
            ? [
                'Câu cũ có đáp án/lời giải lưu ngoài mã LaTeX; đã giữ lại, cần đối chiếu sau khi sửa nguồn.',
              ]
            : []),
        ],
      };
  }
  if (!kntt && rows[0].sourceId && !id6NodePath(refreshed.classificationCode, nodes)) {
    refreshed = {
      ...refreshed,
      gradeNodeId: null,
      domainNodeId: null,
      chapterNodeId: null,
      lessonNodeId: null,
      formNodeId: null,
    };
  }
  const classificationCode = kntt
    ? draft.classificationCode
    : rows[0].sourceId
      ? refreshed.classificationCode
      : buildClassificationCode(nodes, refreshed) || refreshed.classificationCode;
  if (previous?.idLocked && classificationCode !== previous.classificationCode)
    throw new Error('ID đã khóa vì câu từng được dùng trong đề. Không thể đổi phân loại.');
  let displayId = refreshed.displayId;
  let sequenceNumber = refreshed.sequenceNumber;
  if (
    classificationCode &&
    (!previous || classificationCode !== previous.classificationCode || !displayId)
  ) {
    const next = nextQuestionId(
      questions.filter((q) => q.id !== draft.id),
      classificationCode,
    );
    displayId = next.displayId;
    sequenceNumber = next.sequenceNumber;
  }
  const saved = questionSchema.parse({
    ...refreshed,
    classificationCode,
    displayId,
    sequenceNumber,
    normalizedSource: normalizeQuestionSource(draft.rawSource),
    contentHash: questionHash(draft.rawSource),
    updatedAt: new Date().toISOString(),
  });
  return flagSourceIdConflicts(
    [saved],
    questions.filter((q) => q.id !== saved.id),
  )[0];
}

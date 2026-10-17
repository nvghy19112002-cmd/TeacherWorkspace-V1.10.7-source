import type { BankSnapshot, CurriculumNode, Question } from './model';
import type { ClassificationResult } from './classification';
import { stableHash } from './normalize';
import { maskComments } from './latex';
import { buildClassificationCode } from './ids';
export const KNTT_PREFIX = 'kntt-2026-';
export const isKntt = (n: CurriculumNode) => n.id.startsWith(KNTT_PREFIX);
export function activeKnttNodes(s: BankSnapshot) {
  const byId = new Map(s.curriculumNodes.filter((n) => !n.archived).map((n) => [n.id, n]));
  return [...byId.values()].filter((n) => {
    const seen = new Set<string>();
    let current: CurriculumNode | undefined = n;
    while (current) {
      if (seen.has(current.id)) return false;
      seen.add(current.id);
      if (!current.parentId) return current.kind === 'grade' && isKntt(current);
      current = byId.get(current.parentId);
    }
    return false;
  });
}
export function knttPath(s: BankSnapshot, formId: string) {
  const byId = new Map(activeKnttNodes(s).map((n) => [n.id, n]));
  const form = byId.get(formId),
    lesson = byId.get(form?.parentId ?? ''),
    chapter = byId.get(lesson?.parentId ?? ''),
    domain = byId.get(chapter?.parentId ?? ''),
    grade = byId.get(domain?.parentId ?? '');
  if (
    form?.kind !== 'form' ||
    lesson?.kind !== 'lesson' ||
    chapter?.kind !== 'chapter' ||
    domain?.kind !== 'domain' ||
    grade?.kind !== 'grade' ||
    grade.parentId !== null ||
    !['0', '1', '2'].includes(grade.code) ||
    !['D', 'H'].includes(domain.code) ||
    [form, lesson, chapter].some((n) => !/^\d+$/.test(n.code))
  )
    throw new Error('Đường dẫn lớp–nhánh–chương–bài–dạng KNTT không hợp lệ.');
  return { grade, domain, chapter, lesson, form };
}
export function classificationContext(s: BankSnapshot, scopeId = '') {
  const all = activeKnttNodes(s),
    byId = new Map(all.map((n) => [n.id, n]));
  if (scopeId && !byId.has(scopeId)) throw new Error('Phạm vi KNTT không còn hoạt động.');
  const selected = new Set<string>();
  for (const n of all) {
    let p: CurriculumNode | undefined = n;
    while (p) {
      if (!scopeId || p.id === scopeId) {
        selected.add(n.id);
        break;
      }
      p = byId.get(p.parentId ?? '');
    }
  }
  for (const id of [...selected]) {
    let p = byId.get(id);
    while (p) {
      selected.add(p.id);
      p = byId.get(p.parentId ?? '');
    }
  }
  const nodes = all.filter((n) => selected.has(n.id));
  const forms = nodes
    .filter((n) => n.kind === 'form')
    .filter((n) => {
      try {
        knttPath(s, n.id);
        return true;
      } catch {
        return false;
      }
    });
  const learningOutcomes = s.learningOutcomes.filter((o) => o.active && selected.has(o.nodeId));
  return {
    nodes,
    forms,
    learningOutcomes,
    missingLessons: nodes.filter(
      (n) => n.kind === 'lesson' && !forms.some((f) => f.parentId === n.id),
    ),
  };
}
export function classificationFingerprint(s: BankSnapshot) {
  const nodes = activeKnttNodes(s)
    .map(({ id, parentId, kind, code, name, description }) => ({
      id,
      parentId,
      kind,
      code,
      name,
      description,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set(nodes.map((n) => n.id));
  const outcomes = s.learningOutcomes
    .filter((o) => o.active && ids.has(o.nodeId))
    .map(({ id, nodeId, code, content, source }) => ({ id, nodeId, code, content, source }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return stableHash(JSON.stringify({ nodes, outcomes }));
}
export const scanSourceFingerprint = (q: Question) =>
  stableHash(JSON.stringify([q.rawSource, q.questionType, q.answer, q.solution]));
export function scanMetadata(s: BankSnapshot, q: Question, scopeId = '') {
  return {
    __scheme: 'kntt-2026',
    __sourceHash: q.contentHash,
    __sourceUpdatedAt: q.updatedAt,
    __sourceFingerprint: scanSourceFingerprint(q),
    __contextFingerprint: classificationFingerprint(s),
    __scopeId: scopeId,
  };
}
export function scanPreflight(s: BankSnapshot, q: Question, scopeId = '') {
  if (q.deletedAt) return 'Câu đã ở thùng rác.';
  if (q.idLocked) return 'ID đã khóa do dùng trong đề; nhân bản nếu cần phân loại lại.';
  if (/\\(?:includegraphics|input|include)\b/.test(maskComments(q.rawSource)))
    return 'Câu tham chiếu hình/file ngoài chưa được gửi cho AI. Cần kiểm tra tài nguyên và phân loại thủ công.';
  try {
    if (!classificationContext(s, scopeId).forms.length)
      return 'Phạm vi chưa có dạng KNTT đã thiết lập. Thêm/đối chiếu dạng trước khi quét.';
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}
export function resultForSelection(
  s: BankSnapshot,
  r: ClassificationResult,
  formId: string,
  level: Question['level'],
): ClassificationResult {
  const p = knttPath(s, formId);
  const allowed = new Set([p.grade.id, p.domain.id, p.chapter.id, p.lesson.id, p.form.id]);
  const outcome = (id: string | null) =>
    id && s.learningOutcomes.some((o) => o.id === id && o.active && allowed.has(o.nodeId))
      ? id
      : null;
  return {
    ...r,
    grade: String(Number(p.grade.code) + 10),
    domain: p.domain.code,
    chapterId: p.chapter.id,
    lessonId: p.lesson.id,
    formId: p.form.id,
    level,
    proposedClassificationCode: buildClassificationCode(s.curriculumNodes, {
      gradeNodeId: p.grade.id,
      domainNodeId: p.domain.id,
      chapterNodeId: p.chapter.id,
      lessonNodeId: p.lesson.id,
      formNodeId: p.form.id,
      level,
    }),
    primaryLearningOutcomeId: outcome(r.primaryLearningOutcomeId),
    secondaryLearningOutcomeIds: [
      ...new Set(
        r.secondaryLearningOutcomeIds.filter(
          (id) => outcome(id) && id !== r.primaryLearningOutcomeId,
        ),
      ),
    ],
  };
}
export function resultPathError(s: BankSnapshot, r: ClassificationResult) {
  try {
    const canonical = resultForSelection(s, r, r.formId ?? '', r.level);
    for (const key of ['grade', 'domain', 'chapterId', 'lessonId', 'formId'] as const) {
      const value =
        key === 'grade' && ['0', '1', '2'].includes(r.grade)
          ? String(Number(r.grade) + 10)
          : r[key];
      if (value !== canonical[key])
        return 'AI trả lớp/nhánh/chương/bài không khớp dạng. Chọn lại đường dẫn trước khi duyệt.';
    }
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}

import { commandBlock, maskComments, parseChoices } from './latex';
import { parseClassificationCode } from './ids';
import { extractSourceIds, inspectId6 } from './id6Taxonomy';
import { questionHash, normalizeQuestionSource } from './normalize';
import type { CurriculumNode, Question } from './model';
import { id6NodePath } from './mathhubCurriculum';

export interface ParsedQuestion {
  rawSource: string;
  sourceId?: string;
  sourceIdOrigin?: string;
  questionType: Question['questionType'];
  answer: string;
  solution: string;
  hasImage: boolean;
  warnings: string[];
}

export function detectQuestionType(source: string): Question['questionType'] {
  if (/\\choiceTF\b/.test(source)) return 'true_false';
  if (/\\choice\b/.test(source)) return 'multiple_choice';
  if (/\\shortans(?:\[[^\]]*\])?\s*\{/.test(source)) return 'short_answer';
  if (/\\begin\{enumerate\}|\\begin\{itemize\}/.test(source)) return 'multi_part';
  return 'essay';
}

export function parseExTest(source: string): ParsedQuestion[] {
  const masked = maskComments(source);
  const blocks: string[] = [];
  let depth = 0,
    start = 0;
  for (const match of masked.matchAll(/\\(begin|end)\s*\{\s*ex\s*\}/g)) {
    let escapes = 0;
    for (let i = match.index - 1; i >= 0 && masked[i] === '\\'; i--) escapes++;
    if (escapes % 2) continue;
    if (match[1] === 'begin') {
      if (depth === 0) start = match.index;
      depth++;
    } else {
      if (depth === 0)
        throw new Error('Có môi trường ex đóng khi chưa mở. Hãy sửa trước khi nhập.');
      if (--depth === 0) blocks.push(source.slice(start, match.index + match[0].length));
    }
  }
  if (depth)
    throw new Error('Có môi trường ex chưa đóng. Hãy sửa file trước khi nhập để tránh bỏ sót câu.');
  const chunks = blocks.length ? blocks : source.trim() ? [source] : [];
  return chunks.map((rawSource) => {
    const clean = maskComments(rawSource);
    const questionType = detectQuestionType(clean);
    const choices = parseChoices(clean);
    const answer =
      commandBlock(clean, 'shortans') ||
      (questionType === 'true_false'
        ? choices.map((choice) => (choice.correct ? 'Đ' : 'S')).join(' – ')
        : choices
            .flatMap((choice, index) => (choice.correct ? [String.fromCharCode(65 + index)] : []))
            .join(', '));
    const solution = commandBlock(clean, 'loigiai');
    const candidates = extractSourceIds(rawSource);
    const ids = candidates.map((candidate) => candidate.value);
    const inspections = ids.map(inspectId6);
    const sourceId = ids.length === 1 && inspections[0].state === 'valid' ? ids[0] : undefined;
    const warnings: string[] = [];
    if ((clean.match(/\\begin\s*\{\s*ex\s*\}/g) ?? []).length > 1)
      warnings.push(
        'Môi trường ex lồng nhau đã được giữ nguyên trong câu ngoài. Cần đối chiếu và tách câu thủ công trước khi duyệt.',
      );
    if (ids.length > 1)
      warnings.push(`Có nhiều ID nguồn (${ids.join(', ')}); chọn ID đúng khi phân loại.`);
    if (ids.length === 1 && inspections[0].state !== 'valid')
      warnings.push(`ID nguồn ${ids[0]}: ${inspections[0].message}`);
    if (!/\\end\{ex\}/.test(rawSource) && /\\begin\{ex\}/.test(rawSource))
      warnings.push('Môi trường ex chưa đóng.');
    if (
      (questionType === 'multiple_choice' || questionType === 'true_false') &&
      choices.length !== 4
    )
      warnings.push('Chưa đọc đủ 4 phương án; cần kiểm tra mã LaTeX.');
    if (
      questionType === 'multiple_choice' &&
      choices.filter((choice) => choice.correct).length !== 1
    )
      warnings.push('Câu trắc nghiệm cần đúng một phương án được đánh dấu \\True.');
    if (!answer && !solution && !/\\True\b/.test(rawSource))
      warnings.push('Chưa nhận diện được đáp án hoặc lời giải.');
    return {
      rawSource,
      sourceId,
      sourceIdOrigin: sourceId ? candidates[0].origin : undefined,
      questionType,
      answer,
      solution,
      hasImage: /\\includegraphics|\\begin\{tikzpicture\}|\\begin\{axis\}/.test(rawSource),
      warnings,
    };
  });
}

/** Refresh derived metadata without changing the source, UUID or an already locked ID. */
export function applyParsedMetadata(
  current: Question,
  parsed: ParsedQuestion,
  nodes: CurriculumNode[],
): Question {
  const classificationCode = parsed.sourceId ? inspectId6(parsed.sourceId).classificationCode : '';
  if (classificationCode && current.idLocked && current.classificationCode !== classificationCode)
    throw new Error(
      'ID câu hỏi đã khóa vì từng được dùng trong đề; không thể thay phân loại từ mã nguồn.',
    );
  const path = classificationCode ? id6NodePath(classificationCode, nodes) : null;
  const changed = Boolean(classificationCode && classificationCode !== current.classificationCode);
  return {
    ...current,
    questionType: parsed.questionType,
    answer: parsed.answer,
    solution: parsed.solution,
    hasImage: parsed.hasImage,
    warnings: [
      ...parsed.warnings,
      ...(classificationCode && !path
        ? [`ID6 ${parsed.sourceId} hợp lệ nhưng chưa có nhánh tương ứng trong cây đang dùng.`]
        : []),
    ],
    ...(classificationCode
      ? {
          classificationCode,
          level: inspectId6(parsed.sourceId!).level ?? current.level,
          ...(path ?? {}),
          ...(changed ? { displayId: '', sequenceNumber: null } : {}),
        }
      : {}),
  };
}

export function parsedToQuestion(
  value: ParsedQuestion,
  source = '',
  nodes: CurriculumNode[] = [],
): Question {
  const now = new Date().toISOString();
  const classificationCode = value.sourceId ? inspectId6(value.sourceId).classificationCode : '';
  const path = id6NodePath(classificationCode, nodes);
  return {
    id: crypto.randomUUID(),
    displayId: '',
    classificationCode,
    sequenceNumber: null,
    rawSource: value.rawSource,
    normalizedSource: normalizeQuestionSource(value.rawSource),
    contentHash: questionHash(value.rawSource),
    questionType: value.questionType,
    answer: value.answer,
    solution: value.solution,
    level: parseClassificationCode(classificationCode)?.level ?? 'N',
    gradeNodeId: path?.gradeNodeId ?? null,
    domainNodeId: path?.domainNodeId ?? null,
    chapterNodeId: path?.chapterNodeId ?? null,
    lessonNodeId: path?.lessonNodeId ?? null,
    formNodeId: path?.formNodeId ?? null,
    primaryOutcomeId: null,
    secondaryOutcomeIds: [],
    tags: [],
    source,
    status: 'draft',
    confidence: null,
    reasoning: '',
    warnings: [
      ...value.warnings,
      ...(value.sourceId
        ? path
          ? []
          : [`ID6 ${value.sourceId} khớp cây ID6; cần bổ sung cây phân loại trước khi gắn nút.`]
        : ['Chưa xác định mức độ và cây phân loại từ ID nguồn.']),
    ],
    hasImage: value.hasImage,
    usageCount: 0,
    idLocked: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

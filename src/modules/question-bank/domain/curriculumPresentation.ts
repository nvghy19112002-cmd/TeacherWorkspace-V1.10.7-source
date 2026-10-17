import type { CurriculumNode, Question } from './model';
import { parseClassificationCode } from './ids';

export function gradeNumber(code: string): number | null {
  if (['0', '1', '2'].includes(code)) return Number(code) + 10;
  return /^\d+$/.test(code) ? Number(code) : null;
}

/** Aggregate by grade only. Legacy chapter/lesson numbering is never treated as KNTT. */
export function questionGrade(question: Question, nodes: CurriculumNode[]): number | null {
  if (question.gradeNodeId) {
    const root = nodes.find((n) => n.id === question.gradeNodeId && n.kind === 'grade');
    return root ? gradeNumber(root.code) : null;
  }
  const parsed = parseClassificationCode(question.classificationCode);
  return parsed ? gradeNumber(parsed.grade) : null;
}

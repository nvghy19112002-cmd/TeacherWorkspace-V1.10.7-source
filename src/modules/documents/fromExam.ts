import type { BankSnapshot, Exam, Question } from '../question-bank/domain/model';
import { prepareTexPreviewBatch } from '../question-bank/domain/texPreview';
import type { DocumentProject } from './model';
export function projectFromExam(data: BankSnapshot, exam: Exam): DocumentProject {
  const items = data.examItems
    .filter((i) => i.examId === exam.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const prepared = prepareTexPreviewBatch(
    items.map((i) => {
      const q = JSON.parse(i.questionSnapshot) as Question;
      return { id: i.id, label: q.displayId || 'Câu hỏi', source: q.rawSource };
    }),
    '',
    { integrated: true },
  );
  const mainId = crypto.randomUUID();
  const node = (id: string, name: string, text: string) => ({
    id,
    parentId: null,
    name,
    kind: 'file' as const,
    bytes: new TextEncoder().encode(text),
    deletedAt: null,
  });
  const grade = data.curriculumNodes.find((n) => n.id === exam.gradeNodeId);
  return {
    id: crypto.randomUUID(),
    title: exam.title,
    grade: grade ? String(Number(grade.code) + 10) : 'Khác',
    category: 'exam',
    year: String(new Date().getFullYear()),
    mainId,
    engine: 'xelatex',
    revision: 0,
    updatedAt: new Date().toISOString(),
    nodes: [
      node(mainId, 'main.tex', prepared.document),
      node(crypto.randomUUID(), 'question.tex', prepared.question),
    ],
  };
}

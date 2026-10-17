import { z } from 'zod';
import { type BankSnapshot, type Question, questionTypeSchema, questionLevelSchema } from './model';
import { createExam, seededShuffle } from './exams';
import { exactQuestionSource } from './normalize';

export const matrixRowSchema = z.object({
  id: z.string().min(1).max(100),
  nodeId: z.string().max(100).default(''),
  level: z.union([questionLevelSchema, z.literal('')]).default(''),
  type: z.union([questionTypeSchema, z.literal('')]).default(''),
  count: z.number().int().min(1).max(200),
  // Store points as integer hundredths, avoiding binary floating point accumulation.
  points: z.number().int().min(0).max(10000),
});
export const examMatrixSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1).max(200),
    durationMinutes: z.number().int().min(1).max(1440),
    seed: z.string().trim().min(1).max(100),
    rows: z.array(matrixRowSchema).min(1).max(40),
  })
  .superRefine((value, ctx) => {
    if (value.rows.reduce((n, row) => n + row.count, 0) > 200)
      ctx.addIssue({ code: 'custom', message: 'Mỗi đề tối đa 200 câu.', path: ['rows'] });
    if (new Set(value.rows.map((r) => r.id)).size !== value.rows.length)
      ctx.addIssue({ code: 'custom', message: 'Mã ô ma trận bị trùng.', path: ['rows'] });
  });
export type ExamMatrix = z.infer<typeof examMatrixSchema>;
export interface MatrixPlan {
  specification: ExamMatrix;
  rows: {
    rowId: string;
    questions: Question[];
    available: number;
    missing: number;
    points: number;
  }[];
  totalPoints: number;
  complete: boolean;
  fingerprint: string;
}
export function newExamMatrix(): ExamMatrix {
  return {
    version: 1,
    title: 'Đề kiểm tra',
    durationMinutes: 45,
    seed: crypto.randomUUID(),
    rows: [{ id: crypto.randomUUID(), nodeId: '', level: 'N', type: '', count: 10, points: 100 }],
  };
}
export function planExamMatrix(snapshot: BankSnapshot, input: ExamMatrix): MatrixPlan {
  const specification = examMatrixSchema.parse(input);
  for (const row of specification.rows) {
    if (row.nodeId && !snapshot.curriculumNodes.some((n) => n.id === row.nodeId && !n.archived))
      throw new Error('Mục chương trình trong ma trận không còn khả dụng. Hãy chọn lại.');
  }
  const eligible = snapshot.questions
    .filter((q) => q.status === 'approved' && !q.deletedAt)
    .sort((a, b) => a.id.localeCompare(b.id));
  const keys = new Map(eligible.map((q) => [q.id, exactQuestionSource(q.rawSource)]));
  const pools = specification.rows.map((row) =>
    seededShuffle(
      eligible.filter(
        (q) =>
          (!row.level || q.level === row.level) &&
          (!row.type || q.questionType === row.type) &&
          (!row.nodeId ||
            [q.gradeNodeId, q.domainNodeId, q.chapterNodeId, q.lessonNodeId, q.formNodeId].includes(
              row.nodeId,
            )),
      ),
      `${specification.seed}:${row.id}`,
    ),
  );
  const slots = specification.rows.flatMap((row, rowIndex) =>
    Array.from({ length: row.count }, () => rowIndex),
  );
  const assignment = new Map<number, Question>();
  const owner = new Map<string, number>();
  // Augmenting paths permit broad cells to move aside for overlapping narrow cells.
  // Ownership is per canonical source as well as ID, so duplicate imports cannot repeat in a paper.
  function assign(slot: number, visited: Set<string>): boolean {
    for (const q of pools[slots[slot]]) {
      const key = keys.get(q.id)!;
      if (visited.has(key)) continue;
      visited.add(key);
      const previous = owner.get(key);
      if (previous === undefined || assign(previous, visited)) {
        owner.set(key, slot);
        assignment.set(slot, q);
        return true;
      }
    }
    return false;
  }
  slots
    .map((rowIndex, index) => ({ rowIndex, index }))
    .sort((a, b) => pools[a.rowIndex].length - pools[b.rowIndex].length || a.index - b.index)
    .forEach(({ index }) => assign(index, new Set()));
  const rows = specification.rows.map((row, index) => {
    const questions = slots.flatMap((r, slot) =>
      r === index && assignment.has(slot) ? [assignment.get(slot)!] : [],
    );
    return {
      rowId: row.id,
      questions,
      available: new Set(pools[index].map((q) => keys.get(q.id))).size,
      missing: row.count - questions.length,
      points: row.points,
    };
  });
  return {
    specification,
    rows,
    complete: rows.every((r) => !r.missing),
    totalPoints: rows.reduce((n, r) => n + r.questions.length * r.points, 0),
    fingerprint: JSON.stringify([specification, rows.map((r) => r.questions)]),
  };
}
export function commitMatrixExam(snapshot: BankSnapshot, plan: MatrixPlan) {
  const fresh = planExamMatrix(snapshot, plan.specification);
  if (!fresh.complete)
    throw new Error('Ngân hàng chưa đủ câu cho ma trận. Không thể lưu đề thiếu.');
  if (fresh.fingerprint !== plan.fingerprint)
    throw new Error('Câu hỏi đã thay đổi sau khi xem trước. Hãy tạo lại bản xem trước.');
  const questions = fresh.rows.flatMap((r) => r.questions);
  const created = createExam(
    fresh.specification.title,
    fresh.specification.durationMinutes,
    questions,
    fresh.specification.seed,
  );
  created.exam.matrixJson = JSON.stringify(fresh.specification);
  const points = fresh.rows.flatMap((r) => r.questions.map(() => r.points));
  created.items.forEach((item, index) => {
    item.points = points[index];
    item.locked = true;
  });
  const ids = new Set(questions.map((q) => q.id)),
    now = new Date().toISOString();
  return {
    exam: created.exam,
    snapshot: {
      ...snapshot,
      exams: [...snapshot.exams, created.exam],
      examItems: [...snapshot.examItems, ...created.items],
      questions: snapshot.questions.map((q) =>
        ids.has(q.id) ? { ...q, usageCount: q.usageCount + 1, idLocked: true, updatedAt: now } : q,
      ),
    },
  };
}

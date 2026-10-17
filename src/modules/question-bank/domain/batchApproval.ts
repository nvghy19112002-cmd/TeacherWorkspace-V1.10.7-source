import type { BankSnapshot } from './model';
import { acceptKnttRun } from './kntt';

/** Only the latest proposal for each selected question can be applied in a batch. */
export function pendingKnttRuns(snapshot: BankSnapshot, questionIds: string[]) {
  const selected = new Set(questionIds),
    seen = new Set<string>();
  return snapshot.classificationRuns
    .slice()
    .reverse()
    .filter((run) => {
      if (!selected.has(run.questionId) || seen.has(run.questionId)) return false;
      seen.add(run.questionId);
      return !run.accepted;
    });
}

export function acceptKnttBatch(snapshot: BankSnapshot, questionIds: string[]) {
  let next = snapshot;
  const applied: string[] = [];
  const skipped: { questionId: string; message: string }[] = [];
  const pending = pendingKnttRuns(snapshot, questionIds);
  const byQuestion = new Map(pending.map((run) => [run.questionId, run]));
  for (const id of new Set(questionIds)) {
    const run = byQuestion.get(id);
    if (!run) continue;
    try {
      next = acceptKnttRun(next, run.id);
      applied.push(run.questionId);
    } catch (error) {
      skipped.push({
        questionId: run.questionId,
        message: error instanceof Error ? error.message : 'Chưa đủ điều kiện duyệt.',
      });
    }
  }
  return { snapshot: next, applied, skipped };
}

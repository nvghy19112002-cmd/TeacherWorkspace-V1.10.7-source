import type { BankSnapshot } from './model';
export function rejectClassificationRun(
  snapshot: BankSnapshot,
  id: string,
  reason: string,
): BankSnapshot {
  const run = snapshot.classificationRuns.find((r) => r.id === id);
  if (!run || run.accepted)
    throw new Error('Không thể từ chối đề xuất không tồn tại hoặc đã áp dụng.');
  if (reason.trim().length < 5) throw new Error('Ghi lý do từ chối ít nhất 5 ký tự.');
  const result = JSON.parse(run.resultJson);
  return {
    ...snapshot,
    classificationRuns: snapshot.classificationRuns.map((r) =>
      r.id === id
        ? {
            ...r,
            resultJson: JSON.stringify({
              ...result,
              __teacherRejected: {
                reason: reason.trim().slice(0, 500),
                at: new Date().toISOString(),
              },
            }),
          }
        : r,
    ),
  };
}

import { bankSnapshotSchema, type BankSnapshot } from './model';
export function serializeBankBackup(data: BankSnapshot): string {
  return JSON.stringify(
    { type: 'teacher-workspace-question-bank', version: 1, data: bankSnapshotSchema.parse(data) },
    null,
    2,
  );
}
export function parseBankBackup(text: string): BankSnapshot {
  const value = JSON.parse(text);
  if (value?.type !== 'teacher-workspace-question-bank' || value.version !== 1)
    throw new Error('Không đúng định dạng/phiên bản backup Ngân hàng câu hỏi.');
  return bankSnapshotSchema.parse(value.data);
}
export async function restoreBankSafely(
  current: BankSnapshot,
  incoming: BankSnapshot,
  saveCurrent: (text: string) => Promise<boolean>,
  commit: (snapshot: BankSnapshot) => Promise<void>,
): Promise<boolean> {
  const validated = bankSnapshotSchema.parse(incoming);
  if (!(await saveCurrent(serializeBankBackup(current)))) return false;
  await commit(validated);
  return true;
}

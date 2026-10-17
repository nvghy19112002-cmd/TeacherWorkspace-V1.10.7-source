export type ScanQueueRow = {
  id: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  message: string;
};
export async function runScanQueue(
  ids: string[],
  signal: AbortSignal,
  process: (id: string) => Promise<string | void>,
  onChange: (rows: ScanQueueRow[]) => void,
  fatal: (error: unknown) => boolean = () => false,
) {
  const rows: ScanQueueRow[] = [...new Set(ids)].map((id) => ({
    id,
    status: 'pending',
    message: '',
  }));
  const emit = () => onChange(rows.map((r) => ({ ...r })));
  emit();
  for (const row of rows) {
    if (signal.aborted) break;
    row.status = 'running';
    emit();
    try {
      const skip = await process(row.id);
      if (signal.aborted) {
        row.status = 'pending';
        break;
      }
      row.status = skip ? 'skipped' : 'done';
      row.message = skip ?? '';
    } catch (error) {
      if (signal.aborted) {
        row.status = 'pending';
        break;
      }
      row.status = 'failed';
      row.message = error instanceof Error ? error.message : 'Không phân tích được câu.';
      emit();
      if (fatal(error)) break;
    }
    emit();
  }
  emit();
  return rows;
}

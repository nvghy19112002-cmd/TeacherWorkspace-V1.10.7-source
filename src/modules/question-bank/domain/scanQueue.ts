import { z } from 'zod';
import {
  abortableDelay,
  AiRequestError,
  type RetryNotice,
} from '../../ai-tools/services/requestManager';
export const scanQueueRowSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum([
    'pending',
    'running',
    'retrying',
    'paused',
    'completed',
    'failed',
    'needs_review',
    'cancelled',
  ]),
  message: z.string().max(2000),
  diagnostic: z.string().max(2000).optional(),
  attempt: z.number().int().nonnegative().optional(),
  retryAt: z.string().datetime().optional(),
  skipped: z.boolean().optional(),
});
export type ScanQueueRow = z.infer<typeof scanQueueRowSchema>;
export const scanJobSchema = z.object({
  version: z.literal(1),
  id: z.string().max(100),
  model: z.string().max(100),
  scopeId: z.string().max(100),
  promptFingerprint: z.string().max(200),
  updatedAt: z.string().datetime(),
  rows: z.array(scanQueueRowSchema).max(1000),
});
export type ScanJob = z.infer<typeof scanJobSchema>;
export function restoreScanJob(raw?: string): ScanJob | null {
  if (!raw) return null;
  try {
    const job = scanJobSchema.parse(JSON.parse(raw));
    return {
      ...job,
      rows: job.rows.map((row) =>
        ['running', 'retrying'].includes(row.status)
          ? {
              ...row,
              status: 'paused',
              message: 'Lượt quét trước đã dừng. Có thể tiếp tục sau khi xác nhận.',
            }
          : row,
      ),
    };
  } catch {
    return null;
  }
}
export const resumableRow = (row: ScanQueueRow) =>
  ['pending', 'paused', 'cancelled', 'failed'].includes(row.status);
export async function runScanQueue(
  ids: string[],
  signal: AbortSignal,
  process: (
    id: string,
    notifyRetry: (notice: RetryNotice) => Promise<void>,
  ) => Promise<string | void | { needsReview: boolean }>,
  onChange: (rows: ScanQueueRow[]) => void | Promise<void>,
  fatal: (error: unknown) => boolean = () => false,
  previousRows: ScanQueueRow[] = [],
) {
  const rows: ScanQueueRow[] = [...new Set(ids)].map((id) => ({
    ...previousRows.find((r) => r.id === id),
    id,
    status: 'pending',
    message: '',
  }));
  const emit = () => Promise.resolve(onChange(rows.map((r) => ({ ...r }))));
  const pauseRemaining = () =>
    rows.forEach((r) => {
      if (r.status === 'pending') r.status = 'paused';
    });
  await emit();
  for (const row of rows) {
    if (signal.aborted) {
      pauseRemaining();
      break;
    }
    row.status = 'running';
    await emit();
    try {
      if (row.retryAt && Date.parse(row.retryAt) > Date.now()) {
        row.status = 'retrying';
        row.message = `Đã khôi phục tiến trình. Chờ ${Math.ceil((Date.parse(row.retryAt) - Date.now()) / 1000)} giây theo thời gian cooldown trước khi gửi lại.`;
        await emit();
        await abortableDelay(Math.min(2147483647, Date.parse(row.retryAt) - Date.now()), signal);
        // Never send early even for a cooldown beyond the platform timer range.
        if (Date.parse(row.retryAt) > Date.now())
          throw new AiRequestError(
            'Thời gian chờ provider chưa kết thúc.',
            'rate_limit',
            429,
            Date.parse(row.retryAt) - Date.now(),
          );
        row.status = 'running';
        await emit();
      }
      const outcome = await process(row.id, async (notice) => {
        row.status = 'retrying';
        row.message = notice.message;
        row.attempt = notice.attempt;
        row.retryAt = notice.retryAt;
        row.diagnostic = notice.diagnostic;
        await emit();
      });
      row.status =
        typeof outcome === 'string' || outcome?.needsReview ? 'needs_review' : 'completed';
      row.skipped = typeof outcome === 'string';
      row.message = typeof outcome === 'string' ? outcome : '';
      row.retryAt = undefined;
    } catch (error) {
      if (signal.aborted) {
        row.status = 'cancelled';
        row.message = 'Đã dừng yêu cầu. Kết quả đã lưu trước đó được giữ nguyên.';
        pauseRemaining();
        break;
      }
      row.retryAt =
        error instanceof AiRequestError && error.retryAfterMs > 0
          ? new Date(Date.now() + Math.min(error.retryAfterMs, 86400000 * 365)).toISOString()
          : undefined;
      row.status = 'failed';
      row.message = error instanceof Error ? error.message : 'Không phân tích được câu.';
      row.diagnostic =
        error instanceof Error && 'diagnostic' in error
          ? String(error.diagnostic).slice(0, 2000)
          : undefined;
      await emit();
      if (fatal(error)) {
        pauseRemaining();
        break;
      }
    }
    await emit();
  }
  await emit();
  return rows;
}

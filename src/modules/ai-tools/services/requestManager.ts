export type AiErrorKind =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'service'
  | 'configuration'
  | 'authentication'
  | 'model'
  | 'network'
  | 'invalid_json'
  | 'schema';
export class AiRequestError extends Error {
  constructor(
    message: string,
    public kind: AiErrorKind,
    public status = 0,
    public retryAfterMs = 0,
    public diagnostic = '',
  ) {
    super(message);
  }
  get retryable() {
    return ['timeout', 'rate_limit', 'service', 'network'].includes(this.kind);
  }
  get fatalBatch() {
    return !['invalid_json', 'schema'].includes(this.kind);
  }
}
export interface RetryNotice {
  attempt: number;
  retryAt: string;
  delayMs: number;
  message: string;
  diagnostic: string;
}
export function retryAfterMs(value: string | null | undefined, now = Date.now()): number {
  if (!value?.trim()) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, time - now) : 0;
}
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Đã hủy yêu cầu.', 'AbortError'));
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(new DOMException('Đã hủy yêu cầu.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
export function normalizeAiError(error: unknown): AiRequestError {
  if (error instanceof AiRequestError) return error;
  if (error instanceof DOMException && error.name === 'TimeoutError')
    return new AiRequestError(
      'AI chưa phản hồi trong thời gian cho phép. Tiến trình đã được giữ lại.',
      'timeout',
    );
  if (error instanceof TypeError)
    return new AiRequestError(
      'Không kết nối được AI. Kiểm tra mạng rồi tiếp tục các câu còn lại.',
      'network',
    );
  return new AiRequestError(
    'Phản hồi AI không đúng định dạng. Cần kiểm tra lại câu này.',
    'schema',
  );
}
/** Bounded retries on one credential; never rotate keys to bypass a provider limit. */
export async function managedRequest<T>(
  operation: () => Promise<T>,
  options: {
    signal: AbortSignal;
    onRetry?: (notice: RetryNotice) => void | Promise<void>;
    maxAttempts?: number;
    random?: () => number;
    sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  },
): Promise<T> {
  const attempts = Math.min(5, Math.max(1, options.maxAttempts ?? 4));
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (options.signal.aborted) throw new DOMException('Đã hủy yêu cầu.', 'AbortError');
    try {
      return await operation();
    } catch (cause) {
      if (options.signal.aborted) throw new DOMException('Đã hủy yêu cầu.', 'AbortError');
      const error = normalizeAiError(cause);
      // Longer provider cooldowns pause the job instead of sleeping indefinitely or retrying early.
      if (!error.retryable || attempt === attempts || error.retryAfterMs > 120000) throw error;
      const jitter = 0.5 + (options.random ?? Math.random)();
      const delayMs = Math.max(
        Math.round(Math.min(30000, 1000 * 2 ** (attempt - 1)) * jitter),
        error.retryAfterMs,
      );
      await options.onRetry?.({
        attempt,
        delayMs,
        retryAt: new Date(Date.now() + delayMs).toISOString(),
        message: `${error.kind === 'service' ? 'Gemini đang quá tải.' : error.message} Đã lưu tiến trình. Hệ thống sẽ thử lại trong ${Math.ceil(delayMs / 1000)} giây.`,
        diagnostic:
          error.diagnostic || `kind=${error.kind}; HTTP ${error.status}; attempt=${attempt}`,
      });
      await (options.sleep ?? abortableDelay)(delayMs, options.signal);
    }
  }
  throw new Error('Không có lượt yêu cầu hợp lệ.');
}

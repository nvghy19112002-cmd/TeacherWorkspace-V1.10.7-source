import { redact } from './credentials';
import { AiRequestError, retryAfterMs, type AiErrorKind } from './requestManager';

export class GeminiHttpError extends AiRequestError {
  constructor(
    message: string,
    status: number,
    kind: AiErrorKind = status === 429 ? 'quota' : 'configuration',
    retryAfter = 0,
    diagnostic = '',
  ) {
    super(message, kind, status, retryAfter, diagnostic);
  }
}

/** Keep Google's diagnostic message, but never the credential or an unbounded response. */
export async function geminiHttpError(
  response: Response,
  key: string,
  model = '',
): Promise<GeminiHttpError> {
  let detail = '';
  let exhausted = false;
  let bodyRetry = 0;
  try {
    const body = await response.json();
    if (typeof body?.error?.message === 'string') detail = body.error.message;
    exhausted = /quota.*exhausted|daily|per.?day|billing|limit:\s*0/i.test(detail);
    if (Array.isArray(body?.error?.details)) {
      for (const item of body.error.details) {
        if (
          item?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
          typeof item.retryDelay === 'string' &&
          /^\d+(?:\.\d+)?s$/.test(item.retryDelay)
        )
          bodyRetry = Math.max(bodyRetry, Number(item.retryDelay.slice(0, -1)) * 1000);
      }
    }
  } catch {
    /* Some gateways and test doubles return no JSON body. */
  }
  detail = redact(detail, key)
    .replace(/AIza[A-Za-z0-9_-]+/g, '[KEY]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 800);
  const hints: Record<number, string> = {
    400: 'Yêu cầu hoặc cấu hình JSON không được model hỗ trợ.',
    401: 'API key không hợp lệ.',
    402: 'Tài khoản API cần bổ sung tín dụng.',
    403: 'Key không có quyền, bị chặn hoặc dịch vụ bị giới hạn.',
    404: 'Không tìm thấy model cho key/API này. Tải lại danh sách model.',
    429: 'Hết hạn mức hoặc quá nhiều yêu cầu. Kiểm tra hạn mức của dự án.',
    500: 'Gemini gặp lỗi máy chủ.',
    408: 'Gemini chưa phản hồi trong thời gian cho phép.',
    502: 'Cổng kết nối Gemini tạm thời gặp lỗi.',
    503: 'Gemini đang bận. Thử lại sau.',
    504: 'Gemini xử lý quá thời gian.',
  };
  const status = response.status;
  const retryAfter = Math.max(retryAfterMs(response.headers?.get('Retry-After')), bodyRetry);
  const kind: AiErrorKind =
    status === 429
      ? exhausted || !retryAfter
        ? 'quota'
        : 'rate_limit'
      : status === 408
        ? 'timeout'
        : [500, 502, 503, 504].includes(status)
          ? 'service'
          : [401, 403].includes(status)
            ? 'authentication'
            : status === 404
              ? 'model'
              : 'configuration';
  return new GeminiHttpError(
    hints[status] ?? 'Dịch vụ AI gặp lỗi.',
    status,
    kind,
    retryAfter,
    `HTTP ${status}${model ? ` · ${model}` : ''}${detail ? `: ${detail}` : ''}`,
  );
}

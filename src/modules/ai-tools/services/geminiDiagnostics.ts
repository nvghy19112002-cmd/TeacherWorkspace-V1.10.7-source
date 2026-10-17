import { redact } from './credentials';

export class GeminiHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Keep Google's diagnostic message, but never the credential or an unbounded response. */
export async function geminiHttpError(
  response: Response,
  key: string,
  model = '',
): Promise<GeminiHttpError> {
  let detail = '';
  try {
    const body = await response.json();
    if (typeof body?.error?.message === 'string') detail = body.error.message;
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
    503: 'Gemini đang bận. Thử lại sau.',
    504: 'Gemini xử lý quá thời gian.',
  };
  return new GeminiHttpError(
    `HTTP ${response.status}${model ? ` · ${model}` : ''}: ${hints[response.status] ?? 'Dịch vụ AI gặp lỗi.'}${detail ? ` Chi tiết: ${detail}` : ''}`,
    response.status,
  );
}

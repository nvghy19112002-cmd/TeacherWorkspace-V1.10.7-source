import { managedRequest } from './requestManager';
import { geminiHttpError } from './geminiDiagnostics';
import { z } from 'zod';
import { modelNameSchema, reportSchema, type Report } from '../domain/model';
import { redact } from './credentials';
import {
  isStructuredTextModelCandidate,
  recommendedStructuredTextModels,
  structuredTextModelReason,
} from '../domain/modelCapabilities';
export interface AiRequest {
  model: string;
  key: string;
  system: string;
  input: string;
  signal: AbortSignal;
}
export interface AiProvider {
  id: string;
  generate(request: AiRequest): Promise<Report>;
  testConnection(key: string, signal: AbortSignal): Promise<string[]>;
}
export function httpError(status: number): Error {
  const messages: Record<number, string> = {
    400: 'Yêu cầu hoặc model không được hỗ trợ.',
    401: 'API key không hợp lệ.',
    403: 'API key không có quyền hoặc dịch vụ bị giới hạn.',
    404: 'Không tìm thấy model. Hãy chọn lại model.',
    429: 'Đã hết hạn mức hoặc quá nhiều yêu cầu. Hãy thử lại sau.',
  };
  return new Error(
    messages[status] ?? `Dịch vụ AI gặp lỗi HTTP ${status}. Không có thay đổi nào được áp dụng.`,
  );
}
async function requestJson(
  url: string,
  key: string,
  signal: AbortSignal,
  body?: unknown,
  model = '',
): Promise<unknown> {
  if (!key) throw new Error('Chưa có API key. Hãy mở tab Provider.');
  return managedRequest(
    async () => {
      try {
        const response = await fetch(url, {
          method: body ? 'POST' : 'GET',
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
        });
        if (!response.ok) throw await geminiHttpError(response, key, model);
        const text = await response.text();
        if (text.length > 2000000) throw new Error('Phản hồi AI quá lớn. Hãy chia nhỏ tài liệu.');
        try {
          return JSON.parse(redact(text, key)) as unknown;
        } catch {
          throw new Error('Dịch vụ trả về dữ liệu không hợp lệ.');
        }
      } catch (error) {
        if (signal.aborted) throw new Error('Đã hủy yêu cầu.');
        throw error;
      }
    },
    { signal },
  );
}
const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z.array(
              z.object({ text: z.string().optional(), thought: z.boolean().optional() }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
});
export function parseAiResponse(value: unknown): Report {
  const response = responseSchema.safeParse(value);
  if (!response.success) throw new Error('Phản hồi AI không đúng cấu trúc.');
  const candidate = response.data.candidates?.[0];
  if (!candidate || candidate.finishReason !== 'STOP')
    throw new Error('AI chưa hoàn tất hoặc nội dung bị chặn. Hãy chia nhỏ tài liệu.');
  const text = candidate.content?.parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  try {
    return reportSchema.parse(JSON.parse(text ?? '') as unknown);
  } catch {
    throw new Error('Báo cáo AI không đúng định dạng. Chưa lưu hay áp dụng kết quả.');
  }
}
export const geminiProvider: AiProvider = {
  id: 'gemini',
  async testConnection(key, signal) {
    const models = new Set<string>();
    let token = '';
    const visited = new Set<string>();
    do {
      const value = await requestJson(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' +
          (token ? '&pageToken=' + encodeURIComponent(token) : ''),
        key,
        signal,
      );
      const result = z
        .object({
          models: z
            .array(
              z.object({
                name: z.string(),
                supportedGenerationMethods: z.array(z.string()).optional(),
              }),
            )
            .default([]),
          nextPageToken: z.string().optional(),
        })
        .safeParse(value);
      if (!result.success) throw new Error('Không đọc được danh sách model.');
      for (const m of result.data.models)
        if (
          m.supportedGenerationMethods?.includes('generateContent') &&
          isStructuredTextModelCandidate(m.name.replace(/^models\//, ''))
        )
          models.add(m.name.replace(/^models\//, ''));
      token = result.data.nextPageToken ?? '';
      if (token && visited.has(token)) throw new Error('API lặp trang danh sách model.');
      visited.add(token);
      if (visited.size > 100) throw new Error('Danh sách model quá nhiều trang.');
    } while (token);
    return recommendedStructuredTextModels(models, 5);
  },
  async generate({ model, key, system, input, signal }) {
    const name = modelNameSchema.parse(model);
    const incompatibility = structuredTextModelReason(name);
    if (incompatibility) throw new Error(incompatibility);
    const value = await requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`,
      key,
      signal,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(reportSchema),
        },
      },
      name,
    );
    return parseAiResponse(value);
  },
};

/** A tiny synthetic request verifies structured output without sending a bank question. */
export async function testGeminiModel(
  model: string,
  key: string,
  signal: AbortSignal,
): Promise<void> {
  const name = modelNameSchema.parse(model);
  const incompatibility = structuredTextModelReason(name);
  if (incompatibility) throw new Error(incompatibility);
  const value = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`,
    key,
    signal,
    {
      contents: [{ role: 'user', parts: [{ text: 'Return JSON with ok equal to true.' }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
        },
      },
    },
    name,
  );
  const parsed = responseSchema.parse(value);
  const candidate = parsed.candidates?.[0];
  const text =
    candidate?.content?.parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('') ?? '';
  if (
    candidate?.finishReason !== 'STOP' ||
    !z.object({ ok: z.literal(true) }).safeParse(JSON.parse(text)).success
  )
    throw new Error('Model chưa trả được JSON hợp lệ cho phép thử.');
}

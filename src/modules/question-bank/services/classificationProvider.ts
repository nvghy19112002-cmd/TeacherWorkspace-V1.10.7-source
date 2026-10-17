import { z } from 'zod';
import {
  classificationContext,
  scanPreflight,
  resultPathError,
  resultForSelection,
} from '../domain/classificationContext';
import { modelNameSchema } from '../../ai-tools/domain/model';
import { errorText, useWorkspace } from '../../../app/store';
import { readAiState } from '../../ai-tools/services/state';
import { requestKeys, readKeyPool, saveKeyPool } from '../../ai-tools/domain/keyPool';
import { readKey, redact } from '../../ai-tools/services/credentials';
import { geminiHttpError } from '../../ai-tools/services/geminiDiagnostics';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  classificationResultSchema,
  type ClassificationResult,
} from '../domain/classification';
import type { BankSnapshot, Question } from '../domain/model';

const envelopeSchema = z.object({
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

export class ClassificationRequestError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fatalBatch = false,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Đã hủy', 'AbortError'));
      return;
    }
    const done = () => {
      signal.removeEventListener('abort', cancel);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException('Đã hủy', 'AbortError'));
    };
    signal.addEventListener('abort', cancel, { once: true });
  });
}
export function supportedJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(supportedJsonSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['$schema', 'minLength', 'maxLength'].includes(key))
      .map(([key, v]) => [key, supportedJsonSchema(v)]),
  );
}
async function callGemini(
  model: string,
  key: string,
  input: string,
  signal: AbortSignal,
): Promise<ClassificationResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFICATION_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: supportedJsonSchema(z.toJSONSchema(classificationResultSchema)),
        },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    },
  );
  if (!response.ok)
    throw new ClassificationRequestError(
      (await geminiHttpError(response, key, model)).message,
      response.status,
      [400, 401, 403, 404, 429].includes(response.status),
      Math.min(5000, Math.max(0, Number(response.headers?.get('Retry-After') ?? 0) * 1000)),
    );
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error('Phản hồi AI quá lớn. Hãy thử lại với một câu.');
  const text = redact(raw, key);
  const envelope = envelopeSchema.parse(JSON.parse(text) as unknown);
  const candidate = envelope.candidates?.[0];
  if (!candidate || candidate.finishReason !== 'STOP')
    throw new Error('AI chưa hoàn tất phân loại.');
  const payload =
    candidate.content?.parts
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('') ?? '';
  return classificationResultSchema.parse(JSON.parse(payload) as unknown);
}

export function promptInput(snapshot: BankSnapshot, question: Question, scopeId = ''): string {
  const context = classificationContext(snapshot, scopeId);
  const nodes = context.nodes.map(({ id, parentId, kind, code, name, description }) => ({
    id,
    parentId,
    kind,
    code,
    name,
    description: description.slice(0, 400),
  }));
  const outcomes = context.learningOutcomes.map(({ id, nodeId, code, content, source }) => ({
    id,
    nodeId,
    code,
    content,
    source,
  }));
  return JSON.stringify({
    curriculum: {
      nodes,
      learningOutcomes: outcomes,
      scopeId,
      lessonsWithoutForms: context.missingLessons.map((n) => n.id),
    },
    visualContext: { renderedImagesProvided: false, tikzIsSourceOnly: true },
    question: {
      rawSource: question.rawSource,
      type: question.questionType,
      answer: question.answer,
      solution: question.solution,
    },
    levelRules: {
      N: 'Nhận diện, nhắc lại, thay trực tiếp',
      H: 'Giải thích, biểu diễn, biến đổi hoặc kết nối đơn giản',
      V: 'Lựa chọn và phối hợp kiến thức để giải quyết tình huống',
      C: 'Tình huống mới, nhiều lớp suy luận hoặc yếu tố ẩn',
    },
  });
}

export async function classifyQuestionOnline(
  snapshot: BankSnapshot,
  question: Question,
  signal: AbortSignal,
  scopeId = '',
): Promise<{ result: ClassificationResult; model: string; keyId: string }> {
  signal.throwIfAborted();
  const preflight = scanPreflight(snapshot, question, scopeId);
  if (preflight) throw new ClassificationRequestError(preflight);
  const settings = useWorkspace.getState().data.settings;
  const model = readAiState(settings.moduleState?.aiTools).model;
  if (!model || !modelNameSchema.safeParse(model).success)
    throw new ClassificationRequestError(
      'Chưa chọn model Gemini hợp lệ trong Cài đặt → API key.',
      0,
      true,
    );
  const pool = readKeyPool(settings.moduleState?.aiKeyPool);
  const keys = requestKeys(pool);
  if (!keys.length) throw new ClassificationRequestError('Chưa có API key đang bật.', 0, true);
  const input = promptInput(snapshot, question, scopeId);
  if (input.length > 600_000)
    throw new ClassificationRequestError(
      'Ngữ cảnh quá lớn. Giới hạn phạm vi hoặc tách câu trước khi quét.',
    );
  let lastError: unknown;
  for (let index = 0; index < keys.length; index += 1) {
    const meta = keys[index];
    try {
      const key = await readKey(meta.id);
      if (!key) throw new Error(`${meta.label}: không đọc được credential.`);
      let result: ClassificationResult | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        signal.throwIfAborted();
        try {
          result = await callGemini(model, key, input, signal);
          break;
        } catch (error) {
          if (signal.aborted) throw new DOMException('Đã hủy quét.', 'AbortError');
          const transient =
            error instanceof TypeError ||
            (error instanceof DOMException && error.name === 'TimeoutError') ||
            (error instanceof ClassificationRequestError &&
              [408, 500, 502, 503, 504].includes(error.status));
          if (!transient) throw error;
          const limit =
            error instanceof ClassificationRequestError &&
            [500, 502, 503, 504].includes(error.status)
              ? 3
              : 2;
          if (attempt >= limit - 1) {
            if (error instanceof TypeError)
              throw new ClassificationRequestError(
                'Không kết nối được Gemini. Kiểm tra mạng rồi thử lại câu lỗi.',
              );
            if (error instanceof DOMException && error.name === 'TimeoutError')
              throw new ClassificationRequestError(
                'Gemini chưa phản hồi trong thời gian cho phép. Thử lại với phạm vi hẹp hơn.',
              );
            throw error;
          }
          await abortableDelay(
            error instanceof ClassificationRequestError
              ? Math.max(800 * 2 ** attempt, error.retryAfter)
              : 800 * 2 ** attempt,
            signal,
          );
        }
      }
      if (!result) throw new Error('AI không trả kết quả.');
      if (result.formId && !resultPathError(snapshot, result)) {
        const canonical = resultForSelection(snapshot, result, result.formId, result.level);
        if (canonical.proposedClassificationCode !== result.proposedClassificationCode)
          result = {
            ...result,
            proposedClassificationCode: canonical.proposedClassificationCode,
            warnings: [
              ...result.warnings,
              'App đã ghép lại mã từ đường dẫn KNTT; cần đối chiếu trước khi duyệt.',
            ].slice(0, 50),
          };
      }
      return { result, model, keyId: meta.id };
    } catch (error) {
      lastError = error;
      const message = errorText(error).toLocaleLowerCase('vi');
      if (signal.aborted) throw new DOMException('Đã hủy quét.', 'AbortError');
      const quota =
        error instanceof ClassificationRequestError
          ? error.status === 429
          : message.includes('hạn mức') || message.includes('quá nhiều');
      if (!quota || !pool.automatic || index === keys.length - 1) throw error;
      await saveKeyPool((current) => ({
        ...current,
        keys: current.keys.map((item) =>
          item.id === meta.id
            ? { ...item, status: 'quota', lastCheckedAt: new Date().toISOString() }
            : item,
        ),
      })).catch(() => undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Không có API key khả dụng.');
}

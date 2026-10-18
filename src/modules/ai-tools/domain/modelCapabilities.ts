import { z } from 'zod';
import { modelNameSchema } from './model';

const NON_TEXT_MODEL_SEGMENTS = new Set([
  'aqa',
  'audio',
  'embedding',
  'imagen',
  'image',
  'live',
  'speech',
  'tts',
  'veo',
]);

/**
 * The Gemini catalogue may advertise generateContent for models whose output is
 * audio, images, or a live stream. Those models cannot satisfy our JSON schema.
 */
export function structuredTextModelReason(model: string): string | null {
  const parsed = modelNameSchema.safeParse(model);
  if (!parsed.success) return 'Tên model không hợp lệ.';
  const segments = parsed.data.toLocaleLowerCase('en').split(/[-_.]+/);
  const unsupported = segments.find((segment) => NON_TEXT_MODEL_SEGMENTS.has(segment));
  return unsupported
    ? `Model ${parsed.data} dành cho ${unsupported.toUpperCase()}, không hỗ trợ kết quả JSON văn bản.`
    : null;
}

export function isStructuredTextModelCandidate(model: string): boolean {
  return structuredTextModelReason(model) === null;
}
export const modelCheckSchema = z.object({
  model: modelNameSchema,
  keyId: z.string().max(100),
  checkedAt: z.string().datetime(),
  structuredOutput: z.boolean(),
});
export const modelChecksSchema = z.array(modelCheckSchema).max(100);
export function readModelChecks(raw?: string) {
  return raw ? modelChecksSchema.parse(JSON.parse(raw)) : [];
}
export function verifiedModel(
  raw: string | undefined,
  model: string,
  keyId: string,
  now = Date.now(),
) {
  return readModelChecks(raw).some(
    (check) =>
      check.model === model &&
      check.keyId === keyId &&
      check.structuredOutput &&
      now - Date.parse(check.checkedAt) >= 0 &&
      now - Date.parse(check.checkedAt) < 30 * 86400000,
  );
}
export const fallbackModelsSchema = z.array(modelNameSchema).max(2);
export function readFallbackModels(raw?: string) {
  return raw ? fallbackModelsSchema.parse(JSON.parse(raw)) : [];
}

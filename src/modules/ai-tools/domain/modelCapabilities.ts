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

/** Keep setup small: show only the newest suitable Pro, Flash and Lite models. */
export function recommendedStructuredTextModels(models: Iterable<string>, limit = 5): string[] {
  const score = (name: string) => {
    const lower = name.toLowerCase();
    const version = /gemini-(\d+)(?:\.(\d+))?/.exec(lower);
    const generation = version ? Number(version[1]) * 1000 + Number(version[2] ?? 0) * 100 : 0;
    const tier = lower.includes('pro')
      ? 70
      : lower.includes('flash-lite')
        ? 30
        : lower.includes('flash')
          ? 50
          : 10;
    const channel = lower.includes('latest')
      ? 25
      : lower.includes('stable')
        ? 15
        : lower.includes('preview') || lower.includes('exp')
          ? -10
          : 20;
    return generation + tier + channel;
  };
  return [...new Set(models)]
    .filter(isStructuredTextModelCandidate)
    .sort(
      (left, right) =>
        score(right) - score(left) || left.localeCompare(right, undefined, { numeric: true }),
    )
    .slice(0, Math.max(0, limit));
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

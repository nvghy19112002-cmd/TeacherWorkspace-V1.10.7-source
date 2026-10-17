import { z } from 'zod';
import { modelNameSchema } from './model';
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

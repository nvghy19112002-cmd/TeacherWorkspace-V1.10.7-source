import { z } from 'zod';
import { CLASSIFICATION_PROMPT_VERSION, CLASSIFICATION_TASK } from './classification';
import { stableHash } from './normalize';

export const promptVersionSchema = z.object({
  id: z.string().max(100),
  name: z.string().trim().min(1).max(100),
  instruction: z.string().trim().max(5000),
  createdAt: z.string().datetime(),
});
export type ClassificationPromptVersion = z.infer<typeof promptVersionSchema>;
export const defaultClassificationPrompt: ClassificationPromptVersion = {
  id: CLASSIFICATION_PROMPT_VERSION,
  name: 'GDPT 2018 · KNTT mặc định',
  instruction: CLASSIFICATION_TASK,
  createdAt: '2026-10-17T00:00:00.000Z',
};
export const promptLibrarySchema = z.object({
  version: z.literal(1),
  activeId: z.string().max(100),
  versions: z.array(promptVersionSchema).max(20),
});
export function readPromptLibrary(raw?: string) {
  const library = raw
    ? promptLibrarySchema.parse(JSON.parse(raw))
    : {
        version: 1 as const,
        activeId: defaultClassificationPrompt.id,
        versions: [],
      };
  // The built-in prompt is immutable and cannot be replaced by imported settings.
  library.versions = library.versions.filter((v) => v.id !== defaultClassificationPrompt.id);
  if (
    ![defaultClassificationPrompt.id, ...library.versions.map((v) => v.id)].includes(
      library.activeId,
    )
  )
    library.activeId = defaultClassificationPrompt.id;
  return library;
}
export function activeClassificationPrompt(raw?: string) {
  const library = readPromptLibrary(raw);
  return library.versions.find((v) => v.id === library.activeId) ?? defaultClassificationPrompt;
}
export function promptFingerprint(prompt: ClassificationPromptVersion) {
  return `${CLASSIFICATION_PROMPT_VERSION}:${stableHash(prompt.instruction)}`;
}
export function addPromptVersion(raw: string | undefined, name: string, instruction: string) {
  const library = readPromptLibrary(raw);
  const version = promptVersionSchema.parse({
    id: crypto.randomUUID(),
    name,
    instruction,
    createdAt: new Date().toISOString(),
  });
  return promptLibrarySchema.parse({
    ...library,
    activeId: version.id,
    versions: [...library.versions, version],
  });
}

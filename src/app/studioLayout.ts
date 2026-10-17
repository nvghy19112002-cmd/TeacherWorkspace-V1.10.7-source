import { z } from 'zod';
import { useWorkspace } from './store';
import { saveModuleSetting } from '../services/moduleSettings';
export const studioLayoutSchema = z.object({
  sidebarExpanded: z.boolean().default(false),
  libraryWidth: z.number().min(170).max(300).default(206),
  readerWidth: z.number().min(300).max(680).default(430),
  startPage: z
    .enum([
      'dashboard',
      'schedule',
      'work',
      'statistics',
      'documents',
      'question-bank',
      'classification',
      'ai-tools',
      'settings',
    ])
    .default('schedule'),
});
export type StudioLayout = z.infer<typeof studioLayoutSchema>;
export function readStudioLayout(raw?: string): StudioLayout {
  try {
    return studioLayoutSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return studioLayoutSchema.parse({});
  }
}
export function saveStudioLayout(patch: Partial<StudioLayout>) {
  const current = readStudioLayout(useWorkspace.getState().data.settings.moduleState?.studioLayout);
  return saveModuleSetting(
    'studioLayout',
    JSON.stringify(studioLayoutSchema.parse({ ...current, ...patch })),
  );
}

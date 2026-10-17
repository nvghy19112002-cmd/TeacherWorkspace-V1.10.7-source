import { useWorkspace } from '../app/store';

let pending = Promise.resolve();
/** Serialize background checkpoints with each other and wait for a foreground settings write. */
export function saveModuleSetting(name: string, value: string): Promise<void> {
  if (value.length > 190000) return Promise.reject(new Error('Dữ liệu tiến trình quá lớn để lưu.'));
  const next = pending
    .catch(() => undefined)
    .then(async () => {
      const deadline = Date.now() + 10000;
      while (useWorkspace.getState().busy && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 20));
      await useWorkspace.getState().commit((s) => ({
        ...s,
        settings: { ...s.settings, moduleState: { ...s.settings.moduleState, [name]: value } },
      }));
    });
  pending = next;
  return next;
}

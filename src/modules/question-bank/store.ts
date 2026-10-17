import { create } from 'zustand';
import { errorText } from '../../app/store';
import { getDriver } from '../../database/driver';
import { bankSnapshotSchema, emptyBankSnapshot, type BankSnapshot } from './domain/model';
import { decodeBank, diffBank } from './database/codec';
import { mergeKntt } from './domain/kntt';
import { mergeMathHubId6 } from './domain/mathhubCurriculum';

interface QuestionBankStore {
  data: BankSnapshot;
  revision: number;
  ready: boolean;
  busy: boolean;
  error: string | null;
  selectedId: string | null;
  checkedIds: string[];
  setChecked: (value: string[] | ((previous: string[]) => string[])) => void;
  initialize: () => Promise<void>;
  commit: (recipe: (current: BankSnapshot) => BankSnapshot) => Promise<void>;
  select: (id: string | null) => void;
}

let startup: Promise<void> | undefined;
export const useQuestionBank = create<QuestionBankStore>((set, get) => ({
  data: emptyBankSnapshot(),
  revision: 0,
  ready: false,
  busy: false,
  error: null,
  selectedId: null,
  checkedIds: [],
  setChecked: (value) =>
    set((s) => ({
      checkedIds: [...new Set(typeof value === 'function' ? value(s.checkedIds) : value)],
    })),
  initialize: async () => {
    startup ??= (async () => {
      set({ error: null });
      try {
        const loaded = await (await getDriver()).loadBank();
        const decoded = decodeBank(loaded.tables);
        const legacy = mergeMathHubId6(decoded.curriculumNodes);
        const seeded = mergeKntt(legacy);
        const merged = seeded.length === legacy.length ? legacy : seeded;
        const data =
          merged === decoded.curriculumNodes ? decoded : { ...decoded, curriculumNodes: merged };
        const revision =
          data === decoded
            ? loaded.revision
            : await (await getDriver()).commitBank(diffBank(decoded, data), loaded.revision);
        set({
          data,
          checkedIds: get().checkedIds.filter((id) =>
            data.questions.some((q) => q.id === id && !q.deletedAt),
          ),
          revision,
          ready: true,
          busy: false,
        });
      } catch (error) {
        set({ error: errorText(error), ready: false, busy: false });
      }
    })();
    await startup;
    startup = undefined;
  },
  commit: async (recipe) => {
    if (get().busy) throw new Error('Ngân hàng đang lưu thay đổi. Vui lòng đợi.');
    set({ busy: true });
    try {
      const before = get().data;
      const proposed = recipe(before);
      const after = bankSnapshotSchema.parse(proposed);
      const mutations = diffBank(before, after, proposed);
      if (mutations.length) {
        const revision = await (await getDriver()).commitBank(mutations, get().revision);
        set({ data: after, revision });
      }
    } finally {
      set({ busy: false });
    }
  },
  select: (selectedId) => set({ selectedId }),
}));

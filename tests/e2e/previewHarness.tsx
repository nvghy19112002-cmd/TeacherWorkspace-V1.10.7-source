import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { QuestionPreview } from '../../src/modules/question-bank/components/QuestionPreview';
export function previewHarness(host: HTMLElement) {
  const root = createRoot(host);
  return {
    show(source: string) {
      flushSync(() => root.render(<QuestionPreview source={source} renderTikz={false} />));
    },
    close() {
      root.unmount();
    },
  };
}

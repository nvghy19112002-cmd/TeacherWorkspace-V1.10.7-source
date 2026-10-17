import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const captured = vi.hoisted(() => [] as string[]);
vi.mock('../src/modules/question-bank/components/TikzPreview', () => ({
  TikzPreview: ({ source }: { source: string }) => {
    captured.push(source);
    return null;
  },
}));
import { QuestionPreview } from '../src/modules/question-bank/components/QuestionPreview';
it('sends the exact TikZ source to the renderer, including formatting and nested math', () => {
  const drawing = String.raw`\begin{tikzpicture}\node {\textbf{A} $\textbf{x}$};\draw(0,0)--(1,1);\end{tikzpicture}`;
  renderToStaticMarkup(
    createElement(QuestionPreview, {
      source: `\\begin{ex}\\textbf{Đề $x=1$}\\immini{Văn bản}{${drawing}}\\end{ex}`,
    }),
  );
  expect(captured).toEqual([drawing]);
});

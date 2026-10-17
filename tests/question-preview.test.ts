import { createElement } from 'react';
import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestionPreview } from '../src/modules/question-bank/components/QuestionPreview';

it('keeps aligned math row breaks and renders heva without KaTeX errors', () => {
  const html = renderToStaticMarkup(
    createElement(QuestionPreview, {
      source: String.raw`\begin{ex}Tìm $\heva{&x=1\\&y=2}$\choiceTF[1t]{\True A}{B}{C}{D}\end{ex}`,
    }),
  );
  expect(html).not.toContain('katex-error');
  expect(html).toContain('katex-mathml');
  expect(html.match(/class="qb-preview-choice /g)).toHaveLength(4);
  expect(html).toContain('a)');
});
it('renders formatted text, lists, inline delimiters and collapsible solutions without TeX', () => {
  const html = renderToStaticMarkup(
    createElement(QuestionPreview, {
      source: String.raw`\begin{ex}\textbf{Giá trị \(x+1\)}\begin{itemize}\item A\item B\end{itemize}\loigiai{\textit{Giải thích.}}\end{ex}`,
    }),
  );
  expect(html).toContain('<strong>');
  expect(html).toContain('katex-mathml');
  expect(html).not.toContain('\\textbf');
  expect(html).not.toContain('\\begin{itemize}');
  expect(html).toContain('<details class="qb-preview-solution" open="">');
});
it('keeps TikZ inline in the text and solution without dumping drawing commands', () => {
  const source = String.raw`\begin{ex}\immini{Đề $x=1$}{\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}}\loigiai{Giải \begin{tikzpicture}\draw (0,0) circle(1);\end{tikzpicture}}\end{ex}`;
  const html = renderToStaticMarkup(createElement(QuestionPreview, { source }));
  expect(html.match(/class="qb-tikz-inline"/g)).toHaveLength(2);
  expect(html).not.toContain('\\draw');
  expect(html).not.toContain('\\immini');
});

it('renders eqnarray with hoac as math rather than exposing the source', () => {
  const source = String.raw`\begin{ex}Đề\loigiai{\begin{eqnarray*}&& AD^2-2\cdot AC\cdot AD\cdot\cos30^{\circ}+AC^2-CD^2=0\\&\Leftrightarrow&\hoac{&AD=\dfrac{9+3\sqrt{13}}{2}\\&AD=\dfrac{9-3\sqrt{13}}{2}\text{ (loại).}}\end{eqnarray*}}\end{ex}`;
  const html = renderToStaticMarkup(createElement(QuestionPreview, { source }));
  expect(html).not.toContain('katex-error');
  expect(html).toContain('katex-display');
  expect(html).not.toContain('\\begin{eqnarray');
});

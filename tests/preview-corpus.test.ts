import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const drawings = vi.hoisted(() => [] as string[]);
vi.mock('../src/modules/question-bank/components/TikzPreview', () => ({
  TikzPreview: ({ source }: { source: string }) => {
    drawings.push(source);
    return createElement('span', { className: 'test-figure' }, 'Hình TikZ');
  },
}));
import { QuestionPreview } from '../src/modules/question-bank/components/QuestionPreview';
import { drawingDeclarations } from '../src/modules/question-bank/domain/previewSource';
import { prepareTikzPreview } from '../src/modules/question-bank/domain/tikzPreview';
import { DEFAULT_TEX_PREVIEW_SETTINGS } from '../src/modules/question-bank/domain/texPreview';
import { parseExTest } from '../src/modules/question-bank/domain/parser';
const corpus = readFileSync(new URL('./data/preview-200.tex', import.meta.url), 'utf8');
it('preserves every question, solution, choice and drawing in the supplied 200-question corpus', () => {
  const parsed = parseExTest(corpus);
  expect(parsed).toHaveLength(200);
  const failures: unknown[] = [];
  const pages = parsed.map((q, i) => {
    const before = drawings.length;
    const html = renderToStaticMarkup(createElement(QuestionPreview, { source: q.rawSource }));
    const errors = [...html.matchAll(/class="katex-error"[^>]*title="([^"]*)"/g)].map((m) => m[1]);
    const expectedFigures = (
      drawingDeclarations(q.rawSource).text.match(/\\begin\{tikzpicture\}/g) ?? []
    ).length;
    if (errors.length || drawings.length - before !== expectedFigures)
      failures.push({ question: i + 1, errors, expectedFigures, actual: drawings.length - before });
    expect(html.match(/class="qb-preview-choice /g)?.length ?? 0).toBe(
      q.questionType === 'multiple_choice' || q.questionType === 'true_false' ? 4 : 0,
    );
    if (q.solution) expect(html).toContain('qb-preview-solution');
    return `<article data-question="${i + 1}"><h2>Câu ${i + 1}</h2>${html}</article>`;
  });
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    'test-results/corpus-drawings.json',
    JSON.stringify(
      drawings.map((source) =>
        prepareTikzPreview(source, '', { ...DEFAULT_TEX_PREVIEW_SETTINGS, engine: 'xelatex' }),
      ),
    ),
  );
  writeFileSync(
    'test-results/corpus-audit.json',
    JSON.stringify({ questions: parsed.length, drawings: drawings.length, failures }, null, 2),
  );
  writeFileSync(
    'test-results/corpus-reader.html',
    `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/app/styles.css"><link rel="stylesheet" href="/src/modules/question-bank/questionBank.css"><link rel="stylesheet" href="/src/modules/question-bank/studio.css"><link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css"><style>body{display:block;background:#edf1f5;padding:24px}article{background:white;max-width:900px;margin:0 auto 24px;padding:24px;border-radius:14px;font-size:16px}h2{font:600 16px system-ui}</style>${pages.join('\n')}`,
  );
  expect(failures).toEqual([]);
  expect(drawings).toHaveLength(238);
});

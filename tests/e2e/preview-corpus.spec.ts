import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
test('all 200 supplied questions render in the browser without leaked TeX or outer overflow', async ({
  page,
}) => {
  const text = readFileSync(new URL('../data/preview-200.tex', import.meta.url), 'utf8');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  const result = await page.evaluate(async (text) => {
    const parserPath = '/src/modules/question-bank/domain/parser.ts',
      harnessPath = '/tests/e2e/previewHarness.tsx';
    const { parseExTest } = await import(parserPath);
    const { previewHarness } = await import(harnessPath);
    const host = document.createElement('div');
    host.className = 'qb-studio corpus-host';
    host.style.cssText =
      'position:fixed;inset:20px auto auto 20px;width:720px;max-height:90vh;overflow:auto;padding:24px;background:white;z-index:9999;font-size:16px;display:block';
    document.body.append(host);
    const reader = previewHarness(host);
    const questions = parseExTest(text);
    const failures: unknown[] = [];
    let formulas = 0,
      tables = 0,
      figures = 0;
    for (let i = 0; i < questions.length; i++) {
      reader.show(questions[i].rawSource);
      const clone = host.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.katex,.qb-preview-drawing').forEach((e) => e.remove());
      const leaked = clone.textContent?.match(/\\[A-Za-z]+/g) ?? [];
      const mathErrors = host.querySelectorAll('.katex-error').length;
      if (leaked.length || mathErrors || host.scrollWidth > host.clientWidth + 2)
        failures.push({
          question: i + 1,
          leaked,
          mathErrors,
          overflow: host.scrollWidth - host.clientWidth,
        });
      formulas += host.querySelectorAll('.katex').length;
      tables += host.querySelectorAll('table').length;
      figures += host.querySelectorAll('.qb-preview-drawing').length;
    }
    reader.show(
      questions.find((q: { rawSource: string }) => q.rawSource.includes('eqnarray'))!.rawSource,
    );
    await document.fonts.ready;
    return { questions: questions.length, formulas, tables, figures, failures };
  }, text);
  expect(result.questions).toBe(200);
  expect(result.tables).toBe(3);
  expect(result.figures).toBe(238);
  expect(result.failures).toEqual([]);
  expect(result.formulas).toBeGreaterThan(1000);
  await page
    .locator('.corpus-host')
    .screenshot({ path: 'test-results/corpus-equations-private.png' });
  expect(errors).toEqual([]);
});

test('rasterizes every compiled figure in the real corpus with the production PDF renderer', async ({
  page,
}) => {
  test.skip(!process.env.CORPUS_TEX_DIR, 'Set CORPUS_TEX_DIR after compiling the supplied corpus');
  test.setTimeout(180000);
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const directory = process.env.CORPUS_TEX_DIR!;
  const items = Array.from({ length: 238 }, (_, i) => i + 1).filter((i) =>
    existsSync(join(directory, String(i).padStart(3, '0'), 'figure.pdf')),
  );
  expect(items).toHaveLength(237);
  await page.route('**/qa/corpus-pdf/*', (route) => {
    const number = new URL(route.request().url()).pathname.split('/').pop()!;
    return route.fulfill({
      json: [...readFileSync(join(directory, number.padStart(3, '0'), 'figure.pdf'))],
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  const result = await page.evaluate(async (items) => {
    const path = '/src/modules/question-bank/services/pdfFigure.ts';
    const { pdfFigure } = await import(path);
    const images: Record<number, { url: string; width: number; height: number }> = {};
    const failures: unknown[] = [];
    for (const i of items) {
      try {
        const data = await (await fetch(`/qa/corpus-pdf/${i}`)).json();
        const image = await pdfFigure(data, new AbortController().signal, `corpus-${i}`);
        if (!image.url.startsWith('data:image/png') || image.width <= 0 || image.height <= 0)
          throw Error('empty image');
        images[i] = image;
      } catch (error) {
        failures.push({ figure: i, error: String(error) });
      }
    }
    (window as unknown as { corpusImages: typeof images }).corpusImages = images;
    return { count: Object.keys(images).length, failures };
  }, items);
  expect(result.failures).toEqual([]);
  expect(result.count).toBe(237);
  const source = readFileSync(new URL('../data/preview-200.tex', import.meta.url), 'utf8');
  await page.evaluate(async (source) => {
    const path = '/tests/e2e/previewHarness.tsx',
      parser = '/src/modules/question-bank/domain/parser.ts';
    const { previewHarness } = await import(path);
    const { parseExTest } = await import(parser);
    const host = document.createElement('div');
    host.className = 'qb-studio corpus-host';
    host.style.cssText =
      'position:fixed;inset:10px auto auto 10px;width:850px;max-height:95vh;overflow:auto;padding:24px;background:white;z-index:9999;font-size:16px;display:block';
    document.body.append(host);
    const reader = previewHarness(host);
    reader.show(parseExTest(source)[4].rawSource);
    const data = (
      window as unknown as {
        corpusImages: Record<number, { url: string; width: number; height: number }>;
      }
    ).corpusImages[6];
    const img = document.createElement('img');
    img.src = data.url;
    img.style.cssText = 'max-width:100%;height:auto;display:block;margin:12px auto';
    host.querySelector('.qb-preview-drawing')!.replaceWith(img);
    await img.decode();
    await document.fonts.ready;
  }, source);
  await page
    .locator('.corpus-host')
    .screenshot({ path: 'test-results/corpus-real-chart-private.png' });
});

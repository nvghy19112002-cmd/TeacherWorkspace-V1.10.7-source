import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('renders real TikZ PDF into an image with no PDF viewer, and uses its cache', async ({
  page,
}) => {
  test.skip(
    spawnSync('pdflatex', ['--version'], { timeout: 5000 }).status !== 0,
    'TeX Live unavailable',
  );
  const root = mkdtempSync(join(tmpdir(), 'teacher-raster-'));
  try {
    writeFileSync(
      join(root, 'figure.tex'),
      String.raw`\documentclass[tikz,border=4pt]{standalone}
\begin{document}\begin{tikzpicture}
\draw[fill=blue!10,draw=blue,thick] (0,0)--(4,0)--(2,2.5)--cycle;
\node[below] at (0,0) {$A$};\node[below] at (4,0) {$B$};\node[above] at (2,2.5) {$C$};
\end{tikzpicture}\end{document}`,
    );
    const result = spawnSync(
      'pdflatex',
      ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'figure.tex'],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const bytes = [...readFileSync(join(root, 'figure.pdf'))];
    await page.goto('/');
    await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
    const rendered = await page.evaluate(async (bytes) => {
      const path = '/src/modules/question-bank/services/pdfFigure.ts';
      const { pdfFigure } = await import(path);
      const first = await pdfFigure(bytes, new AbortController().signal, 'real-tikz-test');
      const again = await pdfFigure(bytes, new AbortController().signal, 'real-tikz-test');
      const image = new Image();
      image.src = first.url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) colored++;
      return {
        png: first.url.startsWith('data:image/png'),
        width: image.naturalWidth,
        height: image.naturalHeight,
        colored,
        cached: first === again,
      };
    }, bytes);
    expect(rendered.png).toBe(true);
    expect(rendered.width).toBeGreaterThan(200);
    expect(rendered.height).toBeGreaterThan(100);
    expect(rendered.colored).toBeGreaterThan(1000);
    expect(rendered.cached).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

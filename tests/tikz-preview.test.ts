import { expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareTikzPreview } from '../src/modules/question-bank/domain/tikzPreview';
import { DEFAULT_TEX_PREVIEW_SETTINGS } from '../src/modules/question-bank/domain/texPreview';

vi.setConfig({ testTimeout: 45000 });
const hasTex = spawnSync('pdflatex', ['--version'], { timeout: 5000 }).status === 0;
it.skipIf(!hasTex)('compiles a standalone-sized inline TikZ figure using real TeX', () => {
  const source = String.raw`\begin{tikzpicture}\draw[->] (0,0)--(2,1) node[right] {$A$};\end{tikzpicture}`;
  const result = prepareTikzPreview(source, '', DEFAULT_TEX_PREVIEW_SETTINGS);
  const root = mkdtempSync(join(tmpdir(), 'teacher-tikz-inline-'));
  try {
    writeFileSync(join(root, 'preview.tex'), result.document);
    writeFileSync(join(root, 'question.tex'), result.question);
    const compile = spawnSync(
      'pdflatex',
      ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'preview.tex'],
      { cwd: root, timeout: 30000, encoding: 'utf8' },
    );
    expect(compile.status, compile.stdout + compile.stderr).toBe(0);
    expect(readFileSync(join(root, 'preview.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
    const info = spawnSync('pdfinfo', [join(root, 'preview.pdf')], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if (info.status === 0) {
      const size = /Page size:\s*([\d.]+) x ([\d.]+)/.exec(info.stdout)!;
      expect(Number(size[1])).toBeLessThan(200);
      expect(Number(size[2])).toBeLessThan(150);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

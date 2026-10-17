import { expect, it, vi } from 'vitest';

// Allow slow real TeX compilation on Windows. Child processes retain a 30 s limit.
vi.setConfig({ testTimeout: 45_000 });
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import {
  prepareTexPreview,
  prepareTexPreviewBatch,
} from '../src/modules/question-bank/domain/texPreview';

// Native TeX fixture is optional on CI; it never substitutes a mock result.
const hasTex = spawnSync('pdflatex', ['--version'], { timeout: 5000 }).status === 0;
const hasXeTex = spawnSync('xelatex', ['--version'], { timeout: 5000 }).status === 0;
it.skipIf(!hasXeTex)(
  'compiles the Vietnamese classroom fixture with choices, true/false, short answer and TikZ',
  () => {
    const work = mkdtempSync(join(tmpdir(), 'teacher vietnamese sample '));
    try {
      const source = readFileSync(
        new URL('../examples/question-bank-smoke.tex', import.meta.url),
        'utf8',
      );
      // Each question is separated as it is by the actual import pipeline.
      const chunks = [...source.matchAll(/\\begin\{ex\}[\s\S]*?\\end\{ex\}/g)].map((m, index) => ({
        id: String(index),
        label: `Câu ${index + 1}`,
        source: m[0],
      }));
      const prepared = prepareTexPreviewBatch(chunks, '', { integrated: true });
      writeFileSync(join(work, 'preview.tex'), prepared.document);
      writeFileSync(join(work, 'question.tex'), prepared.question);
      const compile = spawnSync(
        'xelatex',
        [
          '-no-shell-escape',
          '-interaction=nonstopmode',
          '-halt-on-error',
          '-file-line-error',
          'preview.tex',
        ],
        { cwd: work, timeout: 30000, encoding: 'utf8' },
      );
      expect(compile.status, compile.stdout + compile.stderr).toBe(0);
      expect(readFileSync(join(work, 'preview.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
      expect(chunks).toHaveLength(4);
      expect(compile.stdout).not.toContain('Missing character:');
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
);
it.skipIf(!hasTex)(
  'compiles the generated wrapper with real TikZ and project-relative input',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'teacher tex test '));
    try {
      const project = join(root, 'project');
      const work = join(root, 'temporary');
      mkdirSync(project);
      mkdirSync(work);
      writeFileSync(
        join(project, 'drawing.tex'),
        '\\begin{tikzpicture}\\draw[->] (0,0)--(2,1);\\end{tikzpicture}',
      );
      const raw = String.raw`\begin{ex}
$x^2+1$\input{drawing.tex}
\end{ex}`;
      const result = prepareTexPreview(
        raw,
        String.raw`\documentclass{article}
\usepackage{tikz}
\newenvironment{ex}{\par Question: }{\par}
\begin{document}
This text must not appear.
\end{document}`,
      );
      writeFileSync(join(work, 'preview.tex'), result.document);
      writeFileSync(join(work, 'question.tex'), result.question);
      const compile = spawnSync(
        'pdflatex',
        [
          '-no-shell-escape',
          '-interaction=nonstopmode',
          '-halt-on-error',
          '-file-line-error',
          'preview.tex',
        ],
        {
          cwd: work,
          timeout: 30000,
          env: {
            ...process.env,
            TEXINPUTS: `.${delimiter}${project}//${delimiter}`,
            openout_any: 'p',
          },
          encoding: 'utf8',
        },
      );
      expect(compile.status, compile.stdout + compile.stderr).toBe(0);
      expect(readFileSync(join(work, 'preview.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
      expect(readFileSync(join(work, 'question.tex'), 'utf8')).toBe(raw);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it.skipIf(!hasTex)('compiles the integrated preset without a user main.tex', () => {
  const work = mkdtempSync(join(tmpdir(), 'teacher integrated tex '));
  try {
    const raw = String.raw`\begin{ex}
Preview $x^2+1$.\choice{1}{2}{\True 3}{4}
\begin{tikzpicture}\draw[->] (0,0)--(2,1);\end{tikzpicture}
\loigiai{Test solution.}
\end{ex}`;
    const result = prepareTexPreview(raw, '', { integrated: true });
    writeFileSync(join(work, 'preview.tex'), result.document);
    writeFileSync(join(work, 'question.tex'), result.question);
    const compile = spawnSync(
      'pdflatex',
      [
        '-no-shell-escape',
        '-interaction=nonstopmode',
        '-halt-on-error',
        '-file-line-error',
        'preview.tex',
      ],
      { cwd: work, timeout: 30000, encoding: 'utf8' },
    );
    expect(compile.status, compile.stdout + compile.stderr).toBe(0);
    expect(readFileSync(join(work, 'preview.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

it.skipIf(!hasTex)(
  'compiles immini, itemize and a TikZ drawing together for inline preview',
  () => {
    const work = mkdtempSync(join(tmpdir(), 'teacher complex preview '));
    try {
      const raw = String.raw`\begin{ex}
Question $x^2+1$.
\immini{\begin{itemize}\item First item\item Second item\end{itemize}}{\begin{tikzpicture}\draw[->] (0,0)--(2,1);\end{tikzpicture}}
\loigiai{This is the solution.}
\end{ex}`;
      const prepared = prepareTexPreview(raw, '', { integrated: true });
      writeFileSync(join(work, 'preview.tex'), prepared.document);
      writeFileSync(join(work, 'question.tex'), prepared.question);
      const compile = spawnSync(
        'pdflatex',
        [
          '-no-shell-escape',
          '-interaction=nonstopmode',
          '-halt-on-error',
          '-file-line-error',
          'preview.tex',
        ],
        { cwd: work, timeout: 30000, encoding: 'utf8' },
      );
      expect(compile.status, compile.stdout + compile.stderr).toBe(0);
      expect(readFileSync(join(work, 'preview.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
);

it.skipIf(!hasTex)('compiles two ordered questions with TikZ in one PDF', () => {
  const work = mkdtempSync(join(tmpdir(), 'teacher batch tex '));
  try {
    const result = prepareTexPreviewBatch(
      [
        { id: 'b', label: 'B', source: String.raw`\begin{ex}Question B $x^2$\end{ex}` },
        {
          id: 'a',
          label: 'A',
          source: String.raw`\begin{ex}Question A \begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}\end{ex}`,
        },
      ],
      '',
      { integrated: true },
    );
    writeFileSync(join(work, 'preview.tex'), result.document);
    writeFileSync(join(work, 'question.tex'), result.question);
    const compile = spawnSync(
      'pdflatex',
      [
        '-no-shell-escape',
        '-interaction=nonstopmode',
        '-halt-on-error',
        '-file-line-error',
        'preview.tex',
      ],
      {
        cwd: work,
        timeout: 30000,
        encoding: 'utf8',
      },
    );
    expect(compile.status, compile.stdout + compile.stderr).toBe(0);
    expect(readFileSync(join(work, 'preview.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.ranges.map((row) => row.id)).toEqual(['b', 'a']);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

it.skipIf(!hasTex)(
  'compiles a complete multi-file project with the document vault command arguments',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'teacher document project '));
    try {
      const output = join(root, '.teacher-build');
      mkdirSync(output);
      mkdirSync(join(root, 'chapters'));
      writeFileSync(
        join(root, 'main.tex'),
        String.raw`\documentclass{article}\begin{document}\input{chapters/body.tex}\end{document}`,
      );
      writeFileSync(join(root, 'chapters/body.tex'), 'Project body');
      const run = spawnSync(
        'pdflatex',
        [
          '-no-shell-escape',
          '-interaction=nonstopmode',
          '-halt-on-error',
          '-file-line-error',
          '-jobname=compiled',
          `-output-directory=${output}`,
          'main.tex',
        ],
        {
          cwd: root,
          timeout: 30000,
          encoding: 'utf8',
          env: {
            ...process.env,
            TEXINPUTS: `.${delimiter}${root}//${delimiter}`,
            openout_any: 'p',
          },
        },
      );
      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(readFileSync(join(output, 'compiled.pdf')).subarray(0, 5).toString()).toBe('%PDF-');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

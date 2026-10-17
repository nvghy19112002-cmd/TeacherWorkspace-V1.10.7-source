import { describe, expect, it } from 'vitest';
import { prepareEditedQuestion } from '../src/modules/question-bank/domain/editor';
import {
  orderedQuestions,
  searchText,
  moveSelection,
} from '../src/modules/question-bank/domain/library';
import { mergeMathHubId6 } from '../src/modules/question-bank/domain/mathhubCurriculum';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';
import { createExam, examToLatex } from '../src/modules/question-bank/domain/exams';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { readFileSync } from 'node:fs';

const nodes = mergeMathHubId6([]);
const make = (source: string) => parsedToQuestion(parseExTest(source)[0], '', nodes);

describe('personal LaTeX library editing and output', () => {
  it('imports the Vietnamese classroom fixture with valid ID6 paths and all four answer formats', () => {
    const source = readFileSync(
      new URL('../examples/question-bank-smoke.tex', import.meta.url),
      'utf8',
    );
    const rows = parseExTest(source).map((row) => parsedToQuestion(row, 'smoke.tex', nodes));
    expect(rows).toHaveLength(4);
    expect(rows.map((q) => q.answer)).toEqual(['C', 'Đ – S – Đ – S', 'B', '5']);
    expect(rows.every((q) => q.formNodeId && q.warnings.length === 0)).toBe(true);
  });
  it('re-reads answers and solutions from changed source instead of persisting stale metadata', () => {
    const original = make(String.raw`\begin{ex}%[0C1N1-1]
Q\choice{\True 1}{2}{3}{4}\loigiai{Old}\end{ex}`);
    const source = String.raw`\begin{ex}%[0C1N1-1]
Q\choice{1}{\True 2}{3}{4}\loigiai{New}\end{ex}`;
    const saved = prepareEditedQuestion(
      { ...original, rawSource: source },
      original,
      [original],
      nodes,
    );
    expect(saved.rawSource).toBe(source);
    expect(saved.answer).toBe('B');
    expect(saved.solution).toBe('New');
    expect(saved.id).toBe(original.id);
    expect(saved.displayId).toMatch(/^0C1N1-1-\d+$/);
    expect(saved.formNodeId).toBeTruthy();
  });
  it('clears stale solution metadata when its command is removed', () => {
    const original = make(String.raw`\begin{ex}Q\loigiai{Old}\end{ex}`);
    const saved = prepareEditedQuestion(
      { ...original, rawSource: String.raw`\begin{ex}Q\end{ex}` },
      original,
      [original],
      nodes,
    );
    expect(saved.solution).toBe('');
  });
  it('retains answers and solutions entered outside the source in older banks', () => {
    const previous = {
      ...make(String.raw`\begin{ex}Q\end{ex}`),
      answer: '42',
      solution: 'Lời giải cũ nhập riêng',
    };
    const saved = prepareEditedQuestion(
      { ...previous, tags: ['Ôn tập'] },
      previous,
      [previous],
      nodes,
    );
    expect(saved.answer).toBe('42');
    expect(saved.solution).toBe(previous.solution);
    const edited = prepareEditedQuestion(
      { ...previous, rawSource: String.raw`\begin{ex}New Q\end{ex}` },
      previous,
      [previous],
      nodes,
    );
    expect(edited.answer).toBe('42');
    expect(edited.warnings.join(' ')).toContain('lưu ngoài mã LaTeX');
  });
  it('keeps an authoritative source ID and clears stale links when its branch is unavailable', () => {
    const original = make(String.raw`\begin{ex}%[0C1N1-1]
Old\end{ex}`);
    const source = String.raw`\begin{ex}%[0D1N1-1]
New\end{ex}`;
    const sourceBranch = nodes.find(
      (node) =>
        node.kind === 'domain' && node.code === 'D' && node.parentId === original.gradeNodeId,
    )!;
    const reduced = nodes.filter((node) => node.id !== sourceBranch.id);
    const saved = prepareEditedQuestion(
      { ...original, rawSource: source },
      original,
      [original],
      reduced,
    );
    expect(saved.classificationCode).toBe('0D1N1-1');
    expect(saved.gradeNodeId).toBeNull();
    expect(saved.formNodeId).toBeNull();
    expect(saved.warnings.join(' ')).toContain('chưa có nhánh');
  });
  it('blocks a changed source classification when the existing ID is locked', () => {
    const original = {
      ...make(String.raw`\begin{ex}%[0C1N1-1]
Q\end{ex}`),
      idLocked: true,
    };
    expect(() =>
      prepareEditedQuestion(
        {
          ...original,
          rawSource: String.raw`\begin{ex}%[0C1H1-1]
New\end{ex}`,
        },
        original,
        [original],
        nodes,
      ),
    ).toThrow('khóa');
  });
  it('rejects multiple questions, broken ex blocks and exact duplicates without changing the bank', () => {
    const first = make(String.raw`\begin{ex}First\end{ex}`);
    const draft = make(String.raw`\begin{ex}New\end{ex}`);
    expect(() =>
      prepareEditedQuestion({ ...draft, rawSource: first.rawSource }, undefined, [first], nodes),
    ).toThrow('đã có');
    expect(() =>
      prepareEditedQuestion(
        { ...draft, rawSource: first.rawSource + draft.rawSource },
        undefined,
        [],
        nodes,
      ),
    ).toThrow('một câu');
    expect(() =>
      prepareEditedQuestion({ ...draft, rawSource: String.raw`\begin{ex}Q` }, undefined, [], nodes),
    ).toThrow('chưa đóng');
  });
  it('preserves the selected order in the exam snapshot and LaTeX export even after the bank order changes', () => {
    const a = make(String.raw`\begin{ex}Question AAA\end{ex}`);
    const b = make(String.raw`\begin{ex}Question BBB\end{ex}`);
    const deleted = {
      ...make(String.raw`\begin{ex}Deleted\end{ex}`),
      deletedAt: new Date().toISOString(),
    };
    const ordered = orderedQuestions([b.id, a.id, b.id, deleted.id, 'missing'], [a, deleted, b]);
    expect(ordered.map((q) => q.id)).toEqual([b.id, a.id]);
    const created = createExam('Test', 45, ordered, 'seed');
    const output = examToLatex(
      {
        ...emptyBankSnapshot(),
        questions: [a, b],
        exams: [created.exam],
        examItems: created.items,
      },
      created.exam,
    );
    expect(output.indexOf('Question BBB')).toBeLessThan(output.indexOf('Question AAA'));
  });
  it('moves tray items without mutating input and supports accent-insensitive Vietnamese search', () => {
    const ids = ['a', 'b', 'c'];
    expect(moveSelection(ids, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(moveSelection(ids, 'a', -1)).toBe(ids);
    expect(searchText('Độ dài đường thẳng')).toContain('do dai duong thang');
  });
});

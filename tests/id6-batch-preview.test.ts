import { describe, expect, it } from 'vitest';
import {
  extractSourceIds,
  inspectId6,
  sourceIdCandidates,
} from '../src/modules/question-bank/domain/id6Taxonomy';
import {
  applyParsedMetadata,
  parseExTest,
  parsedToQuestion,
} from '../src/modules/question-bank/domain/parser';
import { mergeMathHubId6 } from '../src/modules/question-bank/domain/mathhubCurriculum';
import { flagSourceIdConflicts } from '../src/modules/question-bank/domain/sourceIdConflicts';
import { prepareTexPreviewBatch } from '../src/modules/question-bank/domain/texPreview';

describe('ID6 import and batch preview', () => {
  it('checks the complete path, level and leaf against the supplied taxonomy', () => {
    expect(inspectId6('0C1N1-1').state).toBe('valid');
    expect(inspectId6('0C1N1-1-001').classificationCode).toBe('0C1N1-1');
    expect(inspectId6('0C1B1-1').state).toBe('invalid');
    expect(inspectId6('0C1N1-999').state).toBe('invalid');
  });
  it('keeps ambiguous source IDs unchanged and warns rather than assigning one', () => {
    const source = String.raw`\begin{ex}%[0C1N1-1]
%[0C1H1-1]
Question \choice{A}{B}{C}{D}
\end{ex}`;
    expect(sourceIdCandidates(source)).toEqual(['0C1N1-1', '0C1H1-1']);
    const parsed = parseExTest(source)[0];
    const question = parsedToQuestion(parsed);
    expect(question.rawSource).toBe(source);
    expect(question.classificationCode).toBe('');
    expect(question.warnings.join(' ')).toContain('nhiều ID');
  });
  it('recognizes the agreed header ID declarations but ignores IDs in solutions', () => {
    const source = String.raw`\begin{ex}[0C1N1-1]
% ID: 0C1N1-1
\label{0C1N1-1}
\maID{0C1N1-1}
Question \choice{A}{B}{C}{D}
\loigiai{\label{0C1H1-1}}\end{ex}`;
    expect(extractSourceIds(source)).toEqual([{ value: '0C1N1-1', origin: 'tham số ex' }]);
    const fromLabel = String.raw`\begin{ex}\label{0C1N1-1} Question\end{ex}`;
    expect(extractSourceIds(fromLabel)).toEqual([{ value: '0C1N1-1', origin: 'nhãn' }]);
    expect(extractSourceIds(String.raw`\begin{ex}\id{0C1N1-1} Q\end{ex}`)[0].origin).toBe(
      'lệnh ID',
    );
    expect(
      extractSourceIds(String.raw`\begin{ex}% Câu 1 [0C1N1-1]
Q\end{ex}`)[0].origin,
    ).toBe('chú thích');
  });
  it('reads a valid ID6 into editor metadata, preserving source and locked IDs', () => {
    const tree = mergeMathHubId6([]);
    const current = parsedToQuestion(parseExTest(String.raw`\begin{ex}Old\end{ex}`)[0], '', tree);
    const parsed = parseExTest(String.raw`\begin{ex}%[0C1N1-1]
New \choice{\True A}{B}{C}{D}\end{ex}`)[0];
    const updated = applyParsedMetadata(current, parsed, tree);
    expect(updated.classificationCode).toBe('0C1N1-1');
    expect(updated.gradeNodeId).toBeTruthy();
    expect(updated.formNodeId).toBeTruthy();
    expect(updated.displayId).toBe('');
    expect(updated.rawSource).toBe(current.rawSource);
    expect(() => applyParsedMetadata({ ...current, idLocked: true }, parsed, tree)).toThrow(
      'đã khóa',
    );
  });
  it('reports a reused complete source ID without treating a shared classification as a duplicate', () => {
    const a = parsedToQuestion(
      parseExTest(String.raw`\begin{ex}%[0C1N1-1-001]
First\end{ex}`)[0],
    );
    const b = parsedToQuestion(
      parseExTest(String.raw`\begin{ex}%[0C1N1-1-001]
Second\end{ex}`)[0],
    );
    const [duplicate] = flagSourceIdConflicts([b], [a]);
    expect(duplicate.warnings.join(' ')).toContain('ID nguồn 0C1N1-1-001 đã xuất hiện');
    expect(duplicate.rawSource).toBe(b.rawSource);
    const sameBranch = parsedToQuestion(
      parseExTest(String.raw`\begin{ex}%[0C1N1-1]
Another\end{ex}`)[0],
    );
    expect(flagSourceIdConflicts([sameBranch], [a])[0].warnings.join(' ')).not.toContain(
      'đã xuất hiện',
    );
  });
  it('makes one PDF input in the order selected and retains original TikZ code', () => {
    const a = String.raw`\begin{ex}A \begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}\end{ex}`;
    const b = String.raw`\begin{ex}B\end{ex}`;
    const batch = prepareTexPreviewBatch(
      [
        { id: 'b', label: 'B', source: b },
        { id: 'a', label: 'A', source: a },
      ],
      '',
      { integrated: true },
    );
    expect(batch.ranges.map((range) => range.id)).toEqual(['b', 'a']);
    expect(batch.question).toContain(`${b}\n\\clearpage\n${a}`);
    expect(batch.document).toContain('\\input{question.tex}');
    expect(() => prepareTexPreviewBatch([], '', { integrated: true })).toThrow();
  });
});

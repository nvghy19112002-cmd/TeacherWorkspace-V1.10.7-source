import { expect, it, vi } from 'vitest';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import {
  serializeBankBackup,
  parseBankBackup,
  restoreBankSafely,
} from '../src/modules/question-bank/domain/backup';
it('preserves deeply nested groups and nested ex environments without dropping trailing questions', () => {
  const source = String.raw`\begin{ex}Outer \loigiai{\textbf{A {B {C}}}}\begin{ex}Inner\end{ex}\end{ex}
\begin {ex}Next\end {ex}`;
  const parsed = parseExTest(source);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].rawSource).toBe(source.slice(0, source.indexOf('\n')));
  expect(parsed[0].warnings.some((w) => w.includes('lồng nhau'))).toBe(true);
  expect(parsed[1].rawSource).toBe(String.raw`\begin {ex}Next\end {ex}`);
  expect(() => parseExTest(String.raw`\begin{ex}Not closed`)).toThrow('chưa đóng');
});
it('requires a saved backup before replacing bank data and preserves the backup verbatim', async () => {
  const current = {
    ...emptyBankSnapshot(),
    questions: [parsedToQuestion(parseExTest('\\begin{ex}Old\\end{ex}')[0])],
  };
  const incoming = {
    ...emptyBankSnapshot(),
    questions: [parsedToQuestion(parseExTest('\\begin{ex}New\\end{ex}')[0])],
  };
  const commit = vi.fn(async () => {});
  expect(await restoreBankSafely(current, incoming, async () => false, commit)).toBe(false);
  expect(commit).not.toHaveBeenCalled();
  let saved = '';
  expect(
    await restoreBankSafely(
      current,
      incoming,
      async (text) => {
        saved = text;
        return true;
      },
      commit,
    ),
  ).toBe(true);
  expect(parseBankBackup(saved)).toEqual(current);
  expect(commit).toHaveBeenCalledWith(incoming);
  expect(parseBankBackup(serializeBankBackup(current))).toEqual(current);
});
it('does not call different mathematical letter cases or escaped percentages exact duplicates', async () => {
  const { findDuplicateCandidates } =
    await import('../src/modules/question-bank/domain/duplicates');
  const first = parsedToQuestion(parseExTest(String.raw`\begin{ex}$A=1$, $50\%$ thuế.\end{ex}`)[0]);
  const second = parsedToQuestion(
    parseExTest(String.raw`\begin{ex}$a=1$, $50\%$ thuế.\end{ex}`)[0],
  );
  expect(findDuplicateCandidates([first, second]).every((r) => r.method !== 'hash')).toBe(true);
});

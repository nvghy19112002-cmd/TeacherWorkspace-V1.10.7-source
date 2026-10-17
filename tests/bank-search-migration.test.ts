import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { expect, it } from 'vitest';
import { initializeSqlite, commitBankSqlite, readBankState } from '../src/database/webSqlite';
import { diffBank, decodeBank } from '../src/modules/question-bank/database/codec';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';
import { searchBankSqlite, ftsExpression } from '../src/modules/question-bank/database/search';

it('migrates a real v2 database without losing any of 200 sources, preserving a restorable pre-migration backup', async () => {
  const SQL = await initSqlJs(),
    old = new SQL.Database();
  old.run(
    readFileSync(new URL('../src/database/migrations/001_initial.sql', import.meta.url), 'utf8'),
  );
  old.run(
    readFileSync(
      new URL('../src/database/migrations/002_question_bank.sql', import.meta.url),
      'utf8',
    ),
  );
  old.run('PRAGMA user_version=2');
  const questions = parseExTest(
    readFileSync(new URL('./data/preview-200.tex', import.meta.url), 'utf8'),
  ).map((q) => parsedToQuestion(q));
  commitBankSqlite(old, diffBank(emptyBankSnapshot(), { ...emptyBankSnapshot(), questions }), 0);
  let backup: Uint8Array | undefined;
  const db = initializeSqlite(SQL, old.export(), (version, bytes) => {
    expect(version).toBe(2);
    backup = bytes;
  });
  expect(db.exec('PRAGMA user_version')[0].values[0][0]).toBe(4);
  const after = decodeBank(readBankState(db).tables);
  expect(after.questions).toHaveLength(200);
  const byId = new Map(after.questions.map((q) => [q.id, q.rawSource]));
  for (const q of questions) expect(byId.get(q.id)).toBe(q.rawSource);
  const restored = new SQL.Database(backup);
  expect(restored.exec('PRAGMA user_version')[0].values[0][0]).toBe(2);
  expect(decodeBank(readBankState(restored).tables).questions).toEqual(
    decodeBank(readBankState(old).tables).questions,
  );
  expect(db.exec('PRAGMA quick_check')[0].values[0][0]).toBe('ok');
  restored.close();
  old.close();
  db.close();
});
it('performs accent-insensitive full-text search and SQL pagination, and updates the index transactionally', async () => {
  const SQL = await initSqlJs(),
    db = initializeSqlite(SQL);
  const questions = Array.from({ length: 65 }, (_, i) =>
    parsedToQuestion(parseExTest(`\\begin{ex}Đạo hàm số ${i}.\\end{ex}`)[0]),
  );
  const before = { ...emptyBankSnapshot(), questions };
  commitBankSqlite(db, diffBank(emptyBankSnapshot(), before), 0);
  const orderedIds = questions.map((q) => q.id).reverse();
  let result = searchBankSqlite(db, { query: 'dao ham', orderedIds, offset: 50, limit: 50 });
  expect(result.total).toBe(65);
  expect(result.pageIds).toEqual(orderedIds.slice(50));
  const after = {
    ...before,
    questions: before.questions.map((q, i) => (i === 0 ? { ...q, rawSource: 'Xác suất' } : q)),
  };
  commitBankSqlite(db, diffBank(before, after), 1);
  result = searchBankSqlite(db, { query: 'dao ham', orderedIds, offset: 0, limit: 50 });
  expect(result.total).toBe(64);
  expect(result.matchedIds).not.toContain(questions[0].id);
  const probability = searchBankSqlite(db, { query: 'xac suat', orderedIds, offset: 0, limit: 50 });
  expect(probability.pageIds).toEqual([questions[0].id]);
  expect(probability.revision).toBe(2);
  db.close();
});
it('parameterizes IDs and sanitizes full-text operators rather than executing user query syntax', async () => {
  const SQL = await initSqlJs(),
    db = initializeSqlite(SQL);
  expect(ftsExpression('" OR *; DROP TABLE questions; --')).toBe(
    '"or*" AND "drop*" AND "table*" AND "questions*"',
  );
  expect(
    searchBankSqlite(db, {
      query: '" OR *; DROP TABLE questions; --',
      orderedIds: ["' OR 1=1 --"],
      limit: 50,
      offset: 0,
    }).total,
  ).toBe(0);
  expect(db.exec('SELECT count(*) FROM questions')[0].values[0][0]).toBe(0);
  db.close();
});
it('persists assets, normalized tags and import jobs in the same revision as question changes', async () => {
  const { withBankMetadata } = await import('../src/modules/question-bank/domain/bankMetadata');
  const SQL = await initSqlJs(),
    db = initializeSqlite(SQL);
  const q = parsedToQuestion(
    parseExTest(String.raw`\begin{ex}Hình \includegraphics{images/triangle.png}\end{ex}`)[0],
  );
  q.tags = ['Hình học'];
  const now = new Date().toISOString();
  const data = withBankMetadata({
    ...emptyBankSnapshot(),
    questions: [q],
    importJobs: [
      {
        id: 'import-one',
        sourceName: 'sample.tex',
        status: 'committed',
        totalCount: 1,
        importedCount: 1,
        errorJson: '[]',
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  expect(data.assets[0]).toMatchObject({
    questionId: q.id,
    relativePath: 'images/triangle.png',
    missing: true,
    checksum: '',
  });
  expect(withBankMetadata(data, data)).toBe(data);
  commitBankSqlite(db, diffBank(emptyBankSnapshot(), data), 0);
  expect(decodeBank(readBankState(db).tables)).toEqual(data);
  expect(db.exec('SELECT count(*) FROM question_tag_links')[0].values[0][0]).toBe(1);
  const edited = { ...data, questions: [{ ...q, tags: [] }] };
  commitBankSqlite(db, diffBank(data, edited), 1);
  expect(db.exec('SELECT count(*) FROM question_tag_links')[0].values[0][0]).toBe(0);
  expect(decodeBank(readBankState(db).tables).assets[0].missing).toBe(true);
  db.close();
});

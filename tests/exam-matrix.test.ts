import { expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import {
  newExamMatrix,
  planExamMatrix,
  commitMatrixExam,
} from '../src/modules/question-bank/domain/examMatrix';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';
import { examToLatex } from '../src/modules/question-bank/domain/exams';
import { initializeSqlite, commitBankSqlite, readBankState } from '../src/database/webSqlite';
import { decodeBank, diffBank } from '../src/modules/question-bank/database/codec';
function fixture() {
  const s = emptyBankSnapshot();
  s.questions = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((text, index) => ({
    ...parsedToQuestion(parseExTest(`\\begin{ex}${text}\\shortans{${index}}\\end{ex}`)[0]),
    status: 'approved' as const,
    level: index < 2 ? ('N' as const) : ('H' as const),
  }));
  const matrix = newExamMatrix();
  matrix.seed = 'reproducible';
  matrix.rows = [
    { ...matrix.rows[0], id: 'broad', level: '', count: 2, points: 250 },
    { ...matrix.rows[0], id: 'narrow', level: 'N', count: 2, points: 125 },
  ];
  return { s, matrix };
}
it('satisfies overlapping cells without duplicates, deterministically even if the input order changes', () => {
  const { s, matrix } = fixture();
  const plan = planExamMatrix(s, matrix);
  expect(plan.complete).toBe(true);
  expect(plan.rows[0].questions.every((q) => q.level === 'H')).toBe(true);
  expect(plan.rows[1].questions.every((q) => q.level === 'N')).toBe(true);
  expect(new Set(plan.rows.flatMap((r) => r.questions.map((q) => q.id))).size).toBe(4);
  expect(plan.totalPoints).toBe(750);
  expect(planExamMatrix({ ...s, questions: [...s.questions].reverse() }, matrix).fingerprint).toBe(
    plan.fingerprint,
  );
});
it('reports actual shortages and rejects invalid specs and unknown curriculum nodes', () => {
  const { s, matrix } = fixture();
  matrix.rows[1].count = 3;
  const plan = planExamMatrix(s, matrix);
  expect(plan.complete).toBe(false);
  expect(plan.rows.reduce((n, r) => n + r.missing, 0)).toBe(1);
  expect(() => commitMatrixExam(s, plan)).toThrow('chưa đủ');
  matrix.rows[0].count = 201;
  expect(() => planExamMatrix(s, matrix)).toThrow();
  matrix.rows[0].count = 2;
  matrix.rows[0].nodeId = 'missing';
  expect(() => planExamMatrix(s, matrix)).toThrow('không còn khả dụng');
});
it('does not count unapproved, deleted or duplicated imports as additional paper questions', () => {
  const { s, matrix } = fixture();
  s.questions[0].status = 'draft';
  s.questions[1].deletedAt = s.questions[1].updatedAt;
  s.questions.push({ ...s.questions[2], id: 'duplicate' });
  matrix.rows = [{ ...matrix.rows[0], count: 3 }];
  const plan = planExamMatrix(s, matrix);
  expect(plan.rows[0].questions).toHaveLength(2);
  expect(plan.complete).toBe(false);
});
it('commits immutable source/answer/points snapshots and refuses a stale preview', () => {
  const { s, matrix } = fixture();
  const before = JSON.stringify(s),
    plan = planExamMatrix(s, matrix);
  const result = commitMatrixExam(s, plan);
  expect(JSON.stringify(s)).toBe(before);
  expect(result.snapshot.questions.map((q) => q.rawSource)).toEqual(
    s.questions.map((q) => q.rawSource),
  );
  expect(result.snapshot.questions.every((q) => q.usageCount === 1 && q.idLocked)).toBe(true);
  expect(result.snapshot.examItems.map((i) => i.points)).toEqual([250, 250, 125, 125]);
  const latex = examToLatex(result.snapshot, result.exam);
  result.snapshot.questions[0].rawSource = 'edited later';
  expect(examToLatex(result.snapshot, result.exam)).toBe(latex);
  expect(latex).toContain('Alpha');
  expect(latex).toContain('ĐÁP ÁN');
  s.questions[0].answer = 'teacher correction';
  expect(() => commitMatrixExam(s, plan)).toThrow('đã thay đổi');
});
it('upgrades v3 exams with a restorable backup and persists matrix/points across a database reopen', async () => {
  const SQL = await initSqlJs(),
    old = new SQL.Database();
  for (const file of ['001_initial', '002_question_bank', '003_question_search'])
    old.run(
      readFileSync(new URL(`../src/database/migrations/${file}.sql`, import.meta.url), 'utf8'),
    );
  old.run('PRAGMA user_version=3');
  old.run(
    "INSERT INTO exams(id,title,duration_minutes,status,seed,created_at,updated_at) VALUES('legacy','Legacy exam',45,'draft','old','2026-10-17T00:00:00.000Z','2026-10-17T00:00:00.000Z')",
  );
  let backup: Uint8Array | undefined;
  const db = initializeSqlite(SQL, old.export(), (_, bytes) => {
    backup = bytes;
  });
  const legacy = decodeBank(readBankState(db).tables);
  expect(legacy.exams[0].matrixJson).toBe('');
  const restored = new SQL.Database(backup);
  expect(restored.exec('PRAGMA user_version')[0].values[0][0]).toBe(3);
  expect(restored.exec('SELECT title FROM exams')[0].values[0][0]).toBe('Legacy exam');
  const { s, matrix } = fixture(),
    result = commitMatrixExam(s, planExamMatrix(s, matrix));
  commitBankSqlite(db, diffBank(legacy, result.snapshot), 0);
  const reopened = initializeSqlite(SQL, db.export());
  const loaded = decodeBank(readBankState(reopened).tables);
  expect(loaded.exams[0].matrixJson).toBe(JSON.stringify(matrix));
  expect(loaded.examItems.map((i) => i.points).sort()).toEqual([125, 125, 250, 250]);
  expect(examToLatex(loaded, loaded.exams[0])).toBe(examToLatex(result.snapshot, result.exam));
  reopened.close();
  restored.close();
  db.close();
  old.close();
});

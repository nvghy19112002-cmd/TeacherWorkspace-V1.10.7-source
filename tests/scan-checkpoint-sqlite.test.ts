import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { expect, it } from 'vitest';
import {
  initializeSqlite,
  commitSqlite,
  commitBankSqlite,
  readState,
  readBankState,
} from '../src/database/webSqlite';
import { diff, decode } from '../src/database/codec';
import { diffBank, decodeBank } from '../src/modules/question-bank/database/codec';
import { emptySnapshot } from '../src/modules/schedule/domain/model';
import { emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';
import { restoreScanJob } from '../src/modules/question-bank/domain/scanQueue';
import { fixture } from './fixtures';
it('backups and reopens all 200 original sources together with a durable scan checkpoint', async () => {
  const SQL = await initSqlJs(),
    db = initializeSqlite(SQL);
  const corpus = readFileSync(new URL('./data/preview-200.tex', import.meta.url), 'utf8');
  const questions = parseExTest(corpus).map((q) => parsedToQuestion(q));
  expect(questions).toHaveLength(200);
  const job = {
    version: 1,
    id: 'job-200',
    model: 'test',
    scopeId: '',
    promptFingerprint: 'v2',
    updatedAt: new Date().toISOString(),
    rows: questions.map((q, i) => ({
      id: q.id,
      status: i < 36 ? 'completed' : i === 36 ? 'running' : 'pending',
      message: '',
    })),
  };
  const workspace = fixture();
  workspace.settings.moduleState = {
    ...workspace.settings.moduleState,
    classificationJob: JSON.stringify(job),
  };
  commitSqlite(db, diff(emptySnapshot(), workspace), 0);
  commitBankSqlite(db, diffBank(emptyBankSnapshot(), { ...emptyBankSnapshot(), questions }), 0);
  const bytes = db.export();
  db.close();
  const restored = initializeSqlite(SQL, bytes);
  const reopened = decodeBank(readBankState(restored).tables);
  expect(reopened.questions).toHaveLength(200);
  const byId = new Map(reopened.questions.map((q) => [q.id, q.rawSource]));
  for (const q of questions) expect(byId.get(q.id)).toBe(q.rawSource);
  const savedJob = restoreScanJob(
    decode(readState(restored).tables).settings.moduleState?.classificationJob,
  )!;
  expect(savedJob.rows.filter((r) => r.status === 'completed')).toHaveLength(36);
  expect(savedJob.rows[36].status).toBe('paused');
  expect(restored.exec('PRAGMA quick_check')[0].values[0][0]).toBe('ok');
  restored.close();
});

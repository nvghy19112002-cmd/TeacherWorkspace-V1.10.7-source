import { z } from 'zod';
import type { Database } from 'sql.js';
import { searchText } from '../domain/library';
export const bankSearchSchema = z
  .object({
    orderedIds: z.array(z.string().min(1).max(100)).max(100000),
    query: z.string().max(1000),
    limit: z.number().int().min(1).max(200),
    offset: z.number().int().min(0).max(100000),
  })
  .refine(
    (q) => new Set(q.orderedIds).size === q.orderedIds.length,
    'Danh sách câu tìm kiếm có ID trùng.',
  );
export type BankSearchRequest = z.infer<typeof bankSearchSchema>;
export interface BankSearchResult {
  revision: number;
  total: number;
  matchedIds: string[];
  pageIds: string[];
}
export function ftsExpression(query: string): string {
  const words = searchText(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length > 20 || words.some((w) => w.length > 100))
    throw new Error('Hãy tìm bằng tối đa 20 từ, mỗi từ không quá 100 ký tự.');
  return words.map((w) => `"${w}*"`).join(' AND ');
}
export const BANK_SEARCH_SQL = `SELECT q.id FROM questions q JOIN json_each(?) AS selected ON selected.value=q.id WHERE q.deleted_at IS NULL`;
export function searchBankSqlite(db: Database, input: BankSearchRequest): BankSearchResult {
  const request = bankSearchSchema.parse(input),
    expression = ftsExpression(request.query);
  const where = expression
    ? ' AND q.rowid IN (SELECT docid FROM question_search WHERE question_search MATCH ?)'
    : '';
  const ordered = `${BANK_SEARCH_SQL}${where} ORDER BY CAST(selected.key AS INTEGER)`;
  const params = [JSON.stringify(request.orderedIds), ...(expression ? [expression] : [])];
  const matchedIds = (db.exec(ordered, params)[0]?.values ?? []).map((r) => String(r[0]));
  const pageIds = (
    db.exec(ordered + ' LIMIT ? OFFSET ?', [...params, request.limit, request.offset])[0]?.values ??
    []
  ).map((r) => String(r[0]));
  return {
    revision: Number(db.exec('SELECT revision FROM question_bank_meta WHERE id=1')[0].values[0][0]),
    total: matchedIds.length,
    matchedIds,
    pageIds,
  };
}

import { expect, it } from 'vitest';
import original from '../src/modules/question-bank/data/id6-thcs-thpt.json';
import thpt from '../src/modules/question-bank/data/mathhub/ID6-thpt-TOAN-VA-LATEX.json';
import knttPrimary from '../src/modules/question-bank/data/mathhub/TOAN-1-5-KNTT.json';
import knttSecondary from '../src/modules/question-bank/data/mathhub/TOAN-6-12-KNTT.json';
import btpro from '../src/modules/question-bank/data/mathhub/ID-BTpro.json';
import { id6NodePath, mergeMathHubId6 } from '../src/modules/question-bank/domain/mathhubCurriculum';
import { createKnttMath1011Curriculum } from '../src/modules/question-bank/domain/knttMath1011';
import { bankSnapshotSchema, emptyBankSnapshot } from '../src/modules/question-bank/domain/model';
import { requiresTexLivePreview } from '../src/modules/question-bank/domain/texPreview';
import { parseExTest, parsedToQuestion } from '../src/modules/question-bank/domain/parser';

function count(nodes: { children?: unknown[] }[]): number {
  return nodes.reduce((n, node) => n + 1 + count((node.children ?? []) as { children?: unknown[] }[]), 0);
}

it('ships every node from each of the five supplied MathHub exports', () => {
  expect([original, thpt, knttPrimary, knttSecondary, btpro].map((tree) => count(tree.nodes)))
    .toEqual([875, 671, 86, 308, 2888]);
  const tree = mergeMathHubId6([], '2026-09-21T00:00:00.000Z');
  expect(tree).toHaveLength(875);
  expect(tree.filter((node) => node.kind === 'grade').map((node) => node.code))
    .toEqual(['0', '1', '2', '6', '7', '8', '9']);
  expect(tree.find((node) => node.name === 'Mệnh đề')?.code).toBe('1');
  expect(() => bankSnapshotSchema.parse({ ...emptyBankSnapshot(), curriculumNodes: tree })).not.toThrow();
});

it('adds missing branches to an existing bank without rewriting linked or edited nodes', () => {
  const current = createKnttMath1011Curriculum('2026-09-12T00:00:00.000Z');
  const edited = { ...current[0], name: 'Lớp 10 của tôi' };
  const before = [edited, ...current.slice(1)];
  const result = mergeMathHubId6(before, '2026-09-21T00:00:00.000Z');
  expect(result.find((node) => node.id === edited.id)).toBe(edited);
  expect(result.some((node) => node.kind === 'form')).toBe(true);
  expect(result.filter((node) => node.kind === 'grade' && node.code === '0')).toHaveLength(1);
  expect(mergeMathHubId6(result)).toBe(result);
  expect(() => bankSnapshotSchema.parse({ ...emptyBankSnapshot(), curriculumNodes: result })).not.toThrow();
});

it('connects imported ID6 questions to filters and resolves old unlinked IDs without rewriting them', () => {
  const tree = mergeMathHubId6([]);
  const path = id6NodePath('0D1N1-1', tree);
  expect(path).not.toBeNull();
  const source = String.raw`\begin{ex}%[0D1N1-1]
Question\choice{\True A}{B}{C}{D}\end{ex}`;
  const parsed = parseExTest(source)[0];
  const imported = parsedToQuestion(parsed, 'question.tex', tree);
  expect(imported.classificationCode).toBe('0D1N1-1');
  expect(imported.formNodeId).toBe(path?.formNodeId);
  expect(imported.warnings.join(' ')).not.toContain('cần bổ sung cây');
  const original = parsedToQuestion(parsed);
  expect(original.formNodeId).toBeNull();
  expect(id6NodePath(original.classificationCode, tree)).toEqual(path);
});

it('sends LaTeX layouts and drawings to TeX Live while keeping simple math fast', () => {
  expect(requiresTexLivePreview(String.raw`\begin{ex}$x^2$\choice{A}{B}{C}{D}\end{ex}`)).toBe(false);
  expect(requiresTexLivePreview(String.raw`\immini{Text}{\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}}`)).toBe(true);
  expect(requiresTexLivePreview(String.raw`\begin{itemize}\item Test\end{itemize}`)).toBe(true);
  expect(requiresTexLivePreview(String.raw`\myCustomDrawing{A}`)).toBe(true);
});

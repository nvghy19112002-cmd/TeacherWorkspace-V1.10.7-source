import { expect, it } from 'vitest';
import { visibleCurriculumRows } from '../src/modules/question-bank/domain/curriculumView';
import { mergeMathHubId6 } from '../src/modules/question-bank/domain/mathhubCurriculum';

it('collapses the large ID6 tree and reveals matching branches with their ancestors', () => {
  const nodes = mergeMathHubId6([]);
  const roots = visibleCurriculumRows(nodes, new Set());
  expect(roots.map(({ node }) => node.code)).toEqual(['0', '1', '2', '6', '7', '8', '9']);
  const gradeSix = roots.find(({ node }) => node.code === '6')!.node;
  expect(visibleCurriculumRows(nodes, new Set([gradeSix.id])).length).toBeGreaterThan(roots.length);
  const searched = visibleCurriculumRows(nodes, new Set(), 'Mệnh đề');
  expect(searched.some(({ node }) => node.name === 'Mệnh đề')).toBe(true);
  expect(searched.some(({ node }) => node.kind === 'grade')).toBe(true);
  expect(searched.length).toBeLessThan(nodes.length);
});

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('matrix builder reports shortages, saves immutable snapshots and reexports after edits', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-studio-header')).toBeVisible();
  const originals = await page.evaluate(async () => {
    const path = '/src/modules/question-bank/store.ts',
      parser = '/src/modules/question-bank/domain/parser.ts';
    const { useQuestionBank } = await import(path),
      { parseExTest, parsedToQuestion } = await import(parser);
    const questions = ['Matrix Alpha', 'Matrix Beta', 'Matrix Gamma', 'Matrix Delta'].map(
      (text, index) => ({
        ...parsedToQuestion(parseExTest(`\\begin{ex}${text} $1+1$.\\shortans{2}\\end{ex}`)[0]),
        status: 'approved',
        level: index < 2 ? 'N' : 'H',
      }),
    );
    await useQuestionBank.getState().commit((s: Record<string, unknown>) => ({ ...s, questions }));
    return questions.map((q) => q.rawSource);
  });
  await page.getByRole('button', { name: 'Tạo đề', exact: true }).click();
  await page.getByLabel('Tên đề', { exact: true }).fill('Đề ma trận kiểm thử');
  await page.getByRole('button', { name: 'Kiểm tra và xem trước', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ma trận thiếu câu', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Lưu đề và khóa snapshot', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Số câu ô 1', { exact: true }).fill('2');
  await page.getByLabel('Điểm mỗi câu ô 1', { exact: true }).fill('2.5');
  await page.getByRole('button', { name: 'Thêm ô ma trận', exact: true }).click();
  await page.getByLabel('Mức độ ô 2', { exact: true }).selectOption('H');
  await page.getByLabel('Số câu ô 2', { exact: true }).fill('2');
  await page.getByLabel('Điểm mỗi câu ô 2', { exact: true }).fill('2.5');
  await page.getByRole('button', { name: 'Lưu nháp ma trận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lưu nháp ma trận', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra và xem trước', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ma trận đủ câu', exact: true })).toBeVisible();
  await expect(page.getByLabel('Kết quả ma trận', { exact: true })).toContainText(
    '4 câu được chọn · 10.00 điểm',
  );
  await page.screenshot({ path: 'test-results/studio-matrix-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Lưu đề và khóa snapshot', exact: true }).click();
  const saved = page.getByLabel('Đề đã lưu', { exact: true });
  await expect(saved).toContainText('Đề ma trận kiểm thử');
  await page.reload();
  await page.getByRole('button', { name: 'Tạo đề', exact: true }).click();
  await expect(page.getByLabel('Tên đề', { exact: true })).toHaveValue('Đề ma trận kiểm thử');
  const status = await page.evaluate(async () => {
    const path = '/src/modules/question-bank/store.ts',
      { useQuestionBank } = await import(path);
    const bank = useQuestionBank.getState();
    const result = {
      sources: bank.data.questions.map((q: { rawSource: string }) => q.rawSource),
      points: bank.data.examItems.map((item: { points: number }) => item.points),
      locked: bank.data.questions.every(
        (q: { idLocked: boolean; usageCount: number }) => q.idLocked && q.usageCount === 1,
      ),
    };
    await bank.commit((s: { questions: { rawSource: string }[] }) => ({
      ...s,
      questions: s.questions.map((q, index) =>
        index === 0 ? { ...q, rawSource: 'changed after snapshot' } : q,
      ),
    }));
    return result;
  });
  expect(status.sources.sort()).toEqual(originals.sort());
  expect(status.points).toEqual([250, 250, 250, 250]);
  expect(status.locked).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await saved.getByRole('button', { name: 'Xuất .tex', exact: true }).click();
  const download = await downloadPromise,
    path = await download.path();
  const exported = readFileSync(path!, 'utf8');
  for (const source of originals) expect(exported).toContain(source);
  expect(exported).not.toContain('changed after snapshot');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(async () => {
    const path = '/src/app/store.ts',
      { useWorkspace } = await import(path);
    await useWorkspace
      .getState()
      .commit((s: { settings: Record<string, unknown> }) => ({
        ...s,
        settings: { ...s.settings, theme: 'dark' },
      }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/studio-matrix-dark-1024.png', fullPage: true });
});

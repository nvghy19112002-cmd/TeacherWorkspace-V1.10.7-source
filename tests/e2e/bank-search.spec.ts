import { test, expect } from '@playwright/test';
test('SQLite search and pagination preserve Vietnamese search and page boundaries', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-studio-header')).toBeVisible();
  await page.evaluate(async () => {
    const bankPath = '/src/modules/question-bank/store.ts',
      parserPath = '/src/modules/question-bank/domain/parser.ts';
    const { useQuestionBank } = await import(bankPath),
      { parseExTest, parsedToQuestion } = await import(parserPath);
    const questions = Array.from({ length: 65 }, (_, i) =>
      parsedToQuestion(parseExTest(`\\begin{ex}Đạo hàm câu ${i + 1}.\\end{ex}`)[0]),
    );
    await useQuestionBank.getState().commit((s: Record<string, unknown>) => ({ ...s, questions }));
  });
  await expect(page.locator('.qb-question-table')).toHaveAttribute('data-page-row-count', '50');
  const rendered = await page.locator('.qb-question-table tbody tr[data-question-id]').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(50);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.locator('.qb-question-table')).toHaveAttribute('data-page-row-count', '15');
  await page.locator('#qb-content-search').fill('dao ham cau 65');
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.qb-question-table')).toContainText('65');
  await page.locator('#qb-content-search').fill('xac suat');
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(0);
});

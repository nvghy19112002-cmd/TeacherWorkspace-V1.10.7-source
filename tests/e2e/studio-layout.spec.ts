import { expect, test } from '@playwright/test';
test('studio rail and panel widths persist; virtual scrolling reaches the final row', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở rộng điều hướng', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Thu gọn điều hướng', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Thu gọn điều hướng', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thu gọn điều hướng', exact: true }).click();
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-studio-header')).toBeVisible();
  const handle = page.getByRole('separator', { name: 'Điều chỉnh độ rộng khung đọc' });
  await handle.focus();
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await handle.press('ArrowLeft');
  await expect(handle).not.toHaveAttribute('aria-valuenow', String(before));
  const after = await handle.getAttribute('aria-valuenow');
  await page.reload();
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(handle).toHaveAttribute('aria-valuenow', after!);
  await page.evaluate(async () => {
    const store = '/src/modules/question-bank/store.ts',
      parser = '/src/modules/question-bank/domain/parser.ts';
    const { useQuestionBank } = await import(store),
      { parseExTest, parsedToQuestion } = await import(parser);
    await useQuestionBank
      .getState()
      .commit((s: Record<string, unknown>) => ({
        ...s,
        questions: Array.from({ length: 50 }, (_, i) =>
          parsedToQuestion(parseExTest(`\\begin{ex}Virtual sentinel ${i + 1}\\end{ex}`)[0]),
        ),
      }));
  });
  const table = page.locator('.qb-question-table');
  await expect(table).toHaveAttribute('data-page-row-count', '50');
  await table.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event('scroll'));
  });
  await expect(table).toContainText('Virtual sentinel 50');
  await expect(page.locator('.qb-question-table tr[data-question-id]')).not.toHaveCount(50);
  await page.getByRole('button', { name: 'AI phân loại', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'AI phân loại câu hỏi', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Danh sách câu quét AI').selectOption('review');
  await expect(
    page.getByRole('button', { name: 'Quét các câu đã chọn', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/studio-classification.png', fullPage: true });
});

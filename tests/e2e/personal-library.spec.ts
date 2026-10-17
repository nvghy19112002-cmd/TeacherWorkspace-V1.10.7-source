import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const a = String.raw`\begin{ex}%[0C1N1-1]
Đường thẳng Alpha có bao nhiêu điểm?
\choice{\True 1}{2}{3}{4}
\loigiai{Lời giải Alpha.}
\end{ex}`;
const b = String.raw`\begin{ex}%[0C1H1-1]
Tam giác Beta có bao nhiêu cạnh?
\choice{1}{2}{\True 3}{4}
\loigiai{Lời giải Beta.}
\end{ex}`;

test('paste review, accent-insensitive search and persistent LaTeX edits with history', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await page.getByRole('button', { name: 'Dán LaTeX', exact: true }).click();
  const paste = page.getByRole('dialog', { name: 'Dán mã LaTeX', exact: true });
  await paste.getByLabel('Mã LaTeX cần nhập').fill(a + '\n\n' + b);
  await paste.getByRole('button', { name: 'Kiểm tra câu hỏi' }).click();
  const review = page.getByRole('dialog', { name: 'Kiểm tra trước khi nhập', exact: true });
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(0);
  await review.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(2);
  await page.getByLabel('Tìm câu hỏi', { exact: true }).fill('duong thang');
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(1);
  await page.locator('.qb-question-open').click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  const editor = page.getByRole('dialog', { name: /^Sửa / });
  const changed = a
    .replace('{\\True 1}{2}', '{1}{\\True 2}')
    .replace('Lời giải Alpha.', 'Đã sửa lời giải.');
  await editor.getByLabel('Mã LaTeX', { exact: true }).fill(changed);
  await editor.getByLabel('Mã LaTeX', { exact: true }).press('Control+s');
  await expect(editor).not.toBeVisible();
  await expect(page.locator('.qb-preview-answer')).toContainText('B');
  await expect(page.locator('.qb-preview-solution')).toContainText('Đã sửa lời giải.');
  await page.getByRole('button', { name: 'Lịch sử', exact: true }).click();
  await expect(page.locator('.qb-revision-list article')).toHaveCount(1);
  await expect(page.locator('.qb-revision-list article pre')).toContainText('Lời giải Alpha.');
  await page.reload();
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await page.locator('.qb-question-open').filter({ hasText: 'Alpha' }).click();
  await expect(page.locator('.qb-preview-answer')).toContainText('B');
  expect(errors).toEqual([]);
});

test('tray reorder controls preserve exam export order and lock used IDs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await page.locator('.qb-import-button input').setInputFiles({
    name: 'two.tex',
    mimeType: 'text/plain',
    buffer: Buffer.from(a + '\n\n' + b),
  });
  await page
    .getByRole('dialog', { name: 'Kiểm tra trước khi nhập', exact: true })
    .getByRole('button', { name: 'Xác nhận nhập' })
    .click();
  const alpha = page.locator('.qb-question-table tbody tr').filter({ hasText: 'Alpha' });
  const beta = page.locator('.qb-question-table tbody tr').filter({ hasText: 'Beta' });
  await beta.getByRole('checkbox').check();
  await alpha.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Khay câu hỏi/ }).click();
  const tray = page.getByRole('dialog', { name: 'Khay câu hỏi', exact: true });
  await expect(tray.locator('.qb-tray-list article').first()).toContainText('Beta');
  await tray.getByRole('button', { name: 'Đưa câu 2 lên', exact: true }).click();
  await expect(tray.locator('.qb-tray-list article').first()).toContainText('Alpha');
  await tray.getByRole('button', { name: 'Đưa câu 1 xuống', exact: true }).click();
  await tray.getByLabel('Tên đề / phiếu').fill('Phiếu kiểm tra');
  const downloading = page.waitForEvent('download');
  await tray.getByRole('button', { name: 'Tạo đề .tex', exact: true }).click();
  const download = await downloading;
  const tex = await readFile((await download.path())!, 'utf8');
  expect(tex.indexOf('Tam giác Beta')).toBeLessThan(tex.indexOf('Đường thẳng Alpha'));
  expect(tex).toContain(a);
  expect(tex).toContain(b);
  await tray.getByRole('button', { name: 'Đóng', exact: true }).click();
  await alpha.locator('.qb-question-open').click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  const editor = page.getByRole('dialog', { name: /^Sửa / });
  await editor
    .getByLabel('Mã LaTeX', { exact: true })
    .fill(a.replace('Đường thẳng Alpha', 'Đường thẳng Alpha đã chỉnh'));
  await editor.getByRole('button', { name: 'Lưu câu hỏi', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.getByRole('button', { name: 'Đề đã lưu (1)', exact: true }).click();
  const saved = page.getByRole('dialog', { name: 'Đề đã lưu', exact: true });
  await expect(saved).toContainText('Phiếu kiểm tra');
  const again = page.waitForEvent('download');
  await saved.getByRole('button', { name: 'Xuất .tex', exact: true }).click();
  const savedTex = await readFile((await (await again).path())!, 'utf8');
  expect(savedTex).toBe(tex);
  expect(savedTex).not.toContain('Alpha đã chỉnh');
  await saved.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await editor.getByLabel('Mã LaTeX', { exact: true }).fill(a.replace('0C1N1-1', '0C1H1-1'));
  await editor.getByRole('button', { name: 'Lưu câu hỏi', exact: true }).click();
  await expect(page.getByText(/đã khóa vì từng được dùng trong đề/)).toBeVisible();
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Đóng', exact: true }).first().click();
  await editor.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  await page.getByRole('button', { name: 'Đề đã lưu (1)', exact: true }).click();
  await saved.getByRole('button', { name: 'Mở trong Kho đề', exact: true }).click();
  await expect(page.locator('.doc-toolbar')).toContainText('Phiếu kiểm tra');
  await page.locator('.doc-tree button').filter({ hasText: 'question.tex' }).click();
  await expect(page.locator('textarea')).toHaveValue(/Tam giác Beta/);
  await expect(page.locator('textarea')).not.toHaveValue(/Alpha đã chỉnh/);
});

test('unsaved source requires an explicit discard and layout stays inside 1024px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-studio-header')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await page.getByRole('button', { name: 'Thêm câu', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Thêm câu hỏi', exact: true });
  await editor.getByLabel('Mã LaTeX', { exact: true }).fill(a);
  await editor.press('Escape');
  await expect(editor.getByText('Anh còn thay đổi chưa lưu.')).toBeVisible();
  await editor.getByRole('button', { name: 'Tiếp tục sửa', exact: true }).click();
  await expect(editor.getByLabel('Mã LaTeX', { exact: true })).toHaveValue(a);
  await editor.getByRole('button', { name: 'Lưu câu hỏi', exact: true }).click();
  await expect(editor).not.toBeVisible();
});

import { test, expect } from '@playwright/test';
test('document vault persists multi-file edits, rename, trash and restore', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Kho đề & tài liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Bộ đề mới', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Tên mục').fill('Đề ôn tập 10');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('.doc-toolbar')).toContainText('Đề ôn tập 10');
  await page
    .locator('.doc-toolbar input[type=file]')
    .first()
    .setInputFiles([
      { name: 'alpha.tex', mimeType: 'text/plain', buffer: Buffer.from('Alpha') },
      { name: 'beta.tex', mimeType: 'text/plain', buffer: Buffer.from('Beta') },
    ]);
  await page.locator('.doc-tree button').filter({ hasText: 'alpha.tex' }).click();
  await page.locator('textarea').fill('Alpha đã sửa');
  await page.locator('textarea').press('Control+s');
  await page.locator('.doc-tree button').filter({ hasText: 'beta.tex' }).click();
  await expect(page.locator('.doc-tabs')).toContainText('alpha.tex');
  await expect(page.locator('.doc-tabs')).toContainText('beta.tex');
  await page.getByRole('button', { name: 'Đổi tên file', exact: true }).click();
  await modal.getByLabel('Tên mục').fill('gamma.tex');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('.doc-tree')).not.toContainText('gamma.tex');
  await page.getByRole('button', { name: /Thùng rác/ }).click();
  await page.getByRole('button', { name: 'Khôi phục', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Thùng rác tài liệu' })
    .getByRole('button', { name: 'Đóng', exact: true })
    .click();
  await expect(page.locator('.doc-tree')).toContainText('gamma.tex');
  await page.reload();
  await page.getByRole('button', { name: 'Kho đề & tài liệu', exact: true }).click();
  await page.locator('.doc-tree button').filter({ hasText: 'alpha.tex' }).click();
  await expect(page.locator('textarea')).toHaveValue('Alpha đã sửa');
  expect(errors).toEqual([]);
});

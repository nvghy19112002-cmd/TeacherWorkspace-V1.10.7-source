import { test, expect } from '@playwright/test';
import { openWorkspace } from './appReady';

test('shared navigation keeps its geometry and curriculum shows exactly three KNTT grades', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWorkspace(page);
  await expect(page.getByRole('button', { name: 'Thời khóa biểu', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const geometry = () =>
    page.evaluate(() => ({
      side: document.querySelector('.sidebar')!.getBoundingClientRect().width,
      top: document.querySelector('.topbar')!.getBoundingClientRect().height,
      left: document.querySelector('.main-shell')!.getBoundingClientRect().left,
    }));
  const before = await geometry();
  let releasePage!: () => void;
  const gate = new Promise<void>((resolve) => {
    releasePage = resolve;
  });
  const requested = page.waitForRequest((request) =>
    request.url().includes('/src/modules/question-bank/QuestionBankPage.tsx'),
  );
  await page.route('**/src/modules/question-bank/QuestionBankPage.tsx*', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
    await requested;
    await expect(page.getByRole('button', { name: 'Thời khóa biểu', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('.breadcrumb strong')).toHaveText('Thời khóa biểu');
    expect(await geometry()).toEqual(before);
  } finally {
    releasePage();
  }
  await expect(page.locator('.qb-studio')).toBeVisible();
  expect(await geometry()).toEqual(before);
  await page.getByRole('button', { name: /Lọc theo mục lục/ }).click();
  const filter = page.getByRole('dialog', { name: 'Lọc theo mục lục KNTT', exact: true });
  await expect(filter.getByLabel('Chọn lớp KNTT').getByRole('button')).toHaveCount(3);
  await filter.getByLabel('Tìm chương bài dạng KNTT').fill('vi tri tuong doi');
  await expect(filter.locator('.qb-catalog-label').filter({ hasText: 'Bài 20' })).toHaveCount(1);
  await filter.locator('.qb-catalog-label').filter({ hasText: 'Bài 20' }).click();
  await filter.getByRole('button', { name: 'Áp dụng mục đã chọn' }).click();
  await expect(page.locator('.qb-active-curriculum')).toContainText('Bài 20');
  await page.getByLabel('Xóa lọc mục lục', { exact: true }).click();
  await expect(page.locator('.qb-active-curriculum')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quản lý cây mục lục' }).click();
  const catalog = page.getByLabel('Danh mục KNTT dùng cho AI');
  await expect(catalog).toContainText('9 chương · 27 bài');
  await expect(catalog).toContainText('9 chương · 33 bài');
  await expect(catalog).toContainText('6 chương · 19 bài');
  await expect(page.locator('.qb-tree > .qb-tree-item')).toHaveCount(3);
  await page.getByLabel('Hiện tất cả cây cũ / dữ liệu tham khảo').check();
  expect(await page.locator('.qb-tree > .qb-tree-item').count()).toBeGreaterThan(3);
  await page.getByLabel('Hiện tất cả cây cũ / dữ liệu tham khảo').uncheck();
  await expect(page.locator('.qb-tree > .qb-tree-item')).toHaveCount(3);
  await page
    .getByRole('dialog')
    .locator('.modal-heading')
    .getByRole('button', { name: 'Đóng', exact: true })
    .click();
  for (const label of ['Công việc', 'Thời khóa biểu', 'Ngân hàng câu hỏi']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await geometry()).toEqual(before);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await expect(page.getByRole('button', { name: /Lọc theo mục lục/ })).toBeInViewport();
  await page.screenshot({ path: 'test-results/kntt-navigation-private.png' });
  expect(errors).toEqual([]);
});

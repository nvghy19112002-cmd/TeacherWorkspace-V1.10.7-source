import { test, expect } from '@playwright/test';
test('settings groups, compact icon rail, bulk keys and dynamic model diagnostics', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          models: [
            { name: 'models/gemini-test-new', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-test-extra', supportedGenerationMethods: ['generateContent'] },
          ],
        },
      });
    return route.fulfill({
      status: 400,
      json: { error: { message: 'Test diagnostic: unsupported configuration' } },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  const rail = page.locator('.icon-rail');
  expect((await rail.boundingBox())!.width).toBe(64);
  await expect(rail.locator('.nav-item').first()).toHaveAttribute('title', 'Dashboard');
  await page.getByText('Nhập nhiều API key', { exact: true }).click();
  await page
    .getByLabel('Mỗi dòng một key')
    .fill('fake-test-key-one\nfake-test-key-two\nfake-test-key-one');
  await page.getByRole('button', { name: 'Thêm danh sách key' }).click();
  await expect(page.locator('.key-row')).toHaveCount(2);
  await expect(page.getByLabel('Mỗi dòng một key')).toBeEmpty();
  await page.getByRole('combobox', { name: 'Cách dùng key' }).selectOption('round_robin');
  await page.getByRole('button', { name: 'Tải model', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Model dùng chung' }).locator('option'),
  ).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Model dùng chung' }).selectOption('gemini-test-new');
  await page.getByRole('button', { name: 'Thử model', exact: true }).click();
  await expect(page.locator('.key-diagnostic')).toContainText('HTTP 400');
  await expect(page.locator('.key-diagnostic')).toContainText('unsupported configuration');
  await page.getByRole('button', { name: 'Lưu model', exact: true }).click();
  await page.getByRole('button', { name: 'TeX Live Biên dịch và xem trước LaTeX' }).click();
  await expect(page.getByRole('heading', { name: 'TeX Live và xem trước câu hỏi' })).toBeVisible();
  await page.getByRole('button', { name: 'Giao diện & lịch Hiển thị và thời gian biểu' }).click();
  await expect(page.getByRole('combobox', { name: 'Giao diện', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dữ liệu Sao lưu, khôi phục và không gian' }).click();
  await expect(page.getByRole('button', { name: 'Xuất backup', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cập nhật Phiên bản và bộ cài Windows' }).click();
  await expect(page.getByRole('button', { name: 'Chọn file cập nhật (.exe)' })).toBeVisible();
  await page.getByRole('button', { name: 'AI & API key Model, kết nối và danh sách key' }).click();
  await expect(page.getByRole('combobox', { name: 'Cách dùng key' })).toHaveValue('round_robin');
  await page.screenshot({ path: 'test-results/settings-new-private.png', fullPage: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

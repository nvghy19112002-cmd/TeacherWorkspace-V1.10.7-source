import { expect, type Page } from '@playwright/test';

// A visible rail means SQLite is ready, but the first lazy screen can still be loading.
// Wait for both before clicking navigation or testing deferred navigation geometry.
export async function waitForWorkspaceReady(page: Page) {
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('main .page-loading')).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
}

export async function openWorkspace(page: Page) {
  await page.goto('/');
  await waitForWorkspaceReady(page);
}

export async function openQuestionBank(page: Page) {
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-studio-header')).toBeVisible({ timeout: 30000 });
}

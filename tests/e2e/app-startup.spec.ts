import { expect, test } from '@playwright/test';
import { openQuestionBank, openWorkspace } from './appReady';

test('cold startup waits for SQLite and the first lazy screen before navigation', async ({
  page,
}) => {
  let releaseDatabase!: () => void, releaseScreen!: () => void;
  let sawDatabase!: () => void, sawScreen!: () => void;
  const databaseGate = new Promise<void>((resolve) => {
    releaseDatabase = resolve;
  });
  const screenGate = new Promise<void>((resolve) => {
    releaseScreen = resolve;
  });
  const databaseRequested = new Promise<void>((resolve) => {
    sawDatabase = resolve;
  });
  const screenRequested = new Promise<void>((resolve) => {
    sawScreen = resolve;
  });
  await page.route(/\/sql-wasm\.wasm(?:\?|$)/, async (route) => {
    sawDatabase();
    await databaseGate;
    await route.continue();
  });
  await page.route('**/src/modules/schedule/SchedulePage.tsx*', async (route) => {
    sawScreen();
    await screenGate;
    await route.continue();
  });
  let booted = false;
  const opening = openWorkspace(page).then(() => {
    booted = true;
  });
  try {
    await databaseRequested;
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0);
    expect(booted).toBe(false);
    releaseDatabase();
    await screenRequested;
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
    await expect(page.locator('main .page-loading')).toBeVisible();
    expect(booted).toBe(false);
    releaseScreen();
    await opening;
    await expect(
      page.getByRole('heading', { name: 'Một tuần thật chủ động.', exact: true }),
    ).toBeVisible();
    await openQuestionBank(page);
    await expect(
      page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  } finally {
    releaseDatabase();
    releaseScreen();
    await opening;
  }
});

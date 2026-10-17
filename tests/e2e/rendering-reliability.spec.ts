import { test, expect } from '@playwright/test';
import type { TexPreviewSettings } from '../../src/modules/question-bank/domain/texPreview';
const mockSettings: TexPreviewSettings = {
  engine: 'pdflatex',
  executable: '',
  preamblePath: '',
  projectDir: '',
  mode: 'integrated',
  additionalPreamble: '',
};
test('native preview bridge mock never displays the previous-source image while a replacement is pending or failed', async ({
  page,
}) => {
  await page.route('**/src/database/driver.ts*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export const isDesktop=true; let instance; export function getDriver(){return instance ??= import('/src/database/webSqlite.ts').then(m=>m.createWebDriver());}`,
    }),
  );
  await page.route('**/src/modules/question-bank/services/pdfFigure.ts*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export async function pdfFigure(){return {url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>'),width:20,height:20}}`,
    }),
  );
  await page.addInitScript((settings) => {
    const bridge = window as unknown as {
      __TAURI_INTERNALS__: {
        invoke: (command: string, args?: { question?: string }) => Promise<unknown>;
      };
      rejectPreview?: () => void;
    };
    bridge.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        if (command === 'tex_preview_settings') return settings;
        if (command === 'tex_preview_read_setup') return '';
        if (command === 'tex_preview_cancel') return;
        if (command === 'tex_preview_compile') {
          if (args?.question?.includes('SOURCE_B'))
            return new Promise((resolve, reject) => {
              void resolve;
              bridge.rejectPreview = () => reject(new Error('Thiếu hình SOURCE_B'));
            });
          return { success: true, pdf: [1, 2, 3], log: '' };
        }
        if (command === 'ai_read_key') return '';
        throw new Error('Unexpected mock native command: ' + command);
      },
    };
  }, mockSettings);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'tikz-race-test';
    host.style.cssText =
      'position:fixed;top:120px;left:200px;z-index:99999;background:white;padding:20px';
    document.body.append(host);
    const path = '/tests/e2e/previewHarness.tsx';
    const harness = (await import(path)).tikzHarness(host);
    (window as unknown as { previewTest: typeof harness }).previewTest = harness;
    harness.show('\\begin{tikzpicture}\\node{SOURCE_A};\\end{tikzpicture}');
  });
  const host = page.locator('#tikz-race-test');
  await expect(host.getByRole('img')).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { previewTest: { show: (source: string) => void } }).previewTest.show(
      '\\begin{tikzpicture}\\node{SOURCE_B};\\end{tikzpicture}',
    ),
  );
  await expect(host.getByRole('img')).toHaveCount(0);
  await expect(host).toContainText('Đang dựng hình');
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as unknown as { rejectPreview?: () => void }).rejectPreview,
      ),
    )
    .toBe('function');
  await page.evaluate(() => (window as unknown as { rejectPreview: () => void }).rejectPreview());
  await expect(host).toContainText('Thiếu hình SOURCE_B');
  await expect(host.getByRole('img')).toHaveCount(0);
});

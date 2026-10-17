import { test, expect } from '@playwright/test';

test('compact bank actions and one confirmation scan and approve a batch', async ({ page }) => {
  // Cold Windows runners must load SQLite WASM and lazy screens before this long UI flow.
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
    }),
  );
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    calls++;
    const input = JSON.parse(route.request().postDataJSON().contents[0].parts[0].text);
    const nodes = input.curriculum.nodes;
    const form = nodes.find((n: { kind: string }) => n.kind === 'form');
    const byId = (id: string) => nodes.find((n: { id: string }) => n.id === id);
    const lesson = byId(form.parentId),
      chapter = byId(lesson.parentId),
      domain = byId(chapter.parentId),
      grade = byId(domain.parentId);
    const result = {
      proposedClassificationCode: '',
      grade: String(Number(grade.code) + 10),
      domain: domain.code,
      chapterId: chapter.id,
      lessonId: lesson.id,
      formId: form.id,
      level: 'N',
      primaryLearningOutcomeId: null,
      secondaryLearningOutcomeIds: [],
      alignment: 'direct',
      confidence: 0.9,
      reasoningSummary: 'Đã đối chiếu',
      evidence: [],
      independentAnswer: '1',
      answerCheck: 'correct',
      dataCheck: 'valid',
      warnings: [],
      alternativeClassifications: [],
    };
    await route.fulfill({
      json: {
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } },
        ],
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('main .page-loading')).toHaveCount(0, { timeout: 30000 });
  await page
    .getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true })
    .click({ timeout: 30000 });
  await expect(page.locator('.qb-studio-header')).toBeVisible({ timeout: 30000 });
  expect((await page.locator('.qb-studio-header').boundingBox())!.height).toBeLessThanOrEqual(70);
  const setup = await page.evaluate(async () => {
    const bankPath = '/src/modules/question-bank/store.ts',
      wsPath = '/src/app/store.ts',
      credPath = '/src/modules/ai-tools/services/credentials.ts',
      statePath = '/src/modules/ai-tools/services/state.ts',
      parserPath = '/src/modules/question-bank/domain/parser.ts';
    const { useQuestionBank } = await import(bankPath),
      { useWorkspace } = await import(wsPath),
      { storeKey } = await import(credPath),
      { readAiState } = await import(statePath),
      { parsedToQuestion, parseExTest } = await import(parserPath);
    await useQuestionBank.getState().initialize();
    await storeKey('fake-key-batch', 'batch-test');
    await useWorkspace.getState().commit((s: Record<string, unknown>) => {
      const current = useWorkspace.getState().data;
      return {
        ...s,
        settings: {
          ...current.settings,
          moduleState: {
            ...current.settings.moduleState,
            aiTools: JSON.stringify({
              ...readAiState(current.settings.moduleState?.aiTools),
              model: 'test-model',
            }),
            aiKeyPool: JSON.stringify({
              version: 1,
              automatic: false,
              activeId: 'batch-test',
              keys: [
                {
                  id: 'batch-test',
                  label: 'Test',
                  masked: 'fake',
                  priority: 0,
                  enabled: true,
                  status: 'active',
                  lastCheckedAt: null,
                },
              ],
            }),
          },
        },
      };
    });
    const qs = ['Alpha', 'Beta', 'Gamma'].map((text) =>
      parsedToQuestion(parseExTest(`\\begin{ex}${text} $1+0$.\\loigiai{1}\\end{ex}`)[0]),
    );
    qs[2].idLocked = true;
    qs[0].source = 'file-a.tex';
    qs[1].source = 'file-b.tex';
    qs[2].source = 'file-a.tex';
    await useQuestionBank
      .getState()
      .commit((s: Record<string, unknown>) => ({ ...s, questions: qs }));
    return qs.map((q: { id: string; rawSource: string }) => ({ id: q.id, raw: q.rawSource }));
  });
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(3);
  await page.getByLabel('Lọc nhanh loại câu').selectOption('essay');
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(3);
  await page.getByLabel('Lọc nhanh hình vẽ').selectOption('with');
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa tất cả bộ lọc', exact: true }).click();
  await page.locator('.qb-question-open').filter({ hasText: 'Alpha' }).click();
  await page.getByRole('button', { name: 'Xem code', exact: true }).click();
  await expect(page.locator('.qb-source-view')).toContainText('Alpha');
  await page.getByLabel('Chép LaTeX câu đang xem').click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(
    'Alpha',
  );
  await page.getByRole('button', { name: 'Mở rộng xem trước', exact: true }).click();
  await expect(page.locator('.qb-studio')).toHaveClass(/detail-focused/);
  await page.getByRole('button', { name: 'Thoát chế độ tập trung', exact: true }).click();
  // Read and collect without returning to the table; keep the tray across modules.
  await page.locator('.qb-question-open').first().click();
  const beforeReading = await page.locator('.qb-source-view').textContent();
  await page.getByRole('button', { name: 'Chọn & tiếp', exact: true }).click();
  await expect(page.locator('.qb-source-view')).not.toHaveText(beforeReading!);
  await page.getByRole('button', { name: 'Công việc', exact: true }).click();
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-tray-trigger b')).toHaveText('1');
  await page.getByLabel('Lọc nhanh lớp', { exact: true }).selectOption('kntt-2026-g10');
  await page.getByLabel('Lọc nhanh nhánh', { exact: true }).selectOption('kntt-2026-g10-D');
  await page.getByLabel('Lọc nhanh chương', { exact: true }).selectOption('kntt-2026-g10-D-c1');
  await page.getByLabel('Lọc nhanh lớp', { exact: true }).selectOption('kntt-2026-g11');
  await expect(page.getByLabel('Lọc nhanh chương', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Lọc nhanh chương', { exact: true })).toBeDisabled();
  await page.getByLabel('Nhóm câu hỏi', { exact: true }).selectOption('review');
  await expect(page.getByLabel('Lọc nhanh lớp', { exact: true })).toHaveValue('kntt-2026-g11');
  await page.getByRole('button', { name: 'Xóa tất cả bộ lọc', exact: true }).click();
  await page.getByLabel('Lọc nhanh nguồn nhập').selectOption('file-a.tex');
  await expect(page.locator('.qb-question-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Xóa tất cả bộ lọc', exact: true }).click();
  await page.locator('.qb-question-open').first().click();
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  expect(
    await page
      .locator('.qb-detail-content')
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBe(16);
  await page.screenshot({ path: 'test-results/reader-new-private.png' });
  await page.getByLabel('Chọn toàn bộ trang').check();
  await page.getByLabel('Biên dịch câu đã chọn').click();
  const tex = page.getByRole('dialog', { name: 'Xem trước 3 câu', exact: true });
  await expect(tex).toContainText('ứng dụng Windows');
  await tex.locator('.modal-heading').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByLabel('Gán ID hàng loạt').click();
  const modal = page.getByRole('dialog', { name: 'Gán ID tự động', exact: true });
  await expect(modal).toContainText('3 câu đã chọn');
  await expect(modal.locator('.qb-ai-options')).not.toHaveAttribute('open', '');
  await expect(modal.getByRole('status')).toHaveCount(0);
  expect(calls).toBe(0);
  expect((await modal.boundingBox())!.width).toBeLessThanOrEqual(550);
  await page.screenshot({ path: 'test-results/id-confirm-private.png' });
  await modal.getByRole('button', { name: 'Xác nhận và quét', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('Đã lưu 2');
  await expect(modal.getByRole('status')).toContainText('Bỏ qua 1');
  expect(calls).toBe(2);
  const read = () =>
    page.evaluate(async () => {
      const p = '/src/modules/question-bank/store.ts';
      const { useQuestionBank } = await import(p);
      return useQuestionBank.getState().data;
    });
  expect(
    (await read()).questions.every((q: { classificationCode: string }) => !q.classificationCode),
  ).toBe(true);
  page.once('dialog', (d) => void d.dismiss());
  await modal.getByRole('button', { name: 'Duyệt 2 đề xuất', exact: true }).click();
  expect(
    (await read()).questions.every((q: { classificationCode: string }) => !q.classificationCode),
  ).toBe(true);
  page.once('dialog', (d) => void d.accept());
  await modal.getByRole('button', { name: 'Duyệt 2 đề xuất', exact: true }).click();
  await expect(modal.locator('.qb-ai-batch-report')).toContainText('Đã áp dụng 2 câu');
  const saved = await read();
  expect(
    saved.questions.filter((q: { classificationCode: string }) => q.classificationCode),
  ).toHaveLength(2);
  for (const original of setup)
    expect(saved.questions.find((q: { id: string }) => q.id === original.id).rawSource).toBe(
      original.raw,
    );
  expect(
    saved.questions
      .filter((q: { classificationCode: string }) => q.classificationCode)
      .every((q: { status: string }) => q.status === 'review'),
  ).toBe(true);
  await modal.locator('.modal-heading').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await page.screenshot({ path: 'test-results/bank-compact-private.png' });
  expect(errors).toEqual([]);
});

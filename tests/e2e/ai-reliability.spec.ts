import { expect, test, type Page, type Route } from '@playwright/test';
import { openQuestionBank, openWorkspace, waitForWorkspaceReady } from './appReady';

async function seed(page: Page, count: number) {
  await openWorkspace(page);
  await openQuestionBank(page);
  return page.evaluate(async (count) => {
    const bankPath = '/src/modules/question-bank/store.ts',
      wsPath = '/src/app/store.ts',
      credentialsPath = '/src/modules/ai-tools/services/credentials.ts',
      parserPath = '/src/modules/question-bank/domain/parser.ts';
    const { useQuestionBank } = await import(bankPath),
      { useWorkspace } = await import(wsPath),
      { storeKey } = await import(credentialsPath),
      { parseExTest, parsedToQuestion } = await import(parserPath);
    await storeKey('fake-reliability-key', 'reliability');
    await useWorkspace.getState().commit((s: Record<string, unknown>) => ({
      ...s,
      settings: {
        ...useWorkspace.getState().data.settings,
        moduleState: {
          ...useWorkspace.getState().data.settings.moduleState,
          aiTools: JSON.stringify({ version: 1, model: 'test-model', prompts: [], history: [] }),
          aiKeyPool: JSON.stringify({
            version: 1,
            automatic: true,
            activeId: 'reliability',
            keys: [
              {
                id: 'reliability',
                label: 'Mock',
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
    }));
    const questions = Array.from({ length: count }, (_, index) => ({
      ...parsedToQuestion(
        parseExTest(`\\begin{ex}Reliability ${index + 1}: $1+1$.\\loigiai{2}\\end{ex}`)[0],
      ),
      // Deliberately place question 2 before question 1 in the bank's ID tie-break.
      id: `reliability-${[2, 1, 3][index] ?? index + 1}`,
      updatedAt: '2026-10-18T00:00:00.000Z',
    }));
    await useQuestionBank.getState().commit((s: Record<string, unknown>) => ({ ...s, questions }));
    return questions.map((q: { id: string; rawSource: string }) => ({
      id: q.id,
      rawSource: q.rawSource,
    }));
  }, count);
}
async function fulfill(route: Route) {
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
    reasoningSummary: 'Mock đối chiếu KNTT',
    evidence: ['1+1=2'],
    independentAnswer: '2',
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
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
    },
  });
}
async function openScan(page: Page) {
  await page.getByLabel('Chọn toàn bộ trang').check();
  await page.getByLabel('Gán ID hàng loạt').click();
  return page.getByRole('dialog', { name: 'Gán ID tự động', exact: true });
}
test('503 recovers on the same key and records prompt version without applying ID', async ({
  page,
}) => {
  let calls = 0;
  const keys: string[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    calls++;
    keys.push(route.request().headers()['x-goog-api-key']);
    if (calls < 3) await route.fulfill({ status: 503, json: { error: { message: 'overloaded' } } });
    else await fulfill(route);
  });
  const originals = await seed(page, 1);
  const modal = await openScan(page);
  await modal.getByRole('button', { name: 'Xác nhận và quét', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('Gemini đang quá tải');
  await expect(modal.getByRole('status')).toContainText('Đã lưu 1', { timeout: 30000 });
  expect(calls).toBe(3);
  expect(new Set(keys).size).toBe(1);
  const saved = await page.evaluate(async () => {
    const path = '/src/modules/question-bank/store.ts';
    return (await import(path)).useQuestionBank.getState().data;
  });
  expect(saved.questions[0].rawSource).toBe(originals[0].rawSource);
  expect(saved.questions[0].classificationCode).toBe('');
  expect(saved.classificationRuns[0].accepted).toBe(false);
  expect(JSON.parse(saved.classificationRuns[0].resultJson).__promptVersion).toBe(
    'kntt-classification-2.0.0',
  );
});
test('closing during cooldown persists progress and resumes only unfinished questions', async ({
  page,
}) => {
  test.setTimeout(90000);
  let calls = 0;
  const sources: string[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    calls++;
    sources.push(
      JSON.parse(route.request().postDataJSON().contents[0].parts[0].text).question.rawSource,
    );
    if (calls === 2)
      await route.fulfill({
        status: 503,
        headers: { 'Retry-After': '20', 'Access-Control-Expose-Headers': 'Retry-After' },
        json: { error: { message: 'overloaded' } },
      });
    else await fulfill(route);
  });
  await seed(page, 3);
  let modal = await openScan(page);
  await modal.getByRole('button', { name: 'Xác nhận và quét', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('20 giây');
  await modal.locator('.modal-heading').getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = '/src/app/store.ts';
        const s = (await import(path)).useWorkspace.getState();
        return JSON.parse(s.data.settings.moduleState.classificationJob).rows.some(
          (r: { status: string }) => r.status === 'cancelled',
        );
      }),
    )
    .toBe(true);
  const completedSource = sources[0],
    retrySource = sources[1];
  expect(completedSource).toContain('Reliability 2:');
  expect(retrySource).toContain('Reliability 1:');
  // Reload discards component/global queue state; progress must come from SQLite settings.
  await page.reload();
  await waitForWorkspaceReady(page);
  // Browser credentials are deliberately memory-only; emulate re-entering the key.
  // Desktop persists credentials in its native vault, which this browser test does not use.
  await page.evaluate(async () => {
    const path = '/src/modules/ai-tools/services/credentials.ts';
    await (await import(path)).storeKey('fake-reliability-key', 'reliability');
  });
  await openQuestionBank(page);
  modal = await openScan(page);
  await expect(modal.getByRole('status')).toContainText('Đã lưu 1');
  page.once('dialog', (dialog) => void dialog.accept());
  await modal.getByRole('button', { name: /Thử lại câu lỗi/ }).click();
  await expect(modal.getByRole('status')).toContainText('Đã lưu 3', { timeout: 30000 });
  expect(calls).toBe(4);
  expect(sources.filter((s) => s === completedSource)).toHaveLength(1);
  expect(sources.filter((s) => s === retrySource)).toHaveLength(2);
  expect(new Set(sources).size).toBe(3);
  const runs = await page.evaluate(async () => {
    const path = '/src/modules/question-bank/store.ts';
    return (await import(path)).useQuestionBank.getState().data.classificationRuns;
  });
  expect(runs).toHaveLength(3);
  expect(new Set(runs.map((r: { questionId: string }) => r.questionId)).size).toBe(3);
});
test('prompt manager persists a version and compares two real mock requests without changing IDs', async ({
  page,
}) => {
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    calls++;
    await fulfill(route);
  });
  await seed(page, 1);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('button', { name: /Prompt phân loại/ }).click();
  await page
    .getByLabel('Hướng dẫn prompt phân loại')
    .fill('Đối chiếu kiến thức chính, nêu bằng chứng ngắn.');
  await page.getByRole('button', { name: 'Lưu phiên bản mới', exact: true }).click();
  await expect(page.getByLabel('Phiên bản prompt phân loại')).not.toHaveValue(
    'kntt-classification-2.0.0',
  );
  await page.getByLabel('Câu thử prompt').selectOption({ index: 1 });
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'So sánh hai phiên bản', exact: true }).click();
  await expect(page.locator('.classification-prompts .qb-ai-review-grid > section')).toHaveCount(2);
  expect(calls).toBe(2);
  await expect(page.locator('.classification-prompts')).toContainText('150');
  await page.getByRole('button', { name: 'Khôi phục prompt mặc định', exact: true }).click();
  await expect(page.getByLabel('Phiên bản prompt phân loại')).toHaveValue(
    'kntt-classification-2.0.0',
  );
});

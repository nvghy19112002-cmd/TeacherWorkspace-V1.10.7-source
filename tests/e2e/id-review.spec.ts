import { test, expect } from '@playwright/test';
test('ID review retries failures, allows teacher correction and persists exact source', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    calls++;
    if (calls === 1) {
      await route.fulfill({
        json: {
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'invalid JSON' }] } }],
        },
      });
      return;
    }
    const input = JSON.parse(route.request().postDataJSON().contents[0].parts[0].text);
    const form = input.curriculum.nodes.find(
      (n: { kind: string; code: string }) => n.kind === 'form' && n.code === '1',
    );
    const lesson = input.curriculum.nodes.find((n: { id: string }) => n.id === form.parentId);
    const chapter = input.curriculum.nodes.find((n: { id: string }) => n.id === lesson.parentId);
    const domain = input.curriculum.nodes.find((n: { id: string }) => n.id === chapter.parentId);
    const grade = input.curriculum.nodes.find((n: { id: string }) => n.id === domain.parentId);
    const result = {
      proposedClassificationCode: 'AI-CODE-WRONG',
      grade: String(Number(grade.code) + 10),
      domain: domain.code,
      chapterId: chapter.id,
      lessonId: lesson.id,
      formId: form.id,
      level: 'N',
      primaryLearningOutcomeId: null,
      secondaryLearningOutcomeIds: [],
      alignment: 'direct',
      confidence: 0.8,
      reasoningSummary: 'Đối chiếu bài KNTT',
      evidence: ['Dữ kiện trong nguồn'],
      independentAnswer: 'Chưa kiểm chứng',
      answerCheck: 'missing',
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
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  const initial = await page.evaluate(async () => {
    const bankPath = '/src/modules/question-bank/store.ts',
      wsPath = '/src/app/store.ts',
      statePath = '/src/modules/ai-tools/services/state.ts',
      credPath = '/src/modules/ai-tools/services/credentials.ts',
      parserPath = '/src/modules/question-bank/domain/parser.ts';
    const { useQuestionBank } = await import(bankPath),
      { useWorkspace } = await import(wsPath),
      { readAiState } = await import(statePath),
      { storeKey } = await import(credPath),
      { parseExTest, parsedToQuestion } = await import(parserPath);
    await useQuestionBank.getState().initialize();
    await storeKey('fake-key-id-review', 'id-test');
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
              activeId: 'id-test',
              keys: [
                {
                  id: 'id-test',
                  label: 'Test',
                  masked: 'fake…test',
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
    const s = useQuestionBank.getState().data;
    const lesson = s.curriculumNodes.find(
      (n: { id: string; kind: string; code: string }) =>
        n.id.startsWith('kntt-2026-') && n.kind === 'lesson' && n.code === '20',
    );
    const raw = String.raw`\begin{ex}Câu thử phân loại $x^2+1$.\loigiai{Lời giải gốc.}\end{ex}`;
    const q = parsedToQuestion(parseExTest(raw)[0]);
    await useQuestionBank.getState().commit((current: Record<string, unknown>) => ({
      ...current,
      curriculumNodes: [
        ...s.curriculumNodes,
        ...['1', '2'].map((code) => ({
          ...lesson,
          id: lesson.id + '-f' + code,
          parentId: lesson.id,
          kind: 'form',
          code,
          name: 'Dạng thử ' + code,
        })),
      ],
      questions: [...s.questions, q],
    }));
    useQuestionBank.getState().select(q.id);
    return { id: q.id, raw, lesson: lesson.id };
  });
  await page.locator('.qb-question-open').filter({ hasText: 'Câu thử phân loại' }).click();
  await page.getByRole('button', { name: 'Gán ID', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Gán ID tự động', exact: true });
  await modal.getByText('Tùy chọn nâng cao', { exact: true }).click();
  await modal.getByLabel('Phạm vi quét KNTT').selectOption(initial.lesson);
  await modal.getByRole('button', { name: 'Xác nhận và quét', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('Lỗi 1');
  expect(calls).toBe(1);
  await modal.getByRole('button', { name: /Thử lại câu lỗi/ }).click();
  await expect(modal.locator('.qb-ai-result')).toHaveCount(1);
  expect(calls).toBe(2);
  await modal.locator('.qb-ai-result > summary').click();
  await expect(modal).toContainText('App đã ghép lại mã');
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await page.screenshot({ path: 'test-results/id-review-private-qa.png' });
  await modal.getByLabel('Dạng duyệt KNTT').selectOption(initial.lesson + '-f2');
  await modal.getByLabel('Mức độ duyệt KNTT').selectOption('H');
  await modal.getByLabel('Lý do sửa ID').fill('Đã đối chiếu dạng và mức độ');
  page.once('dialog', (dialog) => void dialog.accept());
  await modal.getByRole('button', { name: 'Duyệt và áp dụng phân loại', exact: true }).click();
  await expect(modal.locator('.qb-ai-result > summary')).toContainText('Đã áp dụng');
  const saved = await page.evaluate(async (id) => {
    const path = '/src/modules/question-bank/store.ts';
    const { useQuestionBank } = await import(path);
    return useQuestionBank.getState().data.questions.find((q: { id: string }) => q.id === id);
  }, initial.id);
  expect(saved.rawSource).toBe(initial.raw);
  expect(saved.formNodeId).toBe(initial.lesson + '-f2');
  expect(saved.classificationCode).toContain('H20-2');
  expect(saved.status).toBe('review');
  await modal.locator('.modal-footer').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ngân hàng câu hỏi', exact: true }).click();
  await expect(page.locator('.qb-question-table')).toContainText(saved.displayId);
  expect(errors).toEqual([]);
});

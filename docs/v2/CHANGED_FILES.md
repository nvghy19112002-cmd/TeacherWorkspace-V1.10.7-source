# Các file thay đổi theo milestone

Baseline: e3d8e81, nguồn 1.10.8 kế thừa 1.10.7. M0 backup và baseline test; không sửa core.

A: thêm, M: sửa. Danh sách dùng Git diff thực tế; không bao gồm khóa ký ngoài repository.

## M1 — AI reliability

32 file.

```text
A	docs/v2/CHANGED_FILES_M1.md
A	docs/v2/MASTER_PROMPT.md
A	docs/v2/MILESTONE_0.md
A	docs/v2/MILESTONE_1.md
A	docs/v2/TEST_REPORT.md
M	src/modules/ai-tools/components/ProviderSettings.tsx
A	src/modules/ai-tools/domain/modelCapabilities.ts
A	src/modules/ai-tools/domain/usageCost.ts
M	src/modules/ai-tools/services/aiProvider.ts
M	src/modules/ai-tools/services/credentials.ts
M	src/modules/ai-tools/services/geminiDiagnostics.ts
A	src/modules/ai-tools/services/requestManager.ts
M	src/modules/question-bank/components/AiIdScan.tsx
A	src/modules/question-bank/components/ClassificationPrompts.tsx
M	src/modules/question-bank/domain/classification.ts
A	src/modules/question-bank/domain/classificationPrompts.ts
A	src/modules/question-bank/domain/curriculumRetrieval.ts
M	src/modules/question-bank/domain/scanQueue.ts
M	src/modules/question-bank/services/classificationProvider.ts
A	src/modules/question-bank/services/scanSession.ts
M	src/modules/settings/SettingsPage.tsx
A	src/services/moduleSettings.ts
M	tests/ai-model-catalog.test.ts
A	tests/ai-request-manager.test.ts
M	tests/ai-tools.test.ts
A	tests/classification-prompts.test.ts
A	tests/e2e/ai-reliability.spec.ts
M	tests/e2e/settings-redesign.spec.ts
M	tests/key-selection.test.ts
M	tests/question-ai-provider.test.ts
A	tests/scan-checkpoint-sqlite.test.ts
M	tests/scan-queue.test.ts
```

## M2 — Database & parser

23 file.

```text
A	docs/v2/MILESTONE_2.md
M	docs/v2/TEST_REPORT.md
A	scripts/check-native-db.py
M	src-tauri/src/database.rs
M	src-tauri/src/lib.rs
M	src/database/driver.ts
A	src/database/migrations/003_question_search.sql
M	src/database/webSqlite.ts
M	src/modules/question-bank/QuestionBankPage.tsx
M	src/modules/question-bank/database/codec.ts
A	src/modules/question-bank/database/search.ts
A	src/modules/question-bank/domain/backup.ts
A	src/modules/question-bank/domain/bankMetadata.ts
M	src/modules/question-bank/domain/duplicates.ts
M	src/modules/question-bank/domain/model.ts
M	src/modules/question-bank/domain/normalize.ts
M	src/modules/question-bank/domain/parser.ts
M	src/modules/question-bank/store.ts
M	src/modules/settings/SettingsPage.tsx
A	tests/bank-search-migration.test.ts
A	tests/e2e/bank-search.spec.ts
A	tests/parser-backup-v2.test.ts
M	tests/question-bank-import.test.ts
```

## M3 — Rendering

13 file.

```text
A	docs/v2/MILESTONE_3.md
M	docs/v2/TEST_REPORT.md
A	scripts/compile-preview-corpus.py
M	src/modules/question-bank/components/TexLivePreview.tsx
M	src/modules/question-bank/components/TikzPreview.tsx
M	src/modules/question-bank/services/pdfFigure.ts
M	src/modules/question-bank/services/texCompileQueue.ts
A	src/modules/settings/PerformanceSettings.tsx
M	src/modules/settings/SettingsPage.tsx
M	tests/e2e/pdf-figure.spec.ts
M	tests/e2e/previewHarness.tsx
A	tests/e2e/rendering-reliability.spec.ts
M	tests/tex-compile-queue.test.ts
```

## M4 — Studio UI

23 file.

```text
A	docs/v2/MILESTONE_4.md
M	src/app/App.tsx
A	src/app/design-tokens.css
M	src/app/navigation.ts
A	src/app/studioLayout.ts
A	src/components/useVirtualRows.ts
M	src/layouts/AppShell.tsx
M	src/main.tsx
M	src/modules/ai-tools/components/ProviderSettings.tsx
A	src/modules/question-bank/ClassificationWorkspace.tsx
M	src/modules/question-bank/QuestionBankPage.tsx
M	src/modules/question-bank/components/AiIdScan.tsx
M	src/modules/question-bank/components/ai-id-scan.css
M	src/modules/question-bank/domain/batchApproval.ts
A	src/modules/question-bank/domain/classificationReview.ts
M	src/modules/question-bank/domain/kntt.ts
M	src/modules/question-bank/studio.css
A	src/modules/settings/DiagnosticsSettings.tsx
M	src/modules/settings/SettingsPage.tsx
M	tests/batch-approval.test.ts
M	tests/e2e/bank-search.spec.ts
M	tests/e2e/settings-redesign.spec.ts
A	tests/e2e/studio-layout.spec.ts
```

## M5 — Exam matrix

17 file.

```text
A	docs/v2/MILESTONE_5.md
M	scripts/compile-preview-corpus.py
M	src-tauri/src/database.rs
M	src/app/App.tsx
M	src/app/navigation.ts
M	src/app/studioLayout.ts
A	src/database/migrations/004_exam_matrix.sql
M	src/database/webSqlite.ts
A	src/modules/question-bank/ExamBuilderPage.tsx
M	src/modules/question-bank/database/codec.ts
A	src/modules/question-bank/domain/examMatrix.ts
M	src/modules/question-bank/domain/exams.ts
M	src/modules/question-bank/domain/model.ts
A	src/modules/question-bank/exam-builder.css
M	tests/bank-search-migration.test.ts
A	tests/e2e/exam-builder.spec.ts
A	tests/exam-matrix.test.ts
```

## M6 — QA/source release

20 file.

```text
M	README.md
M	START_HERE.md
A	docs/v2/CHANGED_FILES.md
A	docs/v2/CHANGELOG.md
A	docs/v2/KNOWN_LIMITATIONS.md
A	docs/v2/MIGRATION_AND_BUILD.md
M	docs/v2/MILESTONE_3.md
A	docs/v2/MILESTONE_6.md
M	docs/v2/TEST_REPORT.md
A	docs/v2/screenshots/studio-bank.png
A	docs/v2/screenshots/studio-classification.png
A	docs/v2/screenshots/studio-matrix-dark-1024.png
A	docs/v2/screenshots/studio-matrix-light.png
M	package-lock.json
M	package.json
M	src-tauri/Cargo.lock
M	src-tauri/Cargo.toml
M	src-tauri/tauri.conf.json
M	tests/e2e/studio-layout.spec.ts
M	SHA256SUMS.txt
```

## Sửa CI sau bàn giao — 2026-10-18

Không thay source runtime của ứng dụng. Các file kiểm thử và báo cáo được cập nhật:

```text
M tests/e2e/ai-reliability.spec.ts
M tests/e2e/navigation-curriculum.spec.ts
A tests/e2e/appReady.ts
A tests/e2e/app-startup.spec.ts
A docs/v2/CI_FIXES_2026-10-18.md
M docs/v2/TEST_REPORT.md
M docs/v2/CHANGED_FILES.md
M SHA256SUMS.txt
```

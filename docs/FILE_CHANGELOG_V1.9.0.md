# Tệp thay đổi V1.9.0 so với V1.8.2

Source đầy đủ; không cần ghép các bản update trung gian.

## Đã sửa

- `README.md`
- `package-lock.json`
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/layouts/AppShell.tsx`
- `src/modules/question-bank/QuestionBankPage.tsx`
- `src/modules/question-bank/components/QuestionEditor.tsx`
- `src/modules/question-bank/components/TexLivePreview.tsx`
- `src/modules/question-bank/domain/exams.ts`
- `src/modules/question-bank/domain/texPreview.ts`
- `tests/e2e/question-bank-ui.spec.ts`
- `tests/tex-preview-compile.test.ts`

## Đã thêm

- `START_HERE.md`
- `docs/TEST_REPORT_V1.9.0.md`
- `docs/UPDATE_V1.9.0.md`
- `examples/question-bank-smoke.tex`
- `src/modules/question-bank/components/LibrarySidebar.tsx`
- `src/modules/question-bank/components/SavedExams.tsx`
- `src/modules/question-bank/components/SelectionTray.tsx`
- `src/modules/question-bank/domain/editor.ts`
- `src/modules/question-bank/domain/library.ts`
- `src/modules/question-bank/studio.css`
- `tests/e2e/personal-library.spec.ts`
- `tests/personal-library.test.ts`

Không thay migration SQL hoặc backend Rust. Hai trường phiên bản native được đồng bộ 1.9.0. `SHA256SUMS.txt` được tạo lại cho toàn bộ source bàn giao.

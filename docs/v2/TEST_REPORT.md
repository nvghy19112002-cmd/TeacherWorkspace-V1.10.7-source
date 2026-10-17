# Báo cáo kiểm thử V2 — M0/M1

## M0

Baseline commit e3d8e81: `npm run check` đạt lint, 198 Vitest tests / 26 file, 14 Node release tests, TypeScript và production build.

## M1

- `npm run check`: đạt lint, 235 Vitest tests / 29 file, 14 Node release tests, TypeScript và production build.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`: 21 passed, 1 skipped, 0 failed, 22 test cases.
- Ca skipped là rasterize 237 PDF corpus: cần CORPUS_TEX_DIR chứa dữ liệu đã biên dịch; không coi là đã chạy.
- E2E mới: 503 hai lần rồi thành công trên cùng key; đóng cửa sổ trong cooldown 20 giây, khôi phục và chỉ quét câu còn lại; tạo/khôi phục và so sánh hai phiên bản prompt.
- Mock tests: 503 ba lần rồi thành công; 408/429/500/502/503/504; permanent 400/401/403/404; Retry-After giây/HTTP-date; RetryInfo; network; schema/JSON; hủy; fallback chỉ model/key đã xác minh; không chuyển key né quota.
- Lô 200 câu: hủy ở câu 37 giữ 36 kết quả; tiếp tục 164 câu, không gọi lại câu 1–36. Đây là fixture mock, không phải benchmark dịch vụ AI thật.
- SQLite export/reopen: đủ 200 rawSource gốc giữ nguyên theo UUID, checkpoint được phục hồi đúng; PRAGMA quick_check=ok.
- Các E2E cũ cho lịch, lưu SQLite, ngân hàng, chỉnh sửa LaTeX, kho tài liệu, xuất ảnh, theme, kích thước cửa sổ và corpus 200 câu đều nằm trong full suite đạt.

## Chưa xác thực

Không có kết quả native Rust/Windows hoặc installer V2 trong máy Linux này; không gọi Gemini trả phí và không đo độ chính xác phân loại toán học. Cần bộ nhãn chuẩn giáo viên xác nhận để đánh giá retrieval và classification riêng. Không có database giáo viên thật, install.rar hoặc audit markdown đính kèm để kiểm tra những dữ liệu đó.

## M2

- `npm run check`: 242 Vitest tests / 31 files, lint, TypeScript, 14 release tests, production build đạt.
- 10 E2E AI/bank/import/library liên quan đạt trên thay đổi search/parser ban đầu; sau metadata integration, 7 E2E search/pagination/library/import đạt.
- 5 Rust database tests đạt qua isolated verification (logic DB và bundled SQLite thật; không gồm Tauri IPC/GTK hoặc toàn app Windows).
- Không sửa migration 001/002. Migration 003 từ v2 giữ nguyên 200 source và có backup mở lại được.

## M3

244 Vitest tests / 31 files, 14 release tests, lint/TypeScript/build đạt. 3 E2E rendering/corpus đạt; 1 optional PDF corpus skipped. Test raster dùng PDF do pdflatex thật tạo; test React source A→B dùng native bridge mock có chủ đích để kiểm tra race/error UI, không giả lập kết quả native Windows đã chạy.

# Báo cáo kiểm thử Teacher Workspace V2

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

Tại checkpoint M1 chưa có kết quả native Rust/Windows hoặc installer V2 trong máy Linux này; không gọi Gemini trả phí và không đo độ chính xác phân loại toán học. Cần bộ nhãn chuẩn giáo viên xác nhận để đánh giá retrieval và classification riêng. Không có database giáo viên thật, install.rar hoặc audit markdown đính kèm để kiểm tra những dữ liệu đó.

## M2

- `npm run check`: 242 Vitest tests / 31 files, lint, TypeScript, 14 release tests, production build đạt.
- 10 E2E AI/bank/import/library liên quan đạt trên thay đổi search/parser ban đầu; sau metadata integration, 7 E2E search/pagination/library/import đạt.
- 5 Rust database tests đạt qua isolated verification (logic DB và bundled SQLite thật; không gồm Tauri IPC/GTK hoặc toàn app Windows).
- Không sửa migration 001/002. Migration 003 từ v2 giữ nguyên 200 source và có backup mở lại được.

## M3

244 Vitest tests / 31 files, 14 release tests, lint/TypeScript/build đạt. 3 E2E rendering/corpus đạt; 1 optional PDF corpus skipped. Test raster dùng PDF do pdflatex thật tạo; test React source A→B dùng native bridge mock có chủ đích để kiểm tra race/error UI, không giả lập kết quả native Windows đã chạy.


## M4 / M5

- M4: check đạt 244 unit tests trước regression từ chối mới; 5 E2E liên quan đạt,
  1 E2E bố cục đạt. Regression từ chối bổ sung đạt và nằm trong check cuối.
- M5: check đạt 250 unit tests / 32 files, 14 release tests, lint, TypeScript và build.
  5 isolated Rust DB tests đạt; E2E ma trận đủ/thiếu, lưu, mở lại, sửa nguồn rồi xuất
  snapshot đạt. Chọn câu dùng matching giữa các ô giao nhau, không giảm tiêu chí.
- Regression v3→v4 giữ đề legacy, backup mở lại được; ma trận và điểm roundtrip SQLite.

## M6 — Kết quả kiểm tra mã nguồn cuối

Ngày chạy: 2026-10-17, Linux cloud; Node/Chromium, SQLite sql.js + bundled rusqlite,
Rust 1.95.0, TeX Live/xelatex/pdflatex cài thật. Phiên bản package/Tauri/Cargo/lock
được đồng bộ thành 2.0.0. Không đổi identifier hoặc public key updater.

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| `npm run check` cuối | Lint đạt; 250 Vitest tests / 32 files đạt; 14 Node release tests đạt; TypeScript và production build đạt |
| Full Playwright với `CORPUS_TEX_DIR` | 26 passed, 0 skipped, 0 failed, 4,0 phút |
| E2E bổ sung sau đồng bộ 2.0.0 | 2 passed: ma trận và bố cục; sau khi cố định thứ tự fixture và cuộn đúng container, layout test cuối 1 passed, hàng 50 thực sự trong viewport |
| Native DB isolated | 5 passed, 0 failed; DB source thật, không gồm Tauri IPC/full Windows |
| Native dependency lock | `node scripts/check-native-lock.mjs` đạt cho 2.0.0 |
| Corpus 200 câu | Parser/source và browser render regression đạt; không phải đánh giá đáp án toán học |
| Corpus hình TeX | xelatex 237/238 đạt; hình 49 thiếu macro dự án, không che lỗi |
| Raster PDF thật | Đủ 237/237 PDF đã compile raster thành ảnh bằng production renderer; trong full E2E |
| Updater | 14 tests kiểm tra cấu hình/kênh/manifest/chữ ký và từ chối artifact bị sửa; chưa có bản cài V2 thực tế |
| Bảo toàn dữ liệu | Migration fixture 200 rawSource, backup/reopen, metadata, rollback và optimistic revision đạt |
| Ảnh QA | Light/dark, ngân hàng/AI/ma trận; dark 1024px không tràn toàn trang; ảnh được xem trực tiếp |

Full suite được chạy trên implementation V2 trước khi đổi metadata phiên bản; sau
đổi metadata chạy lại toàn bộ check và hai E2E studio/ma trận. Test layout cuối dùng
UUID fixture cố định để thứ tự không phụ thuộc UUID ngẫu nhiên, kiểm tra hàng thứ 50
thực sự nằm trong viewport sau cuộn. Ba ảnh lịch/export legacy được khôi phục nguyên
bytes sau full E2E; ảnh V2 ở thư mục screenshots riêng.

### Giới hạn của kết quả

Không có full Tauri/Windows build, installer, cài/nâng cấp Windows hay public release
V2 được xác nhận. Máy cloud thiếu GTK/WebKit native và không phải Windows; helper DB
không thay thế Windows CI. Không gọi Gemini trả phí, không đo tỷ lệ chính xác AI và
không có nhãn chuẩn giáo viên. Không có DB sản xuất để chứng nhận migration dữ liệu
thật. CONNECT đến API GitHub vẫn bị proxy trả 403; không xác nhận secret hoặc trạng
thái công khai của release. M6 hoàn thành phần QA/source package; phát hành và nghiệm
thu Windows vẫn đang chờ các kiểm tra đó.

Xem KNOWN_LIMITATIONS.md để biết phần ảnh portable, bộ nhớ snapshot lớn, preamble
và template xuất đề còn cần hoàn thiện/đối chiếu. Không coi các giới hạn là đã sửa xong.

### Logs kiểm tra trong môi trường làm việc

- `/tmp/teacher-v2-final-check.log`
- `/tmp/teacher-v2-final-e2e.log`
- `/tmp/teacher-v2-final-studio.log`
- `/tmp/teacher-v2-final-layout.log`
- `/tmp/teacher-v2-m5-native.log`
- `/workspace/teacher-workspace-deliverables/corpus-figures/corpus-report.json`

Log được sao chép sang thư mục deliverables/qa để giữ cùng bàn giao cục bộ; source
ZIP chứa báo cáo tóm tắt và mã kiểm thử, không chứa database người dùng hoặc khóa riêng.


## Sửa CI Windows sau bàn giao — 2026-10-18

Log Windows do người dùng cung cấp có 3 failed / 21 passed / 2 skipped. Đã xác định
hai vấn đề đồng bộ màn hình khởi động và một giả định sai về thứ tự câu trong test
resume; không coi kết quả Linux cũ là bằng chứng Windows đã chạy đạt. Xem
[phân tích và bản sửa](CI_FIXES_2026-10-18.md).

Check cục bộ mới đạt lint, 250 unit tests, 14 release tests, TypeScript và build.
Các ca liên quan chạy với CI=true, repeat-each=2 đạt 10/10, không bật test retries.
Full E2E với CI=true và bộ PDF thật: **27 passed, 0 failed, 0 skipped (4,1 phút)**.
Ba ảnh lịch/export được khôi phục nguyên bytes sau chạy. API GitHub vẫn Forbidden;
chưa xác nhận kết quả workflow Windows mới.

Không đổi phiên bản 2.0.0, source ứng dụng, khóa ký hoặc schema để sửa các lỗi test
này. Native Windows/installer cần kết quả workflow mới sau push.

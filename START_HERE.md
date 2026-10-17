# Teacher Workspace V1.10.8 — Kênh cập nhật mới

**Chuẩn bị phát triển và cập nhật:** đọc [DEVELOPMENT.md](docs/DEVELOPMENT.md) và [AUTO_RELEASE.md](docs/AUTO_RELEASE.md). Bản 1.10.8 chuyển updater sang repository mã nguồn và khóa ký mới theo lựa chọn của chủ dự án. Cần cài bản chuyển tiếp một lần; các bản sau cập nhật trong app sau khi developer phát hành. Đây là mã đang chuẩn bị, chưa phải bộ cài Windows đã phát hành.

**Bản cập nhật mới nhất:** đọc `docs/UPDATE_V1.10.7.md` và `docs/TEST_REPORT_V1.10.7.md`. Cài đặt chia nhóm, thanh icon, nhiều API key luân phiên, tải/thử model và sửa xem trước bằng bộ 200 câu. Cần Node.js >=22.13; chạy `Build-Windows.cmd` cho bộ cài thông thường. Hướng dẫn chuyển sang bàn giao `.exe`: `docs/WINDOWS_INSTALLER.md`.

**Bản sửa ID nền:** đọc `docs/UPDATE_V1.10.3.md` và `docs/TEST_REPORT_V1.10.3.md`. Quy trình duyệt phân loại mới yêu cầu quét lại các đề xuất cũ thiếu dấu vân tay nguồn/cây; lịch sử và câu hỏi vẫn được giữ.

**Bản sửa build nền:** đọc `docs/BUILD_FIX_V1.10.2.md`. Giải nén vào thư mục mới rồi chạy `Build-Windows.cmd`. Giữ nguyên `Cargo.lock` và `rust-toolchain.toml`. Kết quả kiểm thử mới nhất ở `docs/TEST_REPORT_V1.10.2.md`.

Phiên bản tiếp tục từ V1.9.0. Đọc `docs/UPDATE_V1.10.0.md` để xem tính năng và `docs/TEST_REPORT_V1.10.0.md` để xem kết quả kiểm tra.

## Mở để phát triển

Mở toàn bộ thư mục có `package.json` bằng VS Code. Trong terminal:

```powershell
npm ci
npm run desktop:dev
```

Máy Windows cần Node.js >=22.13, Rust MSVC, Visual Studio C++ Build Tools/Windows SDK và WebView2. Muốn xem TikZ cần TeX Live. Các bước chuẩn bị chi tiết nằm trong README.md.

Chạy `npm run dev` để thử giao diện trong trình duyệt. Dữ liệu thử trong trình duyệt tách biệt với dữ liệu app Windows; trình duyệt không gọi TeX Live trên máy.

## Cập nhật ứng dụng đang dùng

1. Xuất backup lịch/workspace và backup ngân hàng từ app hiện tại.
2. Chép nội dung source này vào đúng gốc repository hiện có, giữ cấu hình phát hành riêng của anh khi đối chiếu file.
3. Commit/push bằng quy trình GitHub của dự án. Workflow **Windows checks and installer** sẽ kiểm tra rồi tạo installer nếu mọi bước đạt.
4. Hoặc chạy `Build-Windows.cmd` trên máy có bộ công cụ Windows để tạo installer cục bộ.
5. Dùng installer V1.10.7 trong `Cài đặt → Cập nhật từ file đã tải`.

Gói ZIP là mã nguồn đầy đủ. Phiên bàn giao này chưa build installer Windows. Giữ nguyên identifier `com.teacherworkspace.desktop` để app tiếp tục dùng dữ liệu cũ.

## Thử nhanh ngân hàng mới

- Mở **Ngân hàng câu hỏi**, nhập `examples/question-bank-smoke.tex`.
- Kiểm tra số câu, đáp án và ID6 trước khi lưu. File mẫu có 4 câu và không được tự chèn vào kho thật.
- Chọn câu để xem đề, mã LaTeX hoặc lịch sử. Bấm **Sửa** để xem mã và kết quả song song.
- Tích chọn câu → **Khay câu hỏi** → đổi thứ tự → **Tạo đề .tex**.
- Mở **Đề đã lưu** ở chân cửa sổ để xuất lại đúng phiên bản lúc tạo.

Ưu tiên tiếp theo: đo hiệu năng bằng ngân hàng thật của anh, kiểm tra native Windows/TeX Live với bộ khai báo riêng, rồi chuyển tìm kiếm/phân trang xuống SQLite khi cần.

## Kho đề mới

Mở **Kho đề & tài liệu → Bộ đề mới**, nhập .tex/PDF/cả thư mục rồi thao tác trên cây file. Bấm **Backup toàn bộ file** cho từng bộ đề để sao lưu; backup ngân hàng cũ không chứa Kho đề. Đọc giới hạn và quy trình duyệt KNTT trong `docs/UPDATE_V1.10.0.md`.

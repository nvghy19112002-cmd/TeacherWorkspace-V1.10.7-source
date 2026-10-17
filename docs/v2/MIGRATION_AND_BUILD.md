# Cài và phát triển Teacher Workspace V2

## Người dùng Windows

1. Trong bản đang dùng, xuất backup lịch, ngân hàng và kho tài liệu. Sao chép cả thư mục
   dự án TeX và ảnh ngoài sang nơi an toàn; JSON ngân hàng chứa metadata ảnh, không chứa
   bytes các file ảnh ngoài. Không gỡ app hoặc xóa thư mục dữ liệu để cập nhật.
2. Chỉ cài installer từ workflow/release đúng repository. Bản CI unsigned dùng để kiểm
   thử/cài chuyển tiếp thủ công, chưa phải bản cập nhật đã ký. Máy Linux này không tạo EXE.
3. Giữ nguyên identifier `com.teacherworkspace.desktop` và public key updater. App V1 dùng
   khóa/kênh cũ cần cài chuyển tiếp một lần. App thuộc cùng kênh mới chỉ cập nhật trong app
   sau khi release có installer, chữ ký `.sig` và `latest.json` hợp lệ đã công khai.
4. Mở app, so số câu, lịch và tài liệu với bản backup. Thử tìm câu cũ, preview, một đề
   đã lưu và một lần xuất/khôi phục trên dữ liệu kiểm thử trước khi dùng chính thức.

## Database

Migration 001/002 được giữ nguyên. 003 thêm FTS4 unicode61 và các chỉ mục; phiên bản
SQLite browser thực tế không có FTS5. 004 thêm `exams.matrix_json` với default rỗng,
không sửa rawSource hoặc ID câu cũ. Cả browser và native đọc được backup JSON v1 cũ.

Trước nâng schema native, app tạo `backups/before-migration-v{version}-{timestamp}.sqlite3`
cạnh database bằng VACUUM INTO (gồm dữ liệu WAL), mở read-only và quick_check trước
khi tiếp tục. Browser giữ bytes trước nâng trong IndexedDB cùng transaction với bản mới.
Không mở DB schema mới bằng app cũ: app chặn database mới hơn để tránh ghi sai.

Nếu cần phục hồi: đóng app, sao chép toàn bộ thư mục dữ liệu hiện tại trước, dùng bản
backup tương ứng và app tương ứng. Không xóa/ghi đè DB duy nhất. Khôi phục JSON trong
Cài đặt yêu cầu lưu bản sao dữ liệu hiện tại trước khi thay thế. Backup sản xuất thật
chưa được cung cấp để xác nhận trong môi trường này.

## Chạy từ mã nguồn

Node >=22.13, npm, Rust 1.95.0 theo rust-toolchain.toml. Trên Windows cần Visual Studio
Build Tools với Desktop development with C++, Windows SDK và WebView2 runtime.

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run desktop:build -- --config src-tauri/tauri.ci.conf.json -- --locked
```

Bộ cài CI nằm trong `src-tauri/target/release/bundle/nsis/`. TeX Live/xelatex và preamble
dự án cần được thiết lập trong Cài đặt → TeX Live để biên dịch hình thật. Preview nhanh
không thay thế kiểm tra tài liệu TeX cuối cùng.

Linux browser: `npm run dev`; E2E cloud dùng
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`.
Test raster corpus tùy chọn cần `CORPUS_TEX_DIR` trỏ thư mục PDF corpus thật.
`scripts/compile-preview-corpus.py` xuất báo cáo từng hình và trả lỗi nếu còn ca lỗi.

Isolated Rust DB verification cho máy Linux thiếu GTK/WebKit:
`python scripts/check-native-db.py --cargo /path/to/cargo --target-dir /path/to/target`.
Lệnh này kiểm tra DB thật nhưng không thay cho Tauri IPC/native Windows suite.

## Phát hành cập nhật đã ký

Xem [AUTO_RELEASE.md](../AUTO_RELEASE.md). Giữ khóa riêng có sẵn ngoài Git; không tạo
khóa mới, không thêm khóa vào source ZIP hoặc log. GitHub Actions secret phải có tên
`TAURI_SIGNING_PRIVATE_KEY` trong **Settings → Secrets and variables → Actions**,
không phải Agent secrets. Không cần mật khẩu nếu khóa hiện có không được mã hóa.

Khi main đã chứa bản V2 và toàn bộ Windows checks thành công, chạy workflow
**Publish Windows update** trên main. Workflow kiểm tra kênh public, secret, bản dựng,
chữ ký và artifacts trước khi publish. Không tạo lại tag/ghi đè release 1.10.8.
Máy cloud hiện bị proxy từ chối API GitHub nên chưa xác nhận secret, visibility,
workflow kết quả, release công khai hoặc vòng nâng cấp trên máy Windows thật.

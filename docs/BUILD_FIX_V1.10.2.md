# Bản sửa build 1.10.2

## Hai lỗi đã xác định

1. Kiểm tra XeLaTeX dùng timeout mặc định 5 giây. Bản này giữ sửa từ 1.10.1: 45 giây riêng nhóm kiểm tra TeX, tiến trình TeX vẫn giới hạn 30 giây và phải tạo PDF hợp lệ.
2. Cargo chọn updater 2.0.0 và vướng `zip ^2` đã bị yanked. Bản này ghim Tauri và các plugin, bổ sung Cargo.lock cho toàn bộ phụ thuộc, dùng `--locked` trong kiểm tra/build. Updater được ghim 2.11.0, khớp gói JavaScript; tắt tính năng tương thích bundle ZIP của Tauri v1 vì kênh cập nhật hiện dùng installer NSIS `.exe` có chữ ký.

Tauri native 2.12.4 khớp API JavaScript 2.12.4; CLI được ghim 2.12.3. Bộ runtime 2.12.2, macros/codegen/build 2.7.3 và utils 2.10.2 được giữ nhất quán trong Cargo.lock. Plugin dialog/fs/process cũng khớp phiên bản trong package-lock.json. `rust-toolchain.toml` chọn Rust 1.95.0 để build dùng cùng toolchain. Máy dùng rustup sẽ tự tải toolchain khi chạy Cargo; lần đầu cần internet.

## Cách build

1. Giải nén bản này vào thư mục mới. Không chép đè lên node_modules hoặc target của bản cũ.
2. Mở thư mục có package.json và chạy Build-Windows.cmd.
3. Chờ tải bộ Rust/phụ thuộc ở lượt đầu. Khi thành công, thư mục installer sẽ tự mở.

Không xóa Cargo.lock. Không chạy cargo update để xử lý lỗi. Không cần xóa dữ liệu ứng dụng hoặc cài lại TeX Live cho hai lỗi trên. Identifier ứng dụng được giữ nguyên.

Máy Windows cần Node.js 22.12+, Rust qua rustup, MSVC C++ Build Tools/Windows SDK và WebView2. TeX Live cần cho biên dịch tài liệu. Build thông thường tạo installer chưa ký bản quyền Windows; build kênh updater có quy trình ký riêng như trước.

## Bảo vệ quy trình build

Build-Windows.cmd chạy `scripts/check-native-lock.mjs` và `cargo fetch --locked` trước npm ci. Kiểm tra này phát hiện source thiếu lockfile, phiên bản không khớp và phụ thuộc zip 2 không được hỗ trợ ngay từ đầu. Các workflow Windows và build ký updater cũng dùng lockfile.

Bản này tập trung sửa build, giữ tính năng và dữ liệu của 1.10.0. Chưa triển khai các tính năng đã dự kiến cho 1.11–1.13.

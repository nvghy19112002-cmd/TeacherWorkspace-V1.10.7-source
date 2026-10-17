# Kết quả kiểm tra V1.10.2 · 16/10/2026

## Đã đạt trên đúng bộ phụ thuộc cuối

- Cài lại npm từ lockfile, sau đó đồng bộ API Tauri 2.12.4 và CLI 2.12.3.
- ESLint: đạt, không có cảnh báo JavaScript/TypeScript.
- Vitest: 161/161 kiểm tra đạt, gồm 6 kiểm tra TeX Live thật.
- Playwright: 12/12 luồng giao diện đạt sau cập nhật Tauri.
- TypeScript và Vite production build: đạt.
- Cargo/Rust: biên dịch mã ứng dụng và 8/8 unit tests native đạt trên Linux. Bao gồm migration/revision guard, rollback, backup SQLite có WAL, kiểm tra tên installer và đường dẫn dự án.
- `cargo fetch --locked --target x86_64-pc-windows-msvc`: đạt với Cargo.lock cuối.
- `node scripts/check-native-lock.mjs`: đạt.

## Bộ phiên bản

Rust 1.95.0; Tauri native/API 2.12.4; CLI 2.12.3; runtime/runtime-wry 2.12.2; macros/codegen/build 2.7.3; utils 2.10.2. Plugin updater Rust/JS giữ 2.11.0, không bật bundle ZIP tương thích Tauri v1. Cargo.lock chứa đầy đủ phụ thuộc và không chứa zip 2.

Việc chỉ ghim Tauri 2.11.1 trong lần kiểm tra trung gian vẫn cho phép kéo runtime/macros mới không tương thích. Bản cuối đồng bộ lên 2.12 và đã kiểm tra lại mã Rust, không sử dụng bộ trung gian đó.

## Giới hạn của xác minh

Chưa chạy Windows MSVC, chưa tạo/chạy installer NSIS .exe và chưa kiểm tra Credential Manager/WebView2 trên Windows. Vì vậy không cam kết toàn bộ máy Windows sẽ build thành công bất kể bộ công cụ đã cài.

Môi trường Linux dùng sysroot GTK/WebKit riêng. Để tránh lỗi tạo archive cục bộ, lượt cargo test dùng codegen-units=1 cho ba dependency tauri-utils, gtk, zbus; các override chỉ phục vụ lượt kiểm tra Linux, không được đưa vào cấu hình build Windows. Có ba cảnh báo Rust về import/tham số chỉ sử dụng trên Windows, không làm thất bại kiểm tra.

Hai lỗi đã gửi qua ảnh được xử lý: giới hạn thời gian kiểm tra XeLaTeX và Cargo chọn updater cũ phụ thuộc zip 2 đã bị yanked. Bản này bổ sung cả khóa phiên bản, kiểm tra lockfile và đồng bộ SDK Rust/JavaScript.

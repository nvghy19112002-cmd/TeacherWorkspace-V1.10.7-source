# Kiểm tra V1.10.0 · 16/10/2026

- ESLint: đạt, không có cảnh báo.
- TypeScript và Vite production build: đạt.
- Vitest: **161/161** kiểm tra, 17 tệp. Gồm bảo toàn LaTeX, dữ liệu SQLite, ID khóa, backup tài liệu, tránh trùng tên/cây lặp, khôi phục nhánh và duyệt KNTT với kiểm tra phiên bản câu.
- Playwright: **12/12** luồng giao diện đạt trong một lượt đầy đủ. Sau đó chạy lại phần Kho đề và bổ sung kiểm tra chuyển đề snapshot sang Kho đề; luồng tích hợp mới đạt riêng. Các lần kiểm tra ban đầu phát hiện lỗi mở IndexedDB và đã được sửa trước bàn giao.
- TeX Live thật: 6 kiểm tra đạt trên Linux, gồm tiếng Việt/TikZ và dự án đầy đủ với file input con, thư mục output riêng, tắt shell escape. Đây là kiểm tra dòng lệnh TeX, không thay thế build/native bridge Windows.
- Giao diện Kho đề đã xem ảnh ở 1440×1000 và 1024×768; chiều rộng trang không vượt 1024 tại kích thước nhỏ.

## Chưa xác minh

Môi trường này không có Rust/Cargo và Windows toolchain: chưa chạy cargo test, chưa build installer .exe, chưa chạy lệnh Tauri mới trên Windows/WebView2. Workflow Windows đã có các bước này nhưng chưa được kích hoạt trong phiên bàn giao.

Không gọi Gemini bằng API key thật và chưa có bộ câu hỏi chuẩn giáo viên gán nhãn để đo độ chính xác. Kiểm tra KNTT bảo đảm cấu trúc/mối liên kết và chống áp dụng đề xuất lỗi thời; không chứng minh AI đúng chuyên môn 100%. Danh mục dạng cần giáo viên đối chiếu trước khi sử dụng. PDF được xem, chưa OCR hoặc tách câu tự động.

## Chạy trên máy phát triển

```powershell
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:dev
```

Trên app Windows, nên thử một bộ đề có hình, `input`/`includegraphics`, main trong thư mục con, lỗi LaTeX, nút dừng và PDF trước khi dùng với kho chính. Xuất backup lịch/ngân hàng và backup riêng từng bộ đề.

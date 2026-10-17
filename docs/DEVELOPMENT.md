# Phát triển Teacher Workspace

## Chạy trong môi trường đám mây

Node.js >=22.13; môi trường đã chuẩn bị Node 24, Chromium và TeX Live.

```bash
cd /workspace/TeacherWorkspace-V1.10.7-source
npm ci --cache /workspace/.npm
npm run dev
```

Dùng checkout hiện có. SQLite WASM trong trình duyệt tách biệt với SQLite của app Windows. Browser không gọi lệnh TeX native; kiểm thử Node vẫn có thể biên dịch TeX bằng pdflatex/xelatex.

```bash
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

`check` gồm lint, Vitest, kiểm thử kênh/chữ ký phát hành, TypeScript và production build. Trước E2E, sao lưu ba file docs/screenshots/calendar-dark.png, calendar-light.png, export-a4-print.png ra thư mục tạm; khôi phục đúng nội dung sau khi chạy, kể cả khi lỗi. Các bài E2E tạo lại các file này. Một bài rasterize toàn bộ corpus yêu cầu CORPUS_TEX_DIR và 237 PDF đã biên dịch; bỏ qua bài này không đồng nghĩa đã kiểm thử corpus PDF đầy đủ.

## Desktop Windows

Windows cần Node >=22.13, Rust 1.95.0, MSVC Build Tools/Windows SDK và WebView2. TeX Live cần cho tính năng biên dịch tài liệu. Dùng `npm run desktop:dev` để phát triển. CI `Windows checks and installer` chạy native Rust tests và tạo installer CI; installer đó không phải kênh cập nhật có chữ ký.

## Quy trình thay đổi

1. Mô tả thay đổi, giữ nguyên identifier, khóa updater và migration đã phát hành.
2. Sửa mã, thêm kiểm thử cho hành vi thay đổi; chạy các kiểm tra liên quan.
3. Khi chuẩn bị phát hành: đồng bộ phiên bản bằng `npm run release:version -- x.y.z`, viết ghi chú, chạy `npm run check` và E2E.
4. Đưa commit lên repository, tạo tag phiên bản hoặc chạy workflow phát hành theo docs/AUTO_RELEASE.md.
5. Chờ pipeline Windows thành công; thử cài/cập nhật trên máy Windows với bản sao dữ liệu trước khi xác nhận bản phát hành hoạt động thực tế.

Người dùng chỉ cần nút cập nhật sau khi bản mới đã được developer phát hành. Nút này không tự sửa mã hoặc tạo release từ commit.

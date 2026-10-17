# Bắt đầu với Teacher Workspace 2.0.0

Đây là **mã nguồn**, chưa phải bộ cài Windows đã được xác thực.

## Muốn dùng bản cập nhật

1. Xuất backup dữ liệu trong app đang dùng; giữ riêng thư mục dự án TeX và ảnh.
2. Trên GitHub repository này, mở **Actions → Windows checks and installer**.
3. Chọn lần chạy của commit V2 mới nhất. Khi thành công, tải artifact
   **TeacherWorkspace-Windows-x64-CI-unsigned**, giải nén và chạy file `*-setup.exe`
   trên Windows để kiểm thử/cài thủ công. Không cài file ZIP mã nguồn bằng nút cập nhật.
4. Để các lần sau cập nhật ngay trong app, cần bản phát hành đã ký từ workflow
   **Publish Windows update**. Secret ký phải được thiết lập trong GitHub Actions.
   Xem [hướng dẫn phát hành](docs/AUTO_RELEASE.md).

App dùng kênh/khóa cũ cần cài chuyển tiếp thủ công một lần. Không gỡ app hoặc xóa dữ
liệu cũ. Chỉ gọi là đã phát hành khi workflow và release công khai thực sự thành công.

## Tính năng V2 để thử

- Ngân hàng: nhập/dán LaTeX, tìm tiếng Việt không dấu, phân trang, chỉnh sửa và lịch sử.
- Chọn câu → AI phân loại: quét, tạm dừng/tiếp tục, đọc lý do, sửa/từ chối rồi duyệt ID.
- Tạo đề: chọn các ô ma trận, kiểm tra đủ/thiếu, xem câu thật, lưu đề và xuất lại snapshot.
- Cài đặt: 11 nhóm, prompt phiên bản, model diagnostics, cache, TeX, backup và cập nhật.
- Kéo vạch giữa các khung ngân hàng; mở rộng thanh điều hướng; bố cục được lưu trên máy.

Chạy mẫu `examples/question-bank-smoke.tex` trong dữ liệu kiểm thử riêng, không tự
chèn fixture vào kho câu thật. AI chưa được chứng nhận độ chính xác bằng nhãn giáo viên.

## Muốn tiếp tục phát triển

Mở toàn bộ thư mục có package.json bằng VS Code. Node >=22.13:

```bash
npm ci
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
```

Chạy app Windows từ source: `npm run desktop:dev`, cần Rust MSVC, C++ Build Tools,
Windows SDK và WebView2. Hướng dẫn đầy đủ trong
[Migration & Build](docs/v2/MIGRATION_AND_BUILD.md).

## Tài liệu bàn giao

- [Changelog V2](docs/v2/CHANGELOG.md)
- [Báo cáo kiểm thử](docs/v2/TEST_REPORT.md)
- [Danh sách thay đổi](docs/v2/CHANGED_FILES.md)
- [Phần còn cần xác nhận](docs/v2/KNOWN_LIMITATIONS.md)
- [Quy trình phát triển](docs/DEVELOPMENT.md)

Giữ nguyên Cargo.lock, rust-toolchain.toml và các migration đã có. Không đưa khóa ký
riêng hoặc database thật vào repository hay ZIP nguồn.

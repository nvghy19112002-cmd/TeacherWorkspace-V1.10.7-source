# Kiểm thử Teacher Workspace 1.10.7

Ngày bàn giao: 17/10/2026 (Việt Nam). Môi trường Linux, trình duyệt Chromium, TeX Live cục bộ. Không có máy Windows hoặc API key Gemini thật trong lượt kiểm tra này.

## Mẫu thực tế

Tệp người dùng cung cấp được giữ nguyên ở `tests/data/preview-200.tex`.

- SHA-256: `b3b87da0df86e523c637e42ef2fc4b979f1b487423f38cbccacc1758f416400d`.
- 200 câu: 157 trắc nghiệm, 15 đúng/sai, 23 trả lời ngắn, 5 câu còn lại.
- 239 khối tikzpicture, tương ứng 238 hình độc lập; một khối là nội dung macro chú thích.
- Tất cả câu được render bằng React/KaTeX cả trong kiểm thử đơn vị và trình duyệt. Đủ phương án, giữ lời giải có nội dung, giữ 238 vị trí hình; 3 bảng được hiển thị. Không có lỗi KaTeX, lộ lệnh TeX trong phần chữ hoặc tràn khung ngoài ở khung thử rộng 720 px.
- Lượt đầu XeLaTeX: 235/238 hình đạt. Sau bổ sung gói tikz-3dplot, dựng lại hai hình 3D đạt: tổng 237/238. Các PDF được kiểm tra crop bằng pdfinfo.
- Bộ PDF.js của ứng dụng đã chuyển thành công toàn bộ 237 PDF thành PNG; kiểm tra này chạy riêng khoảng 2,8 phút. Đã xem ảnh mẫu biểu đồ thật với nhãn tiếng Việt và đáp án để kiểm tra trình bày. Đây là kiểm tra renderer trong Chromium, không phải xác nhận mọi hình đã được nhìn bằng mắt hay đã thử trên WebView2 Windows.
- Hình 49, thuộc câu 37, ID nguồn `0D1N2-3`: thiếu khai báo `IntervalLR`/`IntervalGRF`. Không tự suy đoán hay sửa mã gốc. Cần đưa khai báo gốc vào Cài đặt → TeX Live → Khai báo bổ sung / bộ khai báo riêng.
- Kiểm tra riêng môi trường eqnarray cùng hoac theo loại lỗi trong ảnh người dùng.

## Kiểm tra tự động

- `npm run check`: lint không cảnh báo, 198/198 bài kiểm tra trong 26 tệp, TypeScript và bản build Vite đạt.
- Playwright thông thường: 18 bài đạt; bài raster toàn bộ corpus được bỏ qua mặc định vì cần các PDF đã dựng. Bài này đã chạy riêng và đạt cùng bài đọc 200 câu, tổng 19 kịch bản khác nhau đã qua kiểm tra.
- Kiểm tra danh sách model phân trang, lọc generateContent, phép thử JSON không ép temperature, báo chi tiết HTTP đã che key.
- Kiểm tra luân phiên key trên yêu cầu AI Tools thật của lớp dịch vụ, chuyển key do 429, dừng do lỗi model 404 và không dùng lại key default bị tắt.
- Kiểm tra giao diện Cài đặt: đủ 5 nhóm, thêm nhiều key bỏ trùng, bật/tắt/chọn chính sách, tải/chọn/lưu/thử model với phản hồi mô phỏng; không tràn ngang ở 1024 × 768.
- Kiểm tra hồi quy thao tác lịch, đổi giao diện, xuất ảnh/in, backup/restore, tài liệu, ngân hàng câu hỏi, gán/duyệt ID và chuyển tab.
- `node scripts/check-native-lock.mjs`: đạt, phiên bản 1.10.7 đồng bộ package/npm lock/Tauri/Cargo lock.

## Chạy lại corpus

```bash
npx vitest run tests/preview-corpus.test.ts
python3 scripts/check-preview-corpus.py --output /duong-dan-rieng/tex-corpus
```

Script biên dịch trả mã lỗi khác 0 khi còn hình thiếu macro; báo cáo JSON liệt kê từng hình. Nên để thư mục output bên ngoài test-results vì Playwright làm sạch test-results khi bắt đầu.

Sau đó, trên bash:

```bash
CORPUS_TEX_DIR=/duong-dan-rieng/tex-corpus npm run test:e2e -- tests/e2e/preview-corpus.spec.ts
```

Trên PowerShell đặt `$env:CORPUS_TEX_DIR='D:\qa\tex-corpus'` trước khi chạy lệnh npm tương ứng. Không cần đưa các PDF trung gian vào bản cài.

## Giới hạn xác minh

Chưa build/chạy installer Windows, chưa chạy native test lại trong bản này (không đổi mã Rust, chỉ đồng bộ phiên bản), chưa thử Gemini thật, chưa xác nhận nguyên nhân cụ thể lỗi 3.8 của tài khoản người dùng. Mục lục và dữ liệu phân loại KNTT giữ phạm vi như 1.10.6; không bổ sung các dạng bài chưa có dữ liệu và không cam kết ID đúng 100%.

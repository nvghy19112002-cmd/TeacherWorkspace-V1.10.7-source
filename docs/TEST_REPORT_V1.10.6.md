# Kiểm tra V1.10.6 — 17/10/2026

- npm ci từ lockfile mới; PDF.js 6.4.299 được cố định phiên bản. Node tối thiểu đồng bộ 22.13.
- npm run check: lint, TypeScript, 189/189 kiểm tra trong 23 tệp và Vite production build đạt.
- Playwright: 16/16 luồng đạt; luồng thao tác ngân hàng được chạy lại sau điều chỉnh nhãn/nút và thêm kiểm tra nguồn nhập, vẫn đạt.
- Native lock check đạt, phiên bản 1.10.6 đồng bộ. Không thay mã native Rust.

## Bằng chứng chính

- pdf-figure.spec.ts tạo PDF TikZ thật bằng pdfLaTeX, đưa byte PDF qua chính dịch vụ dựng ảnh trong trình duyệt. Xác nhận PNG, kích thước hơn 200×100 px, hơn 1.000 pixel không trắng, và sử dụng đúng cache. Đây là dựng ảnh thực tế, không trả ảnh giả lập.
- bank-actions.spec.ts kiểm tra cỡ chữ 16 px, chuyển câu/Chọn & tiếp, giữ khay khi đổi sang Công việc rồi quay lại; đổi lớp xóa các cấp con; đổi nhóm giữ lớp; lọc đúng nguồn file-a.tex; gán ID hàng loạt và xác nhận cuối vẫn giữ LaTeX/UUID.
- Các luồng nhập/dán, sửa, xóa/khôi phục, xem mã, sao chép, tạo đề/xuất snapshot, duyệt ID, quét lỗi/thử lại, chuyển tab và các module lịch/tài liệu tiếp tục đạt.
- Kiểm tra không tràn ngang ở 1024×768. Cây lọc mở riêng vẫn nhìn thấy nút mở ở màn hình nhỏ sau khi sắp lại nhóm lọc; đã xem ảnh QA nội bộ.
- Các kiểm tra TeX thật của 1.10.5 vẫn đạt: TikZ cắt sát, công thức, tiếng Việt, nhiều câu.

## Giới hạn

Chưa build installer hoặc chạy app WebView Windows. Bộ vẽ PNG đã chạy thật trong Chromium; chưa xác nhận trên mọi phiên bản WebView2/máy TeX Live của người dùng. Hình vẫn cần đủ gói và khai báo của TeX Live; tài nguyên ngoài/macro tùy chỉnh có thể cần PDF toàn câu để đối chiếu.

Không gọi Gemini bằng API key thật hoặc đo lại độ đúng chuyên môn; quy trình ID giữ từ 1.10.5. Dạng/YCCD còn thiếu không được tự tạo trong bản sửa này. Khay giữ trong bộ nhớ của phiên app, không coi là bản sao lưu.

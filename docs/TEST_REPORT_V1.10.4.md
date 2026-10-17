# Kiểm tra V1.10.4 — 16/10/2026

- npm ci từ lockfile; không dùng lại node_modules của bản cũ.
- npm run check: lint không cảnh báo, TypeScript, 180/180 kiểm tra trong 19 tệp và Vite production build đạt.
- Playwright: 14/14 luồng giao diện đạt, gồm luồng mới về chuyển tab và cây KNTT.
- Kiểm tra mới cố tình giữ yêu cầu tải module ngân hàng để xác nhận trang cũ và nhãn điều hướng vẫn đồng bộ trong khi chờ. Sau khi mở ngân hàng, đổi qua Công việc, Thời khóa biểu rồi quay lại; chiều rộng thanh bên, vị trí nội dung và chiều cao thanh trên giữ nguyên.
- Cây chính và quản lý mục lục mặc định có đúng ba gốc KNTT. Thử bật/tắt các cây cũ; thống kê mỗi lớp đúng số chương/bài đã đóng gói.
- Kiểm tra 1024×768: không tràn ngang; cả ba lớp nhìn thấy trong cây. Đã xem ảnh QA nội bộ. Điều chỉnh vùng cuộn để cây không bị ép về chiều cao 0.
- Kiểm tra ngữ cảnh AI chứa cùng các nút KNTT như giao diện: 24 chương, 79 bài; chuỗi số bài lớp 10 là 1–27, lớp 11 là 1–33, lớp 12 là 1–19; loại các cây cũ khỏi yêu cầu AI.
- Kiểm tra tổng hợp lớp của câu hỏi đã gắn cây cũ hoặc chỉ có mã ID6, không viết lại câu hỏi hay tự ánh xạ số chương/bài giữa hai cây.
- Luồng ID trước đó tiếp tục đạt: lỗi JSON, thử lại, ghép lại mã từ đường dẫn đúng, giáo viên đổi dạng/mức độ rồi xác nhận, lưu và tải lại; LaTeX và UUID được giữ.
- node scripts/check-native-lock.mjs đạt; phiên bản package và lockfile đã đồng bộ 1.10.4.

## Giới hạn xác minh

Không dùng API key Gemini thật, không đo độ chính xác phân loại chuyên môn bằng tập câu gán nhãn chuẩn. Tệp mục lục KNTT là dữ liệu người dùng đã cung cấp, chưa đối chiếu mới với nguồn nhà xuất bản. Dạng bài/YCCD vẫn chưa đầy đủ; giao diện nêu rõ phần thiếu.

Không tạo installer Windows, không chạy native Rust trong lần sửa giao diện này. Mã native và SDK/toolchain giữ từ bản sửa build 1.10.2; chỉ tăng phiên bản ứng dụng/lockfile. Các kết quả trên không thay thế kiểm tra thực tế trên máy Windows của người dùng.

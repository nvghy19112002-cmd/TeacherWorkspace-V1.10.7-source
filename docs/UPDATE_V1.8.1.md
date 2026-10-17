# Teacher Workspace V1.8.1

## Cây MathHub

- Cây ID6 6–12: 875 nút, gồm lớp, mạch, chương, bài, dạng. Đây là cây đang dùng để phân loại câu trong ngân hàng.
- Cây ID6 THPT: 671 nút; KNTT 1–5: 86 nút; KNTT 6–12: 308 nút; ID BTpro: 2.888 nút. Có thể tra cứu nguyên tên, mã, thứ tự và cấp con trong Cây chương trình → Xem đủ 5 cây MathHub. Các hệ mã riêng được giữ độc lập.
- Khi cập nhật một ngân hàng hiện có, app bổ sung các nhánh ID6 chưa có theo mã đường dẫn. ID nút, tên do giáo viên sửa, các câu hỏi, yêu cầu cần đạt và nhánh tự tạo trước đó được giữ lại. Không thay đổi mã hay lời giải của câu hỏi.
- Câu `.tex` mới có ID6 hợp lệ sẽ được gắn đường dẫn nút khi nhập. Câu cũ còn ID6 nhưng thiếu liên kết vẫn lọc được theo cây; app tính đường dẫn khi hiển thị thay vì viết lại toàn bộ các hàng câu hỏi.
- Các tệp JSON người dùng cung cấp là bản xuất; app không truy cập hay sửa ngân hàng dữ liệu của MathHub. Nếu cây trong MathHub thay đổi sau ngày xuất, cần nhập lại bản xuất mới để có dữ liệu mới.

## Xem trước

- Công thức đơn giản hiển thị ngay. Câu có `\immini`, TikZ/PGFPlots, ảnh, bảng hoặc danh sách tự biên dịch PDF bằng TeX Live trên Windows khi chọn câu.
- Câu đang biên dịch có trạng thái rõ ràng; PDF nằm ngay trong khung chi tiết. Mở **Biên dịch chi tiết** để lưu PDF, đổi engine, khai báo hoặc xem log lỗi. Ảnh tham chiếu ngoài cần đặt đúng thư mục project trong thiết lập TeX Live.
- Trên trình duyệt, tính năng này không có quyền gọi TeX Live; khung báo rõ chỉ xem được trong ứng dụng Windows.

## Cài đặt

Đưa nội dung thư mục `TeacherWorkspace-V1.8.1-source` vào **thư mục gốc project** hiện tại, rồi commit và push. GitHub Actions chạy kiểm tra và tạo installer Windows ở Artifacts nếu tất cả bước đạt. Cây được bổ sung vào dữ liệu trên máy khi mở bản mới; nên sao lưu dữ liệu ngân hàng trước khi nâng cấp.

## Kiểm chứng

Chạy `npm ci`, `npm run check` và `npm run test:e2e` trên máy có Chromium Playwright; CI Windows còn chạy `cargo test` và build Tauri. Kiểm thử thực tế bằng `pdflatex` có câu chứa `\immini`, `itemize` và TikZ. Bản nguồn không phải installer đã biên dịch sẵn.

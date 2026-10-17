# Teacher Workspace V1.8.2 — Ngân hàng câu hỏi

## Cây mục lục

Mở **Ngân hàng câu hỏi → Cây mục lục**. Cây phân loại ID6 đang dùng có 875 nút theo cấp lớp → mạch → chương → bài → dạng; nhấn mũi tên để mở nhánh, gõ mã hoặc tên để tìm. **Xem đủ 5 cây MathHub** mở các bản xuất tham khảo: ID6 6–12, ID6 THPT, Toán KNTT 1–5, Toán KNTT 6–12, ID BTpro. Các hệ mã này khác nhau; bốn bản tham khảo không tự ghi đè cây đang dùng.

Tên và mô tả nút có thể sửa. Mã, cấp và nút cha của nút đã lưu không được thay trực tiếp vì các câu hỏi có thể đang liên kết với nút đó. Thêm một nút mới khi cần một mã hoặc cấp khác. App chặn hai nút cùng mã dưới một nút cha.

Tệp ID6 THPT tham khảo của gói V1.8.1 bị cắt giữa nội dung JSON. Gói V1.8.2 dùng lại bản xuất đầy đủ và đã xác thực cả năm tệp.

## Quy tắc ID6

Ví dụ `0D1H1-1-001`: `0` là lớp 10 (1 là lớp 11, 2 là lớp 12), `D` là mạch, `1` là chương, `H` là mức Thông hiểu, `1` là bài, `1` là dạng; `001` là số thứ tự câu. Mã phân loại là `0D1H1-1`, còn số thứ tự trong ngân hàng được cấp riêng khi gắn ID hiển thị. Mức độ N/H/V/C được đối chiếu với cây được cung cấp. Một mã phân loại có thể được nhiều câu dùng; ID nguồn đầy đủ có số thứ tự trùng với một câu khác được cảnh báo khi nhập.

Chỉ đọc phần đầu câu trước đáp án/lời giải. Nhận ID trong `\begin{ex}[ID]`, chú thích `%[ID]`, `% ID: ID`, nhãn `\label{ID}` và lệnh `\id{ID}` hoặc `\maID{ID}`. App kiểm tra đủ đường dẫn theo cây ID6; mã sai, đường dẫn thiếu hoặc nhiều mã khác nhau được báo để phân loại thủ công. Không đoán một mã từ lời giải và không tự chọn khi gặp nhiều mã.

Khi **Nhập .tex**, app gắn đường dẫn cây cho ID6 hợp lệ và ghi số câu đã gắn trong phần kiểm tra trước khi nhập. Khi **Sửa → Đọc thông tin từ LaTeX**, app cập nhật loại câu, đáp án, lời giải và đường dẫn ID6 hợp lệ trong bản nháp. Nếu ID cũ đã khóa do được dùng trong đề thì không đổi phân loại. Mã LaTeX gốc và UUID của câu vẫn giữ nguyên.

## Duyệt dữ liệu

Bộ lọc mới gồm trạng thái duyệt, thiếu ID6, đã gắn cây và có cảnh báo. Nhánh chưa có ID hoặc ID không hợp lệ có thể được xử lý trước. Bảng vẫn giữ thứ tự câu và chọn nhiều câu để biên dịch TeX Live theo thứ tự đã chọn.

## Cập nhật và kiểm chứng

Giải nén nội dung thư mục `TeacherWorkspace-V1.8.2-source` lên thư mục gốc dự án, commit/push để GitHub Actions build installer Windows. Sao lưu dữ liệu ứng dụng trước khi cài installer mới; bản cập nhật thêm cây nhưng giữ câu cũ và liên kết có sẵn. Các bước `npm run check` chạy TypeScript, ESLint, kiểm thử miền dữ liệu và build web; E2E Chromium, Rust và installer chạy trong workflow Windows sau khi push. Tệp ZIP là **mã nguồn**, chưa phải installer Windows.

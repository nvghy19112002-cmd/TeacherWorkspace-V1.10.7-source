# Rà soát chất lượng Ngân hàng câu hỏi và gán ID

## Nguyên tắc sản phẩm

- Một kho SQLite do ứng dụng quản lý chứa câu hỏi, LaTeX, lịch sử sửa, kết quả AI, đề thi và chỉ mục tìm kiếm.
- `source` là nhãn nguồn logic (tệp nhập, bộ MathHub, nội dung dán); giáo viên có thể trộn nhiều nguồn trong một đề mà không sao chép file thủ công.
- Luồng chính là: nhập/dán → AI xử lý ID → áp dụng đề xuất đủ điều kiện → giáo viên chỉ xem ngoại lệ.
- LaTeX gốc là nguồn chân lý; trình phân tích không tự sửa nội dung toán học.

## Các bảo vệ đã có

- SQLite transaction, revision guard, backup trước migration và backup trước cập nhật.
- Tìm kiếm FTS, phân trang và virtual scrolling cho ngân hàng lớn.
- Giữ nguyên nguồn LaTeX, snapshot đề và lịch sử sửa.
- Kiểm tra ID theo cây, khóa ID đã dùng trong đề, phát hiện ID nguồn trùng và câu trùng.
- AI dùng JSON schema, kiểm tra ID trả về, checkpoint, retry và model dự phòng; không tự áp dụng khi dữ liệu sai hoặc ngoài phạm vi.
- Xem trước nhanh và biên dịch TeX Live cho TikZ/bố cục thật.

## Điều chỉnh trong đợt rà soát này

- Không còn hiểu nhầm ghi chú ngoặc vuông như năm, tên đề hoặc ghi chú biên tập thành ID6.
- Không cấp lại số thứ tự đã tồn tại trong dữ liệu cũ khi `sequenceNumber` bị thiếu.
- Nhận dạng loại câu chỉ đọc phần đề, không bị `choice` hoặc danh sách trong lời giải làm sai loại.
- Cờ “có hình” bỏ qua mã đã comment và nhận thêm các môi trường hình phổ biến.
- Thêm hành động **AI xử lý ID** cho toàn bộ câu chưa có ID; tự chia lô tối đa 1.000 câu và giữ checkpoint.

## Việc còn lại để đạt mức cao nhất

1. Màn hình **Nguồn dữ liệu**: đổi tên/gộp nguồn logic, thống kê số câu và dung lượng, nhập thêm, sao lưu và kiểm tra toàn vẹn. File SQLite vẫn do ứng dụng quản lý để tránh mất liên kết.
2. Gửi ảnh render của TikZ/PDF cho model đa phương thức. Hiện AI chỉ đọc mã TikZ; câu có hình luôn được đưa vào diện giáo viên đối chiếu.
3. Hoàn thiện danh mục dạng bài và yêu cầu cần đạt cho mọi bài KNTT. AI không được ép chọn khi danh mục còn thiếu.
4. Kiểm tra chất lượng nền: phát hiện câu thiếu đáp án, đáp án mâu thuẫn lời giải, tài nguyên ngoài bị mất và lỗi biên dịch; hiển thị thành một hàng đợi ngoại lệ.
5. Kiểm tra hiệu năng và phục hồi với kho thực tế 60.000–100.000 câu trên Windows, gồm thời gian mở kho, tìm kiếm, backup và rebuild FTS.


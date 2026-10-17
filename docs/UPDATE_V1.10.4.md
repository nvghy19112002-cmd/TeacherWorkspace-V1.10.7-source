# V1.10.4 — Chuyển tab đồng bộ và mục lục KNTT gọn

## Thay đổi

- Khung điều hướng và thanh trên giữ cùng kích thước/màu ở mọi tab. Bỏ khung riêng 76 px và thanh trên 38 px của ngân hàng; dùng khung chung của ứng dụng.
- Khi trang mới còn tải, tiếp tục hiển thị trang hiện tại cùng nhãn điều hướng tương ứng. Trang ngân hàng tải mã và dữ liệu trước khi chuyển; bỏ lần đọc lại ngân hàng không cần thiết mỗi lần quay về.
- Cây thư viện và bộ lọc chính chỉ dùng cây KNTT Toán lớp 10, 11, 12. Không xóa các nút cũ hoặc đổi liên kết câu hỏi, LaTeX và ID đã lưu.
- Tổng số theo lớp vẫn tính câu hỏi đã gắn các cây cũ cùng lớp. Cấp chương/bài/dạng chỉ lọc theo liên kết KNTT thật; không tự coi số bài của cây cũ là số bài KNTT.
- Quản lý mục lục mặc định chỉ mở ba gốc KNTT. Các cây khác được đặt trong tùy chọn “Hiện tất cả cây cũ / dữ liệu tham khảo”. Vẫn có thể tra cứu đủ năm cây MathHub.
- Bảng “Danh mục KNTT dùng cho AI” dùng cùng hàm dựng ngữ cảnh với yêu cầu gửi Gemini. Có thống kê chương, bài, dạng và bài chưa có dạng cho từng lớp, cả trong cửa sổ quét AI.

## Mục lục đã có gì?

| Lớp | Chương | Bài đánh số |
| --- | --- | --- |
| 10 | 9 | 1–27 |
| 11 | 9 | 1–33 |
| 12 | 6 | 1–19 |

Tổng 24 chương, 79 bài, từ tệp KNTT người dùng đã cung cấp trong phiên bản trước. Số chương/bài giữ nguyên; không lấy các cây mục lục cũ đánh số khác để gửi AI. Đây không phải một lần xác minh mới với bản SGK giấy hoặc nguồn nhà xuất bản.

Danh mục đóng gói chỉ có 6 dạng thuộc một số bài THPT. Dạng bài là hệ phân loại giáo viên thiết lập, không phải mục lục SGK. Những bài còn thiếu dạng tiếp tục hiển thị rõ; AI được yêu cầu báo thiếu, không chọn dạng của bài khác để hoàn thành mã. Giáo viên có thể thêm hoặc đối chiếu dạng rồi duyệt. Chưa có đầy đủ yêu cầu cần đạt cho toàn bộ chương trình; không chứng nhận độ chính xác chuyên môn của Gemini.

## Sử dụng

Giải nén bản source mới vào thư mục riêng. Giữ nguyên Cargo.lock và rust-toolchain.toml; chạy Build-Windows.cmd trên máy Windows có bộ công cụ cần thiết. Không chép đè cơ sở dữ liệu bằng một kho rỗng. Identifier của ứng dụng không đổi.

Trong app: Ngân hàng câu hỏi → biểu tượng sách bên cạnh “MỤC LỤC KNTT · TOÁN”. Mở lớp, nhánh, chương, bài để xem danh sách. Trong “Quét ID”, mở “Phạm vi, danh mục và tùy chọn quét” để xem thống kê và thiết lập dạng còn thiếu.

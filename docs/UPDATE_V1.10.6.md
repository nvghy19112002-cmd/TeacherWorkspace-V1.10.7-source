# V1.10.6 — Bộ đọc câu hỏi và bộ lọc đầy đủ

## Hiển thị

- Cỡ chữ nội dung xác định bằng px, mặc định 16 px. Thanh cỡ chữ từ 85–130%, có nút đặt về 100%; tránh việc 50% làm đề và công thức quá nhỏ.
- Khung đọc sáng, giãn dòng 1.75, phương án thành một cột; đáp án đúng có nền xanh nhẹ. Các mảnh công thức nằm cùng dòng với phần văn bản của phương án.
- Lời giải mở/thu gọn được; bỏ dòng hướng dẫn dài về hình TikZ/PDF khỏi đầu câu. Giảm các dòng trống liên tiếp do định dạng mã nguồn.
- Hình TikZ: TeX Live tiếp tục dựng riêng và cắt sát khung hình; PDF.js chuyển trang hình thành PNG ở độ phân giải cao rồi hiển thị bằng ảnh trong nội dung. Không dùng iframe PDF trong xem nhanh, nên không có nền đen/thanh PDF hoặc ô cao cố định 280 px. Bản PDF toàn câu vẫn mở riêng khi cần.
- Cache hình theo nguồn và khai báo/cấu hình, có giới hạn dung lượng; chỉ tải bộ vẽ PDF khi thực sự có hình. Bộ vẽ và worker được đóng gói cục bộ, không dùng CDN.

## Thao tác đọc và chọn

- Câu trước/câu tiếp theo cùng số thứ tự trong tập kết quả đang lọc.
- Chọn vào khay và Chọn & tiếp ngay tại vùng đọc; tự chuyển trang danh sách khi đi qua mốc 50 câu. Đổi câu đưa vùng đọc về đầu.
- Nút Đọc rộng có nhãn chữ để dễ nhận ra, giữ được khả năng quay về bố cục danh sách.
- Khay được giữ khi đổi module trong cùng phiên ứng dụng. Đóng app vẫn kết thúc khay tạm; các đề đã tạo vẫn lưu bền vững như trước.

## Bộ lọc theo ảnh tham khảo

Cột trái có Nhóm câu hỏi, Lớp, Nhánh, Chương, Bài, Dạng, Mức độ, Loại câu, Hình vẽ và Nguồn nhập. Nguồn nhập lấy từ dữ liệu/file thực tế, không giả lập kết nối MathHub online.

Đổi cấp trên xóa các cấp dưới; chưa chọn cha thì cấp dưới bị khóa. Đổi nhóm câu hỏi giữ lớp/chương và các điều kiện đang chọn. Có nút xóa toàn bộ bộ lọc. Cây mở riêng vẫn giữ để tìm không dấu, đọc đầy đủ tên mục và chọn theo cây; chức năng chỉnh danh mục tách riêng.

Giữ phạm vi KNTT lớp 10–12. Dữ liệu cũ vẫn được tính vào tổng lớp, không tự gán lại số chương/bài. Lọc sâu cần liên kết KNTT đã duyệt; bản này không bổ sung đủ toàn bộ dạng/YCCD và không thay đổi thuật toán gán ID của 1.10.5.

## Build

Giải nén thư mục mới và chạy Build-Windows.cmd. Node.js tối thiểu 22.13 do yêu cầu của bộ vẽ PDF; nên dùng bản LTS đáp ứng yêu cầu này. Giữ Cargo.lock/rust-toolchain.toml. Đây là source, chưa có installer Windows mới trong phiên bàn giao.

Tài liệu API bộ vẽ được đối chiếu: https://mozilla.github.io/pdf.js/examples/index.html .

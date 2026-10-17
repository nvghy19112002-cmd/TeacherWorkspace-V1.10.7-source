# V1.10.5 — Gán ID gọn, bố cục mới và xem nhanh có TikZ

## Quy trình gán ID

- Câu đang xem: **Gán ID → Xác nhận và quét**. Nhiều câu: tích chọn → **Gán ID** trên thanh thao tác theo lô → xác nhận.
- Hộp xác nhận nhỏ, bỏ checkbox gửi API và không mở sẵn danh mục/cảnh báo/lịch sử. Tùy chọn nâng cao vẫn có khi cần giới hạn phạm vi hoặc thiết lập dạng.
- Chỉ gửi Gemini sau khi xác nhận. Có thể xem các đề xuất đã lưu mà không gọi API; nếu sau đó bắt đầu quét, app vẫn yêu cầu xác nhận gửi dữ liệu.
- Kết quả chỉ là đề xuất. Giáo viên bấm duyệt từng câu hoặc **Duyệt N đề xuất** và xác nhận cuối. Hủy xác nhận không đổi ID.
- Duyệt hàng loạt chỉ xét đề xuất mới nhất của từng câu; không quay về bản cũ khi bản mới không hợp lệ. Câu đã đổi nguồn/cây, khóa ID, thiếu căn cứ hoặc sai đường dẫn/YCCD không được áp dụng. Câu đủ điều kiện được lưu cùng lịch sử trong một giao dịch ngân hàng.
- Đang chỉnh sửa một đề xuất thì chặn duyệt theo lô để tránh bỏ qua chỉnh sửa đó; có nút hủy chỉnh sửa để quay về bản AI.
- Lỗi máy chủ tạm thời được thử tối đa 3 lượt với khoảng chờ tăng dần; lỗi mạng/timeout giữ tối đa 2 lượt. Có nút thử lại riêng câu lỗi; không hứa khắc phục được sự cố dịch vụ Gemini.

## Bố cục ngân hàng

- Đầu trang thu từ khoảng 100 px còn khoảng 52 px ở khung đủ rộng. Bỏ dòng nhãn phụ và huy hiệu thừa, giữ tên trang và các nút nhập/tạo câu.
- Ba vùng: bộ lọc bên trái, danh sách ở giữa, câu hỏi bên phải. Giữ giao diện sáng navy và khung điều hướng chung của app.
- Bộ lọc mức độ, loại câu, hình vẽ dùng ngay tại cột trái. Bộ lọc chi tiết vẫn giữ cho trạng thái và các điều kiện khác.
- Tách cây khỏi cột hẹp: **Lọc theo mục lục** mở bảng riêng có ba lớp 10/11/12, tìm không dấu, cây mở/thu gọn và tên chương/bài tự xuống dòng. Chọn rồi áp dụng; đóng không áp dụng thì không thay bộ lọc. Đường dẫn đã chọn có nút đổi và xóa riêng.
- Tách rõ nút **Quản lý cây mục lục** để chỉnh danh mục và nút **Lọc theo mục lục** để lọc câu hỏi.
- Thanh theo lô gom Gán ID, Tạo đề/Sắp xếp, Biên dịch, Chép mã, Xóa, Bỏ chọn. Thanh câu đang xem gom Sửa, Gán ID, Biên dịch PDF, Chép mã, Mở rộng, Xóa.
- Màn 1024 px xếp danh sách và xem trước thành hai vùng ở bên phải, bộ lọc vẫn ở bên trái; không đẩy phần xem trước xuống sau một vùng trống cao.

## Xem nhanh và hình TikZ

- Chọn câu là xem ngay văn bản, công thức, lựa chọn, đáp án và lời giải; không tự biên dịch toàn bộ câu. Lời giải mở/thu gọn được.
- Xem nhanh giữ chữ đậm/nghiêng/gạch chân, danh sách cơ bản, công thức $...$, \( ... \), công thức hiển thị và hệ phương trình thông dụng.
- Hình nằm trong tikzpicture được tách và dựng riêng bằng TeX Live, đặt đúng vị trí trong đề/phương án/lời giải. Chỉ bắt đầu khi hình gần vùng nhìn thấy; hủy công việc cũ khi chuyển câu.
- Hình dùng PDF cắt sát theo khung TikZ, hiển thị ngay trong phần xem nhanh. Lưu đệm giới hạn dung lượng trong phiên làm việc, theo mã hình + toàn bộ cấu hình TeX + khai báo thực tế. Mở lại hình không đổi thì dùng kết quả đã có. Đóng app sẽ hết bộ nhớ đệm.
- PDF toàn câu và hình riêng dùng chung hàng đợi; hủy tác vụ đang chờ không hủy tác vụ của nơi khác.
- **Biên dịch PDF** vẫn dùng để đối chiếu đầy đủ bố cục, bảng, macro tùy chỉnh hoặc tài nguyên ngoài. Hình cần gói preview.sty trong TeX Live. Macro hình phụ thuộc định nghĩa bên ngoài tikzpicture cần khai báo trong cấu hình; nếu thiếu sẽ hiện lỗi để mở PDF kiểm tra. Xem nhanh không thay thế bản in chính xác.
- Mã LaTeX lưu trong câu hỏi không bị sửa bởi việc xem nhanh hoặc dựng hình.

## Dữ liệu và build

Giữ mục lục KNTT 24 chương/79 bài của bản trước. Không tự tạo danh mục dạng/YCCD còn thiếu và không xác nhận Gemini phân loại chuẩn mọi câu.

Giải nén vào thư mục mới, đọc START_HERE.md và chạy **Build-Windows.cmd** để tạo bộ cài thông thường. Không cần mật khẩu khóa ký cho chế độ này. Build-Signed-Windows.ps1 dành cho phát hành cập nhật có chữ ký và cần khóa/mật khẩu đúng.

Gói bàn giao là source; chưa tạo bộ cài Windows trong phiên này.

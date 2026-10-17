# Teacher Workspace 1.10.7

## Giao diện riêng, gọn hơn

- Thanh điều hướng chính 64 px, chỉ icon, giữ tooltip/tên truy cập và trạng thái trang đang mở. Không đổi độ rộng khi chuyển module. Lấy lại 154 px cho vùng làm việc so với 218 px trước đây.
- Màu giấy sáng, xanh navy; chế độ tối giữ tương phản. Cài đặt dùng menu nhóm và một vùng nội dung rộng: AI & API key, TeX Live, Giao diện & lịch, Dữ liệu, Cập nhật.
- Các chức năng cũ: lịch, sao lưu/khôi phục, quản lý workspace, TeX Live và cập nhật vẫn gọi đúng thao tác cũ.

## Kiểm tra bằng chính bộ 200 câu được cung cấp

- Không thay nội dung hay đáp án của tệp mẫu gốc `tests/data/preview-200.tex`.
- Đọc môi trường eqnarray/equation/align/gather bằng KaTeX, giữ dòng toán và các macro heva/hoac.
- Giữ hình bên trong immini khi lựa chọn nằm trong nhánh văn bản. Tách đáp án bằng nhóm ngoặc cân bằng, không cắt bỏ phần hình.
- Đưa các khai báo hình cục bộ def/newcommand/tikzset/tdplotsetmaincoords vào bản dựng hình thay vì lộ chúng trong văn bản. Hỗ trợ tikz-3dplot khi gói có sẵn.
- Bảng tabular đơn giản được hiển thị trực tiếp; itemchoice/listEX, bf/it, dấu nháy LaTeX và khoảng quad được hiển thị trong bộ đọc.
- Bỏ ảnh hưởng resizebox tới kích thước đọc, giữ ảnh co theo khung. Công thức dài cuộn ngang bên trong, không làm tràn khung ngoài.
- Có 239 khối tikzpicture nhưng 238 hình độc lập: một khối nằm trong macro chú thích của biểu đồ.
- 237 hình dựng được với bộ tích hợp; 1 hình cần khai báo gốc IntervalLR/IntervalGRF. App báo lệnh thiếu; không tự đoán hay thay hình trong nguồn.

## API và model

- Dán nhiều key, mỗi dòng một key; loại trùng; tối đa 100 key. Thêm một key cũng kiểm tra trùng. Thất bại lưu metadata sẽ dọn credential vừa tạo.
- Bật/tắt, chọn key chính, đổi thứ tự, xóa, kiểm tra và hiện/ẩn từng key. Mặc định che; Windows Credential Manager giữ credential, backup không chứa key.
- Chọn ưu tiên key chính hoặc luân phiên theo từng yêu cầu. Con trỏ luân phiên giữ trong phiên; cấu hình và danh sách key giữ qua lần mở app. Cùng chính sách được dùng cho phân loại và AI Tools.
- Tùy chọn chuyển key khi HTTP 429; không chuyển key do lỗi model/cấu hình. Các key cùng dự án có thể dùng chung hạn mức; đổi key không đảm bảo hết lỗi quota.
- Tải toàn bộ các trang danh sách model từ Google theo key đã chọn, lọc generateContent. Không cố định danh sách phiên bản; không tự đổi model người dùng đã chọn.
- “Key hợp lệ” xác nhận đọc danh sách model. “Thử model” gửi yêu cầu JSON ngắn để thử model/cấu trúc JSON; phép thử này không bảo đảm phân loại đúng hay bảo đảm mọi schema lớn đều được model chấp nhận.
- Bỏ temperature ép cứng; hiển thị HTTP, model và chi tiết lỗi Google đã che key. Phân biệt 400/401/402/403/404/429/503 và lỗi mạng. Bấm Lưu model để dùng chung.
- Chưa thử bằng key thật hoặc tái hiện lỗi 3.8 của người dùng; đã kiểm tra request và các lỗi bằng phản hồi mô phỏng. Không kết luận nhiệt độ là nguyên nhân duy nhất.

## Bộ cài

Bản bàn giao này là mã nguồn. Workflow Windows có sẵn sẽ tạo NSIS setup.exe sau khi kiểm tra đạt; bản thường không cần mật khẩu ký updater. Chưa tạo/kiểm chứng installer Windows trong môi trường Linux. Xem WINDOWS_INSTALLER.md.

# Teacher Workspace V1.10.0

## Kho đề ôn tập & đề thi

Mục **Kho đề & tài liệu** giữ nhiều bộ đề, nhóm Ôn tập hoặc Kiểm tra / Thi, có lớp và cây file riêng. Có thể tạo file/thư mục, nhập nhiều file hoặc cả thư mục, đổi tên, di chuyển, nhân bản nhánh, mở nhiều tab, sửa LaTeX và lưu từng file (Ctrl+S) hoặc tất cả (Ctrl+Shift+S). File/thư mục bị xóa vào thùng rác để khôi phục; xóa toàn bộ bộ đề là thao tác xóa hẳn sau xác nhận. Tên trùng bị từ chối, không tự ghi đè.

PDF được mở trong khung xem; LaTeX mở dưới dạng nguồn UTF-8, hình được xem trước. Đây chưa phải OCR PDF hay trình soạn thảo có hoàn thành lệnh. File nhập là bản sao trong app. Đổi tên/di chuyển không tự sửa lệnh `input`, `include` hay `includegraphics`; kiểm tra tham chiếu trước khi biên dịch.

Trong **Ngân hàng câu hỏi → Đề đã lưu → Mở trong Kho đề**, app tạo dự án mới từ snapshot câu hỏi, gồm `main.tex` và `question.tex`. Câu trong ngân hàng và snapshot đề ban đầu được giữ nguyên. Bộ khai báo tích hợp dùng cho mẫu ex_test thông thường; cần nhập thêm hình và khai báo riêng nếu câu phụ thuộc tài nguyên bên ngoài.

## TeX Live cục bộ

Trên bản desktop, chọn file chính `.tex`, chọn XeLaTeX/pdfLaTeX/LuaLaTeX rồi biên dịch. Có hàng đợi nhiều bộ đề, nút dừng, nhật ký lỗi, xem và xuất PDF. App ghi bản sao vào thư mục tạm, chạy hai lượt TeX, tắt shell escape và giới hạn 120 giây. Dùng cấu hình đường dẫn engine đã lưu ở phần xem trước TeX Live trong ngân hàng; nếu engine khác, app tìm engine qua PATH.

File chính là tài liệu LaTeX đầy đủ; app không chèn thêm preamble vào dự án nhập. Chưa tự chạy BibTeX/Biber/makeindex hoặc latexmk. Giới hạn 5.000 file, 25 MB/file, 100 MB/bộ đề và 32 MB/PDF kết quả. Web chỉ quản lý/xem tài liệu; không gọi TeX Live trên máy.

## Duyệt mã KNTT

Cây mới tách khỏi MathHub: Toán 10–12, số chương và số bài theo cây KNTT đã được cung cấp trong dự án. Số bài giữ nguyên cả khi có hai chữ số. Mã lớp vẫn 0/1/2 và nhánh D/H để tương thích cấu trúc mã; nhánh thống kê/xác suất nằm trong D.

Trong hộp **Quét AI**, mở thiết lập dạng KNTT: thêm dạng thủ công hoặc chọn bài MathHub tương ứng rồi xác nhận đã đối chiếu để chép danh mục dạng. App không tự giả định hai bài tương đương. Chưa có danh mục dạng KNTT được giáo viên duyệt đầy đủ ngay từ đầu; cần thiết lập theo bài đang dùng. Nguồn chương/bài là dữ liệu có sẵn của dự án, chưa được kiểm chứng lại từng trang SGK trong lần cập nhật này.

Gemini nhận ngữ cảnh cây KNTT đang hoạt động và chỉ đề xuất nút có thật. Giáo viên đọc đề xuất và bấm áp dụng. App từ chối đề xuất thiếu dữ liệu, đường dẫn/mã không khớp, câu đã sửa sau khi quét hoặc ID bị khóa do dùng trong đề. Khi duyệt, mã và các liên kết lớp–nhánh–chương–bài–dạng cập nhật cùng một lần lưu, kèm lịch sử. UUID và LaTeX gốc giữ nguyên. Mã nguồn trong LaTeX cũ không ghi đè mã KNTT đã duyệt khi sửa câu.

Đây là cơ chế hỗ trợ và kiểm tra tính nhất quán, không phải cam kết AI luôn phân loại đúng chuyên môn. Bản này triển khai taxonomy Toán; chưa có ngân hàng mã cho Lý/Hóa hoặc các môn khác. Chưa hỗ trợ sửa trực tiếp đề xuất AI trước khi duyệt: điều chỉnh danh mục/nguồn rồi quét lại khi cần.

## Dữ liệu và cập nhật

Kho đề lưu IndexedDB trong hồ sơ ứng dụng, tách khỏi SQLite ngân hàng. **Backup toàn bộ file** xuất JSON cho bộ đề đang chọn, gồm cả file trong thùng rác. **Nhập backup** luôn tạo bản sao mới. Backup lịch hoặc ngân hàng hiện có **không bao gồm Kho đề**. Trước khi đổi máy/xóa hồ sơ app, xuất backup từng bộ đề và backup ngân hàng/lịch riêng. Không đổi cổng/origin khi dùng web nếu muốn mở lại cùng dữ liệu.

Giữ nguyên identifier `com.teacherworkspace.desktop`. Không có migration phá dữ liệu cũ. Source bao gồm workflow Windows để kiểm tra Rust, UI và tạo installer; chưa kèm installer Windows đã build.

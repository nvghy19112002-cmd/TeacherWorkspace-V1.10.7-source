# V1.10.3 — Sửa luồng rà soát và gán ID KNTT

Bản này tập trung sửa hệ thống ID của 1.10.2. Không phải bản đầy đủ của lộ trình 1.11–1.13.

## Những lỗi và hạn chế đã xử lý

- Dạng tự thêm bằng UUID được nhận diện theo nút gốc KNTT, không bị loại nhầm chỉ vì ID không có tiền tố tự sinh.
- Khởi tạo KNTT trước đây bỏ qua 6 dạng có sẵn trong cây nguồn. Nay nhập đủ lớp–nhánh–chương–bài–dạng có trong nguồn; không tự sáng tác dạng còn thiếu, không ghi đè mã/tên dạng giáo viên đã chỉnh hoặc tự thêm.
- Quét không còn dừng cả lượt chỉ vì một câu trả JSON lỗi. Tiến trình có trạng thái từng câu; thử lại câu lỗi hoặc tiếp tục câu chưa quét ngay trong hộp thoại. Lỗi cấu hình chung như sai model/key hoặc hết quota sẽ dừng để tránh lặp yêu cầu vô ích. Các đề xuất thành công được lưu ngay.
- Chọn được phạm vi lớp/chương/bài. Chỉ gửi danh mục và YCCD thuộc phạm vi cùng các nút tổ tiên cần thiết, thay vì gửi toàn bộ cây trong mọi trường hợp. Bài thiếu dạng vẫn xuất hiện trong ngữ cảnh để AI báo thiếu, không bị ép chọn dạng ở bài khác.
- Không gọi API khi thiếu dạng, ID bị khóa hoặc câu tham chiếu hình/file ngoài chưa gửi được cho AI. Tham chiếu đã comment không bị chặn nhầm. TikZ chỉ được gửi dạng mã nguồn, không được coi là đã có ảnh biên dịch.
- Mặc định bỏ qua câu đã duyệt KNTT và câu đã có đề xuất hiện hành từ cùng model/phạm vi. Có tùy chọn quét lại chủ động. Lỗi mạng/timeout/HTTP tạm thời được thử lại tối đa một lần; hủy quét sẽ hủy cả yêu cầu và thời gian chờ thử lại.
- Giảm lỗi yêu cầu Gemini do các từ khóa JSON Schema không được hỗ trợ; kết quả vẫn được Zod kiểm tra chặt ở phía app. Không suy luận rằng JSON hợp lệ đồng nghĩa phân loại chuyên môn đúng.

## Đối chiếu và sửa trước khi duyệt

Hộp thoại hiển thị câu hỏi, đáp án/lời giải đang lưu, lập luận/bằng chứng của AI và đường dẫn phân loại. Có thể đổi bài, dạng, mức độ; mã được app ghép từ cây. Khi sửa phải ghi lý do và xác nhận đã đối chiếu. Lưu lại phân loại gốc của AI và lý do giáo viên sửa trong lịch sử.

App tự ghép lại mã khi AI trả đúng đường dẫn nhưng chuỗi mã sai; có thông báo để đối chiếu. Nếu các nút lớp/nhánh/chương/bài không khớp dạng, phải sửa đường dẫn trước khi duyệt. Không cho gán YCCD ngoài đường dẫn đã chọn. Đề xuất nằm ngoài phạm vi quét bị từ chối.

Kết quả mặc định là lần quét mới nhất của từng câu. Có thể xem cả các lần cũ và chuyển trang, không còn cắt bỏ các đề xuất ngoài 50 mục đầu. Sau một lượt quét có kết quả, phần thiết lập được thu gọn để dành chỗ đối chiếu.

## Dữ liệu được bảo vệ

- Duyệt lại cùng mã giữ số thứ tự đang có; đổi phân loại mới cấp số phù hợp.
- Mã, lớp, nhánh, chương, bài, dạng và lịch sử được lưu trong một giao dịch của ngân hàng.
- UUID, LaTeX gốc, snapshot đề đã lưu và ID khóa được giữ nguyên.
- Kiểm tra dấu vân tay nguồn nguyên văn, đáp án/lời giải và cây KNTT/YCCD tại lúc áp dụng. Nguồn hoặc cây đã đổi thì phải quét lại. Đề xuất trước 1.10.3 thiếu dấu vân tay mới cũng cần quét lại; lịch sử cũ vẫn xem được.
- Giữ các cảnh báo sẵn có, không để cảnh báo AI ghi đè mất cảnh báo trình nhập.

**Duyệt phân loại tách khỏi duyệt chất lượng nội dung:** câu mới vẫn ở trạng thái cần kiểm tra sau khi gán mã. Nếu AI báo đáp án sai, câu vào trạng thái cần sửa để giáo viên đối chiếu; app không tự sửa đáp án. Chỉ giữ trạng thái đã duyệt khi câu đã được duyệt từ trước và lượt quét không phát hiện vấn đề đáp án.

## Cách dùng

1. Mở Ngân hàng câu hỏi, chọn câu hoặc khay câu hỏi rồi Quét ID.
2. Mở phần phạm vi/tùy chọn; chọn đúng lớp hoặc bài nếu đã biết.
3. Xem số dạng khả dụng. Trong thiết lập, tìm bài KNTT, thêm dạng riêng hoặc đối chiếu bài nguồn MathHub cùng lớp rồi chép dạng. Có danh sách dạng hiện có và báo xung đột tên/mã.
4. Đồng ý gửi dữ liệu rồi chạy. Nếu chỉ một vài câu lỗi, dùng nút thử lại/tiếp tục; không cần quét lại các câu đã có kết quả.
5. Đối chiếu từng đề xuất, sửa khi cần, ghi lý do, tích xác nhận rồi duyệt phân loại.
6. Kiểm tra nội dung, đáp án và hình bằng TeX Live trước khi chuyển câu sang sẵn sàng ra đề.

## Giới hạn

Chưa gọi Gemini bằng API key thật trong lần sửa này và chưa có bộ nhãn chuẩn của giáo viên để đo độ chính xác. Không có cam kết phân loại đúng 100%. Phân loại chuyên môn vẫn cần người duyệt.

Phạm vi chưa nhập YCCD thì app báo rõ chỉ đối chiếu được cây bài/dạng, chưa xác nhận mức phù hợp chương trình 2018. Chưa gửi hình/file ngoài cho Gemini và chưa OCR PDF. Các bài thiếu dạng cần giáo viên bổ sung; 6 dạng nhập sẵn không phải danh mục đầy đủ Toán 10–12.

Trạng thái lỗi/tiến trình của hàng đợi tồn tại khi hộp thoại còn mở; các đề xuất đã lưu tồn tại sau khi khởi động lại. Đóng hộp thoại sẽ dừng quét. Không tự áp dụng hàng loạt hoặc thay nội dung câu.

## Cập nhật

Giải nén source vào thư mục mới, đọc START_HERE.md và chạy Build-Windows.cmd. Giữ Cargo.lock và rust-toolchain.toml của bản này. Bản 1.10.3 giữ bộ SDK đã ổn định trong 1.10.2; công cụ tăng phiên bản nay cập nhật cả mục ứng dụng trong Cargo.lock, không thay phiên bản phụ thuộc.

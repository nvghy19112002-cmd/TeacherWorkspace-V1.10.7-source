# Teacher Workspace V1.9.0 — Thư viện LaTeX cá nhân

Ngày bàn giao: 16/10/2026. Nền tảng: source V1.8.2 ngày 22/09/2026.

## Giao diện và cách làm việc mới

Ngân hàng dùng bố cục mới: thanh ứng dụng navy gọn, cây thư viện bên trái, danh sách có trích đoạn câu hỏi ở giữa, phiếu xem trước ở phải. Nền sáng, màu navy, chữ Toán trên nền giấy và hệ thống sáng/tối được giữ đồng bộ. Có thể ẩn cây hoặc mở rộng riêng vùng xem trước. Cửa sổ hẹp chuyển vùng xem trước xuống dưới để giữ điều khiển và nội dung.

Nhóm truy cập nhanh gồm **Tất cả câu hỏi**, **Mới cập nhật**, **Cần hoàn thiện**, **Đã duyệt**, **Có hình vẽ**. Cây chương trình duyệt theo nhánh và đếm câu; quản lý năm cây MathHub vẫn có trong **Cây mục lục**. Bộ lọc chi tiết mở khi cần để danh sách có thêm diện tích.

Tìm theo nội dung, nguồn và nhãn hỗ trợ tiếng Việt không dấu. Có ô ID6 riêng, Ctrl+K đưa con trỏ vào ô tìm nội dung, và sắp xếp theo lần sửa, ngày cũ nhất, ID6 hoặc số lần sử dụng. Việc chọn câu vào khay được giữ khi đổi bộ lọc; vùng chi tiết chỉ hiện câu thuộc kết quả hiện tại.

## Luồng LaTeX

- **Nhập .tex/.txt** và **Dán LaTeX** dùng chung bước kiểm tra trước khi lưu. Bỏ qua bản trùng nguyên văn; hiển thị cảnh báo ID và khai báo thiếu.
- Trình sửa có **Mã LaTeX**, **Song song**, **Xem trước**. Nội dung đơn giản dùng KaTeX; câu có TikZ/bố cục đặc biệt gọi TeX Live trong app Windows. Bản xem trước trong trình sửa đợi 800 ms sau khi gõ để hạn chế biên dịch liên tục.
- **Loại câu, đáp án, lời giải** đọc từ LaTeX khi lưu. Sửa chúng ngay trong mã nguồn để các vùng hiển thị và dữ liệu thống nhất. ID6 hợp lệ trong mã được ưu tiên; có thể bấm **Đọc thông tin từ LaTeX** để xem thông tin được nhận diện.
- Ctrl+S lưu câu; Tab chèn hai khoảng trắng trong ô mã. Khi còn thay đổi, đóng trình sửa đưa ra lựa chọn tiếp tục sửa hoặc bỏ thay đổi.
- Chặn lưu nhiều câu trong trình sửa một câu, môi trường ex chưa đóng và nguồn giống hệt một câu khác đang trong kho. Lỗi phát hiện tại bước này không thay thế kiểm chứng cú pháp bởi TeX Live.
- Giữ UUID, nguồn LaTeX nguyên văn và ID đã khóa. Kiểm tra câu đã đổi sau lúc mở trình sửa để tránh ghi đè phiên bản mới. Mỗi lần sửa lưu một snapshot cũ.
- Tab **Lịch sử** xem mã các phiên bản cũ; mở bản cũ vào trình sửa để kiểm tra rồi lưu thành phiên bản mới.

Với kho cũ từng nhập đáp án/lời giải ngoài mã LaTeX, app giữ lại thông tin này và nhắc đối chiếu khi sửa nguồn. Khi một đáp án/lời giải đã có trong mã được sửa hoặc xóa, dữ liệu nhận diện được cập nhật theo nguồn mới.

## Tiếng Việt và bộ khai báo dự phòng

Bộ dự phòng nhận tùy chọn của `choiceTF[1t]` và ID ở `begin{ex}[ID]`. XeLaTeX/LuaLaTeX dùng font hệ thống hỗ trợ tiếng Việt nếu chưa có `setmainfont` riêng (ưu tiên Times New Roman, rồi DejaVu Serif/Noto Serif). Với pdfLaTeX thiếu T5, log được chuyển thành hướng dẫn chọn xelatex hoặc cài bộ tiếng Việt; không tự thay engine đã chọn hay tự đổi mã câu.

## Khay câu hỏi và đề đã lưu

Khay có danh sách theo thứ tự chọn, nút lên/xuống và bỏ từng câu. Chép mã, biên dịch PDF và tạo đề dùng cùng thứ tự này. Bản cũ có thể lấy thứ tự hàng trong kho khi chép/tạo đề; V1.9.0 dùng thứ tự khay.

**Tạo đề .tex** lưu tên, thời lượng và snapshot câu hỏi, tăng số lần sử dụng, khóa ID đã dùng rồi xuất mã ex_test. Tệp xuất là phần nội dung câu dùng cùng bộ khai báo của giáo viên. Nút **Đề đã lưu** cho phép xuất lại .tex hoặc biên dịch PDF từ snapshot; sửa câu trong ngân hàng không làm đổi bản đề đã lưu.

Biên dịch nhiều câu giữ thứ tự; khi log xác định được câu lỗi, có thể **Bỏ câu lỗi khỏi lượt này và biên dịch tiếp**. Danh sách câu đã bỏ được ghi rõ trên màn hình. Thao tác này chỉ thay nhóm đang biên dịch, không xóa hay sửa câu trong kho.

## Dữ liệu và phạm vi

- Không đổi schema ngân hàng hoặc lịch; giữ migration 001/002, identifier ứng dụng, kênh updater và dữ liệu cũ.
- Smart Schedule, công việc, thống kê, xuất PNG, backup và AI Tools vẫn có trong thanh ứng dụng.
- Năm cây JSON MathHub được giữ nguyên; không coi các cây khác hệ mã là tương đương và không đồng bộ trực tiếp với dữ liệu MathHub.
- Không thêm nhà cung cấp AI hoặc gán ID tự động. Quét AI hiện tại vẫn là đề xuất có duyệt; YCCD 2018 tiếp tục dùng dữ liệu có căn cứ do giáo viên nhập/duyệt.
- Ngân hàng vẫn nạp snapshot vào bộ nhớ. Phân trang danh sách vẫn ở giao diện; chưa chuyển truy vấn xuống SQLite.
- Xem trước PDF native, cài đè Windows và Credential Manager cần được kiểm tra trên máy Windows. Đọc TEST_REPORT_V1.9.0.md trước khi phát hành.

## Tệp chính để làm tiếp

| Tệp                                                     | Vai trò                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| src/modules/question-bank/QuestionBankPage.tsx          | Nối luồng thư viện, lọc, nhập và hành động |
| src/modules/question-bank/studio.css                    | Thiết kế thư viện mới                      |
| src/modules/question-bank/components/LibrarySidebar.tsx | Nhóm truy cập nhanh và cây thư viện        |
| src/modules/question-bank/components/QuestionEditor.tsx | Soạn LaTeX và xem song song                |
| src/modules/question-bank/components/SelectionTray.tsx  | Thứ tự câu và tạo đề                       |
| src/modules/question-bank/components/SavedExams.tsx     | Xuất lại snapshot đề                       |
| src/modules/question-bank/domain/editor.ts              | Quy tắc lưu câu và đồng bộ metadata        |
| src/modules/question-bank/domain/library.ts             | Thứ tự, tìm không dấu và trích đoạn        |

Source bàn giao có `START_HERE.md` và tệp thử `examples/question-bank-smoke.tex`. Không chép dữ liệu thử vào ngân hàng người dùng tự động.

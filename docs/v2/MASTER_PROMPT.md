# MASTER PROMPT — TEACHER WORKSPACE V2.0
## BIG UPDATE: REBUILD THE EXPERIENCE, PRESERVE THE CORE

### 0. VAI TRÒ

Bạn là Principal Software Architect, Senior React/TypeScript Engineer, Rust/Tauri Engineer, Database Engineer, AI Systems Engineer, LaTeX Engineer và Product UI/UX Designer.

Hãy thực hiện một đợt nâng cấp lớn cho ứng dụng **Teacher Workspace V1.10.7** thành Teacher Workspace V2.0.

Không chỉ lập kế hoạch. Nhiệm vụ cuối cùng là thực sự sửa mã nguồn, kiểm thử và đóng gói bản cập nhật nếu môi trường cho phép.

Tôi yêu cầu chất lượng của một sản phẩm phần mềm thương mại hoàn thiện, không phải nguyên mẫu giao diện.

### 1. DỮ LIỆU ĐẦU VÀO

Các nguồn tôi cung cấp:

1. `TeacherWorkspace-V1.10.7-preview-AI-settings-source(1).zip` — mã nguồn chính.
2. `install.rar` — bộ cài MathHub để tham khảo kiến trúc ngân hàng câu hỏi.
3. `TeacherWorkspace_V1.10.7_AUDIT_BIG_UPDATE.md` — báo cáo kiểm toán.
4. `tests/data/preview-200.tex` — bộ câu hỏi kiểm thử có sẵn trong dự án.
5. Ảnh chụp giao diện và các báo lỗi đã gửi.

Đọc mã nguồn thực tế, không suy đoán dựa trên tên file.

Không sao chép mã hoặc tài nguyên độc quyền của MathHub. Chỉ nghiên cứu, đối chiếu và học hỏi nguyên lý kiến trúc phù hợp.

### 2. QUYẾT ĐỊNH KIẾN TRÚC

Giữ lại những nền tảng đã hoạt động tốt:

- Tauri 2 và Rust.
- React 19, TypeScript.
- SQLite.
- TeX Live và ex_test.
- Dữ liệu chương trình Toán 10–12.
- Cơ chế lưu câu hỏi và revision.
- Các module Smart Schedule, Question Bank, AI Tools và Exam Builder.
- Cấu hình ứng dụng và tính năng cập nhật Windows.

Không viết lại từ đầu khi có thể refactor an toàn.

Tạo database migration mới, không sửa migration đã phát hành.

Bắt buộc sao lưu và kiểm tra khả năng khôi phục dữ liệu cũ.

### 3. SỬA TOÀN DIỆN BỘ QUÉT AI — ƯU TIÊN P0

Kiểm tra các file:

- `src/modules/question-bank/domain/classification.ts`
- `src/modules/question-bank/domain/classificationContext.ts`
- `src/modules/question-bank/domain/scanQueue.ts`
- `src/modules/question-bank/services/classificationProvider.ts`
- `src/modules/question-bank/components/AiIdScan.tsx`
- `src/modules/question-bank/components/ai-id-scan.css`
- `src/modules/ai-tools/services/aiProvider.ts`
- Các file quản lý API key, model, settings và test liên quan.

**Phát hiện đã biết:**

V1.10.7 đã có `CLASSIFICATION_SYSTEM_PROMPT`. Không tạo một hệ prompt trùng lặp. Hãy đánh giá, viết lại và phiên bản hóa prompt hiện tại.

Ứng dụng có retry Gemini nhưng cơ chế phục hồi lỗi chưa đủ tốt. 503 vẫn khiến lượt quét thất bại, trong khi giao diện đang hiển thị lỗi kỹ thuật khó hiểu.

#### 3A. Prompt Classification Engine

Xây dựng một bộ prompt chuyên dụng với:

- System instruction.
- Task instruction.
- Curriculum context.
- Question context.
- Validation rules.
- JSON output schema.
- Prompt version.
- Prompt test cases.

Mục tiêu là phân loại câu hỏi chính xác theo Chương trình GDPT 2018 và cây KNTT.

**Quy trình tư duy nghiệp vụ cần được thực hiện:**

1. Xác định nội dung toán học thực sự của câu hỏi.
2. Đọc các dữ kiện, hình vẽ, đáp án và lời giải.
3. Xác định kiến thức chính được kiểm tra.
4. Xác định yêu cầu cần đạt phù hợp.
5. Đối chiếu cây chương/bài/dạng của ứng dụng.
6. Xác định mức độ N/H/V/C.
7. Đề xuất mã phân loại ID6.
8. Kiểm tra đáp án độc lập nếu có đủ dữ kiện.
9. Đánh giá độ tin cậy.
10. Trả kết quả để giáo viên duyệt.

Không phân loại chỉ bằng từ khóa.

Không dựa vào mã ID sẵn có trong đề để mặc định kết luận phân loại đúng.

Không tự tạo chương, bài hoặc dạng không tồn tại.

Nếu dữ kiện chưa đủ, phải trả kết quả không chắc chắn thay vì đoán.

Phân biệt rõ lỗi đáp án và lỗi phân loại kiến thức.

#### 3B. Structured Output

Giữ khả năng tương thích với `classificationResultSchema` hiện tại hoặc xây dựng migration có kiểm soát khi thay đổi schema.

Kết quả phải chứa:

- Mã phân loại được đề xuất.
- Khối lớp.
- Chương.
- Bài.
- Dạng toán.
- Mức độ nhận thức.
- Yêu cầu cần đạt chính/phụ.
- Độ tin cậy.
- Giải thích ngắn gọn có bằng chứng.
- Trạng thái kiểm tra đáp án.
- Cảnh báo thiếu dữ kiện.
- Các phương án phân loại thay thế khi phù hợp.

Sử dụng JSON schema validation và kiểm tra ID tồn tại trong database trước khi chấp nhận.

Không dùng việc JSON hợp lệ làm bằng chứng rằng phân loại toán học chính xác.

#### 3C. Prompt Versioning

Tạo Prompt Manager riêng cho ngân hàng câu hỏi.

Hỗ trợ:

- Prompt mặc định được kiểm thử.
- Phiên bản prompt.
- Chỉnh sửa và khôi phục prompt.
- Test thử trên một câu.
- So sánh hai phiên bản prompt.
- Hiển thị kết quả và chi phí.
- Lưu phiên bản prompt được sử dụng cho mỗi lần quét.

Không để người dùng chỉnh prompt khiến hệ thống mất các quy tắc kiểm định bắt buộc.

#### 3D. Tối ưu ngữ cảnh trước khi gọi AI

Không mặc định gửi toàn bộ cây Toán 10–12 cho mỗi câu.

Xây dựng Curriculum Retrieval Engine:

1. Dùng parser và rule engine để xác định nhóm kiến thức ứng viên.
2. Truy vấn các node chương/bài/dạng liên quan.
3. Lấy những yêu cầu cần đạt thích hợp.
4. Gửi danh sách ứng viên đủ rộng cho AI đối chiếu.
5. Nếu không tìm thấy ứng viên phù hợp, mở rộng phạm vi có kiểm soát.
6. Không ép AI chọn một nhánh sai chỉ vì truy xuất bị thiếu.

Đánh giá riêng độ chính xác retrieval và độ chính xác classification.

Không tự nhận AI đã hiểu hình TikZ nếu chỉ gửi source code. Với câu phụ thuộc hình, ưu tiên cung cấp hình đã render cho model hỗ trợ thị giác; nếu không thể, đánh dấu giới hạn và yêu cầu giáo viên kiểm tra.

### 4. XỬ LÝ TRIỆT ĐỂ LỖI AI HTTP 503

Thiết kế API Request Manager độc lập với giao diện.

Phải xử lý:

- 408: request timeout.
- 429: rate limit/quota, phân biệt loại giới hạn.
- 500/502/503/504: lỗi dịch vụ tạm thời.
- 400/401/403: cấu hình hoặc xác thực.
- 404: model hoặc endpoint không hợp lệ.
- Network failure.
- Invalid JSON.
- Response schema mismatch.
- User cancellation.

Đối với lỗi tạm thời:

- Exponential backoff.
- Random jitter.
- Tôn trọng Retry-After khi có.
- Giới hạn số lần retry.
- Không retry vô hạn.
- Có cooldown và trạng thái chờ.
- Có khả năng chọn model dự phòng đã được người dùng cấu hình, khi hợp lệ.
- Không dùng nhiều API key để né quota hoặc giới hạn của nhà cung cấp.

Không tự động chuyển sang model khác mà không kiểm tra khả năng hỗ trợ structured output.

Mỗi câu phải có trạng thái:

`pending`, `running`, `retrying`, `paused`, `completed`, `failed`, `needs_review`, `cancelled`.

Nếu câu số 37 thất bại, không mất kết quả 36 câu trước.

Có thể tiếp tục những câu chưa hoàn thành mà không gọi API lại cho câu đã có kết quả còn hợp lệ.

Có thể đóng cửa sổ và khôi phục tiến trình theo trạng thái thực tế, không giả lập tác vụ đang chạy khi tiến trình đã ngừng.

Hiển thị lỗi thân thiện, ví dụ:

"Gemini đang quá tải. Đã lưu tiến trình. Hệ thống sẽ thử lại trong 8 giây."

Thông tin HTTP chi tiết phải nằm trong Diagnostics, không chiếm giao diện chính.

### 5. THIẾT KẾ LẠI GIAO DIỆN — FULL UI/UX REDESIGN

Tôi chưa hài lòng với giao diện V1.10.7.

Yêu cầu thay đổi thiết kế ở cấp độ hệ thống, không chỉ sửa màu hoặc border-radius.

**Phong cách:** Academic Desktop Studio.

Màu định hướng:

- Navy `#17365D`
- Teal `#237D83`
- Light background `#F8F9FB`
- Surface `#FFFFFF`
- Soft border `#DDE4EC`
- Gold accent `#D9A65A`

Có thể tinh chỉnh màu để đạt độ tương phản và sự hài hòa tốt hơn.

#### 5A. Design System

Tạo bộ design tokens tập trung:

- Colors.
- Typography.
- Spacing.
- Radius.
- Shadows.
- Elevation.
- Component sizes.
- Motion.
- Light/dark themes.

Thiết kế thống nhất button, input, select, filter, table, modal, drawer, toast, progress, tooltip và empty state.

Không để mỗi module tự định nghĩa một phong cách.

#### 5B. Navigation và Workspace

- Sidebar dạng icon rail thu gọn.
- Tooltip rõ ràng.
- Có thể mở rộng khi cần.
- Topbar mảnh, hiển thị breadcrumb và hành động chính.
- Nội dung sử dụng tối đa diện tích hữu ích.
- Giảm khoảng trắng chết.
- Loại bỏ các trang trí thừa.
- Có khả năng thay đổi độ rộng các panel.

#### 5C. Question Bank

Thiết kế không gian ba vùng:

**Trái:** Cây chương trình và bộ lọc.

**Giữa:** Danh sách câu hỏi có virtual scrolling, thao tác chọn nhiều và các chỉ báo trạng thái.

**Phải:** Xem trước LaTeX/TikZ, đáp án, lời giải, metadata và công cụ chỉnh sửa.

Cho phép ẩn hoặc thu gọn panel để tăng diện tích hiển thị câu hỏi.

Không để sidebar chiếm quá nhiều không gian.

#### 5D. AI Classification Workspace

Bỏ cách bố trí tất cả kết quả trong một modal nhỏ như hiện tại.

Tạo khu vực quét AI chuyên dụng với:

- Thanh tiêu đề và model đang sử dụng.
- Bảng tiến trình.
- Danh sách câu đã quét.
- Trạng thái retry/pause/error.
- Hai cột đối chiếu câu hỏi và đề xuất AI.
- Điều khiển duyệt/từ chối/chỉnh sửa.
- Bộ lọc chỉ hiện câu có độ tin cậy thấp.
- Lịch sử các lần quét.
- Nút thử lại các câu lỗi.
- Nút xuất báo cáo.

Phân biệt rõ:

- AI đã phân loại.
- Giáo viên đã duyệt.
- Câu đã được cập nhật ID thực tế.

Các trạng thái này không được đánh đồng.

#### 5E. Settings

Thiết kế lại toàn bộ Settings theo các mục:

- General.
- Appearance.
- Database & Backup.
- TeX Live.
- AI Providers.
- API Keys.
- Models.
- Classification Prompts.
- Performance & Cache.
- Diagnostics.
- Updates.

Có hỗ trợ nhiều API key và nhà cung cấp khi đã có adapter thật.

Không hiển thị model chưa được xác minh tương thích như một lựa chọn có thể sử dụng chắc chắn.

Có nút kiểm tra kết nối và khả năng structured output.

API key phải được lưu an toàn và không xuất hiện trong log.

### 6. HOÀN THIỆN QUESTION BANK ENGINE

Tiếp tục phát triển dựa trên SQLite hiện tại.

Các nhiệm vụ:

1. Hoàn thiện parser ex_test có hỗ trợ nesting.
2. Xử lý đầy đủ hình TikZ và ảnh ngoài.
3. Bảo toàn mã LaTeX gốc.
4. Hoàn thiện bảng asset, tag, classification và import job.
5. Thêm FTS5 hoặc tìm kiếm hiệu quả tương đương.
6. Tạo backend pagination.
7. Phát hiện câu hỏi trùng và gần giống.
8. Quản lý lịch sử chỉnh sửa.
9. Quản lý nguồn câu hỏi.
10. Kết nối ma trận đề với ngân hàng.
11. Phân loại theo GDPT 2018.
12. Có cơ chế backup/restore an toàn.

Phải đảm bảo số câu hỏi và dữ liệu cũ không bị mất khi cập nhật.

### 7. LATEX/TIKZ RENDERING ENGINE

Không dùng KaTeX làm giải pháp duy nhất cho những câu có TikZ hoặc macro ex_test.

Giữ chế độ biên dịch TeX Live chính xác.

Nghiên cứu và triển khai cache SVG/PDF phù hợp.

Giải quyết:

- Hình mất khi xem trước.
- Hình bị cắt.
- Font không đồng nhất.
- Câu hỏi tràn khung.
- Lỗi preamble.
- Macro chưa khai báo.
- Ảnh không tìm thấy.
- Tác vụ biên dịch xung đột.
- Preview cũ hiển thị sau khi người dùng sửa câu.

Cung cấp chẩn đoán lỗi theo từng câu.

### 8. KIỂM THỬ BẮT BUỘC

Sử dụng bộ 200 câu hỏi đã có để chạy regression tests.

Bổ sung kiểm thử AI bằng mock server, không phụ thuộc hoàn toàn vào Gemini thật.

Các ca kiểm thử bắt buộc:

- Gemini trả HTTP 503 nhiều lần rồi thành công.
- Gemini trả 429.
- Model không tồn tại.
- JSON sai schema.
- Người dùng hủy giữa lô 200 câu.
- Mất kết nối ở câu giữa lô.
- Chạy lại mà không mất kết quả cũ.
- Câu thiếu hình.
- Câu có mã ID sai.
- Câu chưa có dạng trong cây.
- Câu có nhiều cách giải.
- Câu trả lời ngắn.
- Câu đúng/sai nhiều mệnh đề.
- Câu có TikZ phức tạp.
- Đổi theme và kích thước cửa sổ.
- Migration từ V1.10.7.
- Backup và restore.

Đo lường kết quả thực tế.

Không tự tạo tỷ lệ thành công hoặc benchmark giả.

### 9. PHƯƠNG PHÁP TRIỂN KHAI

Chia thành các mốc có thể kiểm chứng:

**Milestone 0 — Baseline**

Đọc source, tạo backup, chạy test hiện trạng, xác nhận các lỗi thực tế.

**Milestone 1 — AI Reliability**

Sửa 503, retry, queue, model validation, prompt manager và classification engine.

**Milestone 2 — Database & Parser**

Hoàn thiện SQLite, nhập LaTeX, search, duplicate detection và data integrity.

**Milestone 3 — Rendering**

Cải tiến TeX Live preview và kiểm thử TikZ.

**Milestone 4 — UI/UX Rebuild**

Tạo design system mới và chuyển đổi toàn bộ các module.

**Milestone 5 — Exam Builder**

Hoàn thiện tạo đề, ma trận và xuất đề.

**Milestone 6 — QA & Release**

Chạy toàn bộ unit, integration, E2E và native tests; build Windows installer nếu môi trường hỗ trợ.

Sau mỗi milestone, báo cáo chính xác các file đã sửa, test đã chạy và những vấn đề còn tồn tại.

### 10. TIÊU CHUẨN CHẤP NHẬN

Một milestone chỉ được đánh dấu hoàn thành khi:

- Mã nguồn đã được sửa thực sự.
- Kiểm tra TypeScript và build tương ứng đạt yêu cầu.
- Test liên quan được chạy và có kết quả.
- Các chức năng cũ quan trọng không bị hỏng.
- Không mất dữ liệu.
- Không xuất hiện lỗi nghiêm trọng mới.
- Giao diện không bị vỡ ở các kích thước cửa sổ được kiểm thử.

Riêng bộ quét AI phải có bằng chứng từ mock tests cho cơ chế retry, queue, parse JSON và lưu tiến trình. Độ chính xác phân loại thực tế phải đánh giá bằng tập câu có nhãn chuẩn do giáo viên xác nhận.

### 11. SẢN PHẨM BÀN GIAO

Tôi yêu cầu:

- Source ZIP hoàn chỉnh.
- Changelog.
- Test report.
- Danh sách các file thay đổi.
- Hướng dẫn migration.
- Hướng dẫn chạy và build.
- File `.exe`/installer nếu build thành công.
- Danh sách tính năng chưa hoàn thành, nếu có.

Không tuyên bố đã tạo EXE khi chưa build thực tế.

Không tạo giao diện mock thay cho chức năng thật.

Không dừng ở việc viết tài liệu.

### 12. CHỈ ĐẠO THỰC THI

Hãy chủ động quyết định những phương án kỹ thuật phù hợp.

Nếu phải lựa chọn giữa giao diện đẹp và dữ liệu an toàn, ưu tiên dữ liệu an toàn.

Nếu phải lựa chọn giữa AI trả lời nhanh và AI trả lời đáng tin cậy, ưu tiên tính đúng đắn.

Không tạo thêm độ phức tạp kiến trúc nếu không mang lại lợi ích rõ ràng.

Không hỏi lại những lựa chọn có thể xác định từ source và đặc tả. Chỉ yêu cầu xác nhận đối với thay đổi có thể làm mất dữ liệu, phát sinh chi phí đáng kể hoặc thay đổi nghiệp vụ không thể suy ra.

**BẮT ĐẦU NGAY:**

1. Đọc và kiểm toán mã nguồn V1.10.7.
2. Xác nhận những lỗi trong Classification Engine.
3. Thực hiện Milestone 0 và Milestone 1.
4. Chạy kiểm thử.
5. Bàn giao mã nguồn đã cập nhật.
6. Tiếp tục các milestone còn lại theo thứ tự khi môi trường và hạn mức cho phép.

MỤC TIÊU: Xây dựng Teacher Workspace V2.0 trở thành một ứng dụng desktop chuyên nghiệp dành riêng cho giáo viên Toán, có ngân hàng câu hỏi chính xác, AI đáng tin cậy và giao diện thực sự hiện đại.

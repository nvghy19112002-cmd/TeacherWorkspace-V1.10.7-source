# Kiểm tra V1.10.3 · 16/10/2026

- `npm run check`: đạt lint, TypeScript, production build và **177/177 kiểm tra** trong 18 tệp.
- Playwright: **13/13 luồng giao diện** đạt. Luồng ID được chạy lại sau sửa nhận diện dạng UUID và vẫn đạt.
- Luồng ID dùng phản hồi Gemini giả lập để chủ động tái hiện lỗi JSON, thử lại, mã chuỗi sai dù nút đúng, sửa dạng/mức độ, xác nhận giáo viên, lưu/reload thật qua ngân hàng SQLite; giữ nguyên UUID và LaTeX.
- Kiểm tra giao diện ID ở 1024×768: không tràn chiều ngang; có đối chiếu câu và phân loại, phần tùy chọn thu gọn sau quét.
- Các kiểm tra mới gồm: nguồn/cây thay đổi sau quét; metadata cũ thiếu dấu vân tay; ID khóa; giữ số thứ tự; YCCD ngoài bài; đề xuất ngoài phạm vi; giữ cảnh báo nhập; trạng thái kiểm tra đáp án; 6 dạng có trong nguồn; dạng UUID tự thêm; va chạm dạng do giáo viên chỉnh; phạm vi ngữ cảnh; thiếu danh mục/hình; hủy thử lại; lỗi tạm thời; tiếp tục qua câu lỗi và dừng khi lỗi cấu hình chung.
- `node scripts/check-native-lock.mjs`: đạt, phiên bản ứng dụng và Cargo.lock đều 1.10.3. Giữ SDK/toolchain của 1.10.2. Sửa công cụ tăng phiên bản để không bỏ sót mục ứng dụng trong Cargo.lock.

## Phạm vi chưa xác minh

Không gọi API Gemini bằng key thật. Chưa có tập câu gán nhãn chuẩn do giáo viên duyệt để đo độ chính xác chuyên môn hoặc so sánh model. Các kiểm tra giả lập chứng minh cơ chế xử lý/kiểm tra/lưu dữ liệu; không chứng minh AI phân loại đúng mọi câu thực tế.

Không build installer Windows hay chạy lại native Rust trong lần sửa này; mã native được giữ từ 1.10.2, ngoài thay đổi phiên bản package/lockfile. Bản này tập trung module phân loại và giao diện TypeScript.

Danh mục YCCD/dạng chưa đầy đủ thì cần bổ sung trước khi kỳ vọng phân loại sâu. Chưa hỗ trợ hình/file ngoài hoặc OCR PDF trong luồng Gemini.

Tài liệu chính thức đối chiếu khi rà adapter JSON Schema: https://ai.google.dev/api/generate-content và https://ai.google.dev/gemini-api/docs/structured-output . App vẫn kiểm tra Zod và tính nhất quán của cây sau phản hồi.

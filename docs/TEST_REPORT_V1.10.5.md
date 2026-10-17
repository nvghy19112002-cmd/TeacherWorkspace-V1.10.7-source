# Kiểm tra V1.10.5 — 16/10/2026

- npm ci từ lockfile.
- npm run check: đạt lint, TypeScript, **189 kiểm tra trong 23 tệp** và Vite production build.
- Playwright: **15 luồng giao diện** đạt.
- node scripts/check-native-lock.mjs đạt, phiên bản 1.10.5 đồng bộ trong package.json, npm lock, Tauri config, Cargo.toml và Cargo.lock.

## Luồng đã kiểm tra

- Gán ID hàng loạt: chưa xác nhận thì không có yêu cầu API; một lần xác nhận chạy cả lô; câu khóa được bỏ qua. Hủy duyệt không đổi ID; xác nhận duyệt áp dụng hai câu, giữ nguyên LaTeX/UUID và trạng thái review.
- Sửa đề xuất một câu: lỗi JSON, thử lại, sửa dạng/mức độ, xác nhận thay checkbox; lưu và tải lại giữ dữ liệu.
- Duyệt lô: số thứ tự duy nhất theo thứ tự câu được chọn, ghi revision, không sửa snapshot đầu vào; bỏ câu stale/khóa; chỉ bản đề xuất mới nhất được xét, không quay về bản cũ.
- Nút và bộ lọc: lọc nhanh loại/hình, xóa bộ lọc, xem code, chép LaTeX đúng câu, mở rộng/thu hẹp xem trước, biên dịch đúng số câu được chọn, chọn trang/bỏ chọn, nhập/dán, sửa, xóa/khôi phục, sắp xếp khay, xuất và mở lại đề đã lưu.
- Cây lọc: ba lớp, tìm bài không dấu, áp dụng bài 20, hiện đường dẫn, xóa riêng lọc mục lục. Quản lý danh mục và xem dữ liệu cũ vẫn tách riêng.
- Chuyển tab khi module tải chậm: nhãn và nội dung vẫn khớp, hình học khung chung giữ nguyên.
- Giao diện 1024×768 không tràn ngang; hộp xác nhận ID dưới 550 px, tùy chọn nâng cao mặc định đóng; đầu trang ở 1440 px không quá 70 px. Đã xem ảnh QA nội bộ, không đưa vào gói bàn giao.
- Xem nhanh: KaTeX hệ phương trình, chữ đậm có công thức, danh sách, lời giải thu gọn; TikZ trong immini và lời giải giữ vị trí, không lộ lệnh vẽ thô, nguồn TikZ có textbf/math được gửi nguyên vẹn tới renderer.
- TeX thật: biên dịch được hình riêng với pdfLaTeX; pdfinfo xác nhận trang nhỏ dưới 200×150 pt thay vì A4. Các fixture TeX tiếng Việt/TikZ/batch của bản trước tiếp tục đạt.
- Hàng đợi TeX giả lập: tuần tự, dùng lại cache đúng khóa, đổi cấu hình tạo kết quả mới; hủy việc đang chờ không gọi hủy tác vụ khác.

## Giới hạn

Không dùng API key Gemini thật, không đo độ chính xác chuyên môn. Danh mục dạng/YCCD chưa đầy đủ vẫn cần giáo viên bổ sung/duyệt.

Kiểm tra GUI chạy trình duyệt với Gemini giả lập. TikZ đã kiểm tra biên dịch thật trên Linux và hàng đợi qua kiểm tra tự động; chưa xác nhận hiển thị PDF blob/TikZ thực tế trong WebView Windows hoặc mọi bộ khai báo của người dùng. Trình duyệt thử không gọi TeX Live của máy Windows. Không build native Rust hay tạo installer mới trong phiên này; native code và toolchain giữ nguyên ngoài số phiên bản.

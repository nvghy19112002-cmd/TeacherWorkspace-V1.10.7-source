# M3 — Rendering integrity and cache

- TikzPreview chỉ hiển thị hình gắn với đúng source và lần tải hiện tại. Khi sửa nguồn, hình cũ biến mất ngay; nếu biên dịch mới lỗi, không giữ hình cũ làm kết quả mới.
- Queue cache gắn với document/question/settings thật, không chỉ nhãn do caller truyền. Không cache compile của nguồn có input/include/includegraphics hoặc mode dự án vì phụ thuộc file ngoài có thể thay đổi. Giữ hàng đợi tuần tự và hủy riêng caller.
- Raster cache gắn với SHA-256 của PDF bytes; hai PDF khác nhau dùng cùng nhãn không nhận nhầm ảnh. Clear cache không bị tác vụ đang chạy đổ kết quả cũ trở lại. Thêm kiểm tra kích thước trang và dọn worker/canvas.
- PDF dialog hủy/ẩn kết quả khi đổi nguồn hay cấu hình; kết quả async đã hủy không ghi đè state/PDF mới.
- Cài đặt → Hiệu năng & cache đọc bộ đệm hiện có và xóa cache phiên. Dung lượng TeX là ước lượng bảo thủ cho mảng PDF/string, dung lượng ảnh là dữ liệu mã hóa; không tuyên bố đo chính xác JavaScript heap.
- Không thay KaTeX cho TeX Live: giữ preview nhanh, compile native và diagnostics từng câu hiện có.

## Bằng chứng

244 Vitest tests / 31 files và 14 release tests, lint/TypeScript/build đạt. Các fixture TeX thật vẫn nằm trong suite. E2E mục tiêu: PDF TikZ thật render thành ảnh, cùng nhãn nhưng bytes khác không lẫn cache, xóa cache; corpus 200 câu vẫn render không tràn; native bridge mock kiểm tra hình A biến mất khi nguồn B đang chờ và khi B lỗi. 3 E2E đạt, 1 optional corpus-PDF case bỏ qua do chưa có CORPUS_TEX_DIR. Mock bridge không được coi là thử native Windows thật.

Kiểm tra bổ sung sau checkpoint M3: xelatex thật biên dịch 238 wrapper hình; 237 đạt,
1 lỗi tại hình 49 do macro dự án `\IntervalLR` / `\IntervalGRF` chưa được khai báo.
Không tự bịa định nghĩa có thể làm sai hình. Cần preamble gốc của giáo viên cho ca này.
Toàn bộ 237 PDF thành công đã qua production raster renderer trong Playwright
(1 test đạt, 2,2 phút). Script corpus trả exit code khác 0 nếu còn lỗi và giữ diagnostics
từng hình. Đây không phải kết quả 238/238 đạt.

Giới hạn: file ảnh thiếu phải được bổ sung vào dự án TeX; metadata không tạo ra ảnh.
Chưa xác thực installer Windows V2.

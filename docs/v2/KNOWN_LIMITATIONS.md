# Phần còn cần xác nhận hoặc hoàn thiện

1. **Phát hành Windows:** chưa có EXE V2 được build/xác thực trong máy Linux này.
   Workflow Windows đã có đầy đủ check, native test và NSIS build; phải xem kết quả
   Actions thực tế. Proxy hiện từ chối API GitHub (CONNECT 403), nên không xác nhận
   được trạng thái public, Actions secret hoặc publish release. Không gọi bản nguồn
   này là bản cập nhật đã phát hành.
2. **Chất lượng AI:** retry/queue/schema/ID validation có mock tests; chưa đo độ chính
   xác toán học, retrieval recall hay agreement với giáo viên. Cần bộ nhãn chuẩn và
   đánh giá riêng; không tự động duyệt ID chỉ vì model tự báo confidence cao.
3. **Macro dự án:** 237/238 wrapper hình corpus biên dịch; hình 49 thiếu định nghĩa
   `\IntervalLR` và `\IntervalGRF`. Cần preamble gốc; không tự thay bằng hình gần giống.
   Báo cáo compile giữ source/log từng hình. 237 PDF thành công đã raster thật.
4. **Ảnh ngoài:** lưu references, missing flag và metadata trong SQLite; native TeX
   project mode xử lý file từ dự án được chọn. Backup JSON không đóng gói bytes ảnh
   hoặc toàn bộ dự án TeX. Cần sao lưu thư mục dự án riêng; đóng gói asset portable
   thành bundle tự chứa chưa được triển khai trong đợt này.
5. **Bộ nhớ với ngân hàng rất lớn:** search và paging chạy SQL; danh sách render theo
   cửa sổ. Core edit/backup vẫn load snapshot và các bộ lọc curriculum nâng cao vẫn
   chuẩn bị tập candidate ở frontend. Chưa có benchmark 100.000 câu hay lazy loading
   toàn bộ kho; không tuyên bố đã giải quyết toàn bộ giới hạn bộ nhớ.
6. **Xuất đề:** lưu snapshot, ma trận, điểm, đáp án và xuất ex_test thật; biên dịch
   dùng cấu hình TeX hiện có. Không có bộ template trường học/preamble phổ dụng để
   mọi project đều xuất PDF độc lập chỉ bằng một thao tác. Cần chọn project/preamble
   và bổ sung các file phụ thuộc của giáo viên.
7. **Đầu vào sản xuất:** chỉ có checkout và corpus kèm repository; source ZIP khác,
   install.rar, audit markdown và database giáo viên thật được nhắc trong prompt
   chưa được cung cấp. Kiểm thử migration không thay cho đối chiếu DB sản xuất và
   cài/nâng cấp trên một máy Windows thật có dữ liệu đã backup.

Các giới hạn này được giữ rõ trong báo cáo; không có placeholder mô phỏng thành
chức năng đã chạy, không có key thật trong nguồn và không thay khóa updater hiện có.

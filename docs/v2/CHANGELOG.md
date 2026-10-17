# Teacher Workspace 2.0.0

- Academic Desktop Studio: palette navy/teal, light/dark, thanh điều hướng mở rộng,
  lưu bố cục, kéo độ rộng khung thư viện/khung đọc, danh sách câu render theo cửa sổ.
- Workspace AI phân loại riêng: lưu tiến trình, tiếp tục phần chưa xong, lọc độ tin cậy
  thấp, lịch sử, từ chối có lý do, xuất báo cáo và giáo viên duyệt trước khi đổi ID.
- Gemini: retry có giới hạn và jitter, tôn trọng thời gian chờ, thông báo dễ hiểu,
  diagnostics che key; không xoay key để vượt quota. Kiểm tra schema, ID và đường dẫn
  trước khi nhận đề xuất; model dự phòng chỉ dùng khi đã kiểm chứng cùng key.
- Prompt có phiên bản, thử/so sánh, truy xuất ứng viên curriculum trước request,
  lưu provenance/token usage và chi phí theo bảng giá do người dùng nhập.
- SQLite FTS tìm tiếng Việt không dấu, phân trang backend, migration có bản sao trước
  nâng cấp; tags/assets/import jobs được roundtrip. Parser giữ nesting và mã nguồn gốc.
- Chặn preview cũ sau sửa nguồn/lỗi; cache compile/raster gắn với nội dung thật,
  xóa cache không bị tác vụ cũ điền lại. Biên dịch/raster corpus thật có báo cáo lỗi.
- Settings thành 11 nhóm; khóa, model, prompt, cache, dữ liệu, TeX và cập nhật có chức
  năng thực. Chỉ trình bày provider có adapter thật.
- Tạo đề ma trận theo chương trình/mức/loại/số lượng/điểm, hạt trộn tái lập, không
  lặp nội dung, xử lý ô giao nhau, báo thiếu; snapshot câu/đáp án/điểm không đổi sau
  chỉnh sửa ngân hàng. Lưu nháp, dùng lại ma trận và xuất mã ex_test từ đề đã lưu.

Giữ core lịch, AI Tools, kho tài liệu và các luồng nhập/xuất có sẵn. Giữ identifier,
khóa updater, ID câu và migrations đã có; không gắn khóa riêng vào bản nguồn.

Giới hạn cần đối chiếu: chưa có nhãn chuẩn để đo độ chính xác AI; một hình corpus
thiếu macro dự án; ảnh ngoài vẫn cần file dự án; chưa có installer/Windows run V2
được xác nhận trong môi trường Linux. Xem TEST_REPORT.md và MIGRATION_AND_BUILD.md.

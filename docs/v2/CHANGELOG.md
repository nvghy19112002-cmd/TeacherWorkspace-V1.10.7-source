# Teacher Workspace 2.0.2

- Thêm nút **AI xử lý ID** để đưa toàn bộ câu chưa có ID vào một lô, tối đa 1.000 câu,
  giữ checkpoint và chỉ để giáo viên xử lý ngoại lệ.
- Danh sách Gemini tự lọc và xếp hạng tối đa 5 model văn bản phù hợp nhất từ API;
  loại model TTS, ảnh, live, embedding và tự chọn model đề xuất đầu tiên.
- Ngăn ghi chú ngoặc vuông bị hiểu nhầm là ID6 và ngăn cấp trùng số với dữ liệu cũ
  thiếu `sequenceNumber`.
- Nhận dạng loại câu và hình vẽ chỉ từ LaTeX có hiệu lực trong phần đề, không bị mã
  trong lời giải hoặc comment làm sai metadata.
- Bổ sung tài liệu rà soát chất lượng, mô hình một kho SQLite và lộ trình quản lý nguồn.

## Teacher Workspace 2.0.1

- Ngăn model TTS, âm thanh, hình ảnh, live và embedding xuất hiện trong danh sách model
  dùng cho tác vụ JSON văn bản.
- Chặn quét Gán ID trước khi gọi API nếu model đã lưu không tương thích; giao diện chỉ rõ
  cách tải danh sách, thử structured output và lưu model văn bản.
- Áp dụng cùng một kiểm tra cho AI Tools, phép thử model và phân loại ngân hàng câu hỏi để
  tránh mất lượt API hoặc tạo cả lô lỗi với model không hỗ trợ JSON schema.

## Teacher Workspace 2.0.0

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

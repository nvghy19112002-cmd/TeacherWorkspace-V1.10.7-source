# M0 — Baseline

Checkout kiểm toán: Teacher Workspace 1.10.8, kế thừa V1.10.7, commit e3d8e81. Không viết lại core hoặc đổi identifier/khóa updater.

Đã tạo bản mã trước thay đổi: `/workspace/teacher-workspace-deliverables/baseline/teacher-workspace-1.10.8-before-v2.tar.gz` và lưu SHA trong cùng thư mục. Archive chỉ gồm file Git của dự án, không có khóa ký ngoài checkout, node_modules hoặc database người dùng.

Baseline `npm run check`: 26 file Vitest / 198 tests đạt; 14 tests phát hành đạt; lint, TypeScript, Vite production build đạt. Bộ test hiện có bao gồm corpus 200 câu, SQLite và biên dịch TeX thật trên Linux.

## Các vấn đề xác nhận từ mã

- classificationProvider cắt Retry-After ở 5 giây và không hỗ trợ HTTP-date.
- Retry chỉ dành riêng classification; AI Tools chưa dùng cùng policy.
- HTTP 429 có thể luân chuyển API key khi bật automatic; không phù hợp yêu cầu mới.
- scanQueue có trạng thái tạm trong component; đóng/mở dialog không có checkpoint bền vững.
- Lỗi kỹ thuật HTTP và chi tiết provider nằm trong thông điệp chính.
- Có system prompt thật nhưng chưa có phiên bản/hồ sơ prompt gắn với mỗi lượt quét.
- promptInput mặc định gửi toàn bộ cây phạm vi; chưa có truy xuất ứng viên trước request.
- JSON schema không thay thế kiểm tra ID/path; cần chặn ID bịa trước khi lưu đề xuất.
- Không có bằng chứng chạy native Windows trong máy Linux này.

## Giới hạn dữ liệu đầu vào

Dùng checkout thực tế và `tests/data/preview-200.tex`. ZIP nguồn, install.rar, audit markdown được nhắc trong MASTER_PROMPT chưa được cung cấp trong workspace phiên này. Không dùng hoặc sao chép mã/tài nguyên độc quyền MathHub. Không có database giáo viên thật để chứng nhận migration trên dữ liệu sản xuất; kiểm thử backup/restore sử dụng fixture và 200 câu trong repository, không bịa số liệu thực tế hoặc độ chính xác AI.

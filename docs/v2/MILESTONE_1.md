# M1 — AI reliability (ứng viên V2)

## Thay đổi đã triển khai

- Request Manager dùng chung: nhận dạng lỗi cấu hình/xác thực/model, quota, giới hạn tần suất, timeout/network, service, invalid JSON và schema. Retry tối đa 4 lần, exponential backoff + jitter; đọc Retry-After dạng giây/ngày HTTP và Google RetryInfo. Cooldown quá dài dừng lô thay vì retry sớm/vô hạn.
- Không tự chuyển key khi gặp quota. Giữ metadata key cũ tương thích nhưng bỏ điều khiển né quota trong UI.
- Model dự phòng phải do người dùng cấu hình và đã thử structured output trên cùng key trong 30 ngày; chỉ fallback sau lỗi dịch vụ tạm thời, không vì 429.
- Hàng đợi đủ 8 trạng thái, checkpoint trước request/đổi trạng thái vào settings SQLite; từng kết quả AI tiếp tục được commit độc lập theo revision. Đóng dialog hủy request, giữ kết quả; mở lại không giả lập task còn chạy. Cooldown đã lưu được giữ khi tiếp tục.
- Prompt engine kntt-classification-2.0.0 giữ một system instruction bất biến, task, ngữ cảnh, validation rules và schema. Thêm phiên bản hướng dẫn của giáo viên, khôi phục mặc định, thử/so sánh một câu có xác nhận phí; các phép thử không tự đổi ID.
- Retrieval theo nhóm kiến thức chỉ truy xuất ứng viên, không quyết định nhãn. Không có ứng viên thì mở rộng; AI out_of_scope trên phạm vi thu hẹp có một lần mở rộng trong phạm vi giáo viên chọn. Không mặc định hiểu TikZ khi chưa gửi ảnh.
- Kiểm tra ID/node kind/path và YCCD trước khi nhận đề xuất; giáo viên vẫn phải duyệt. Chỉ lưu token do provider báo cáo; ước tính USD chỉ khi có đơn giá do người dùng nhập, không coi là hóa đơn và không bao gồm usage không được báo cáo.
- Tách thông điệp thân thiện khỏi Diagnostics đã che key. Lưu phiên bản/hash prompt, model, usage, phạm vi truy xuất vào mỗi classification run.

## Cách sử dụng

Cài đặt → Prompt phân loại để tạo/chọn phiên bản, khai báo model dự phòng đã thử JSON và đơn giá tùy chọn. Trong Ngân hàng → chọn câu → Gán ID: xác nhận gửi dữ liệu, xem tiến trình; đóng để dừng, mở lại để tiếp tục các câu chưa hoàn thành. Đã lưu đề xuất, giáo viên đã duyệt và ID đã áp dụng là các khái niệm khác nhau.

## Tương thích dữ liệu

M1 dùng các khóa mới trong `settings.moduleState` hiện có và metadata bổ sung trong `classification_runs.result_json`; không sửa migration 001/002 hoặc các câu LaTeX gốc. Backup workspace bao gồm cấu hình prompt/checkpoint; backup ngân hàng bao gồm lịch sử đề xuất. Các cấu hình cũ không có trường mới dùng mặc định an toàn. App cũ không biết cách tiếp tục job V2.

Test SQLite đã xuất/reopen bytes chứa đủ 200 source gốc và checkpoint 36 câu hoàn thành + câu 37 bị gián đoạn; so sánh source từng UUID và PRAGMA quick_check.

## Giới hạn cần giữ rõ

Đây là mốc AI của kế hoạch V2, chưa phải toàn bộ V2. UI workspace lớn, hệ thống thiết kế, database/pagination/assets và Exam Builder theo các mốc sau. Chưa đánh giá độ chính xác retrieval/classification bằng bộ nhãn giáo viên xác nhận, chưa dùng Gemini trả phí thật. Native Windows build/tests và installer của thay đổi này chưa được xác nhận từ máy Linux.

Kết quả chạy cuối và danh sách file thay đổi được ghi trong TEST_REPORT.md sau khi checks hoàn tất. Không công bố EXE khi chưa build Windows thành công.

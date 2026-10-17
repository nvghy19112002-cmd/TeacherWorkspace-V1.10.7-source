# M2 — Database, parser, search and integrity

## Thay đổi

- Thay tách `ex` bằng regex không tham lam bằng scanner cân bằng begin/end, giữ nguyên source kể cả nested groups. `ex` lồng được giữ nguyên trong câu ngoài và có cảnh báo cần giáo viên tách, không bỏ mất câu phía sau; block thiếu đóng bị từ chối.
- Migration 003 bổ sung FTS4 unicode61 và index lọc. FTS4 được chọn vì WASM sql.js hiện có FTS3/4 nhưng không có FTS5; đã kiểm tra khả năng thực tế. Chỉ mục tìm kiếm và liên kết nhãn được đồng bộ bằng trigger trong transaction.
- Tìm kiếm không dấu/đ-Đ, từ khóa prefix AND; truyền ID/parameter có kiểm định, không thực thi cú pháp tìm kiếm SQL do người dùng đưa vào.
- API search_question_bank trên Rust và browser driver thực hiện LIMIT/OFFSET trên SQLite. UI dùng ID trang do backend trả. Để giữ tương thích mã ID6 cũ và các thao tác khay/toàn bộ kết quả, bộ lọc phân cấp/sắp xếp vẫn chọn ordered IDs phía client và API có trả danh sách matching IDs; store vẫn tải snapshot đầy đủ để chỉnh sửa/backup. Chưa tuyên bố giải quyết hoàn toàn bộ nhớ của ngân hàng 100.000 câu hoặc có benchmark sản xuất.
- Bổ sung assets, tagDefinitions, importJobs vào schema/codec/snapshot với mặc định tương thích JSON backup cũ. Đăng ký đường dẫn includegraphics dưới dạng chưa xác minh, không giả vờ đã sao chép ảnh. Lịch sử nhập thành công được lưu cùng transaction với câu; định nghĩa/quan hệ tag được chuẩn hóa. Classification run/revision/source/exam snapshot cũ tiếp tục giữ nguyên.
- Khôi phục ngân hàng bắt buộc lưu bản sao hiện tại; hủy lưu thì không thay dữ liệu. Browser lưu bytes trước migration và main mới trong một transaction IndexedDB; native VACUUM INTO rồi quick_check backup trước upgrade.
- Kiểm tra hash cũ thêm đối chiếu source bảo toàn hoa/thường và escaped percent trước khi gọi là exact duplicate; không tự gộp/xóa câu gần giống. Vẫn coi dfrac/frac là tương đương trình bày.

## Kiểm tra và giới hạn

Bằng chứng: tests/bank-search-migration.test.ts, parser-backup-v2.test.ts, e2e/bank-search.spec.ts và các suites nhập/thư viện hiện có. Test migration mở database user_version=2 thật chứa corpus 200 câu, nâng lên 3, so sánh nguyên source từng UUID, mở lại bản backup v2 và kiểm tra quick_check. Test FTS qua 65 câu xác nhận trang 50/15 và cập nhật index khi sửa.

Rust 1.95.0 đã được cài trong `/workspace/.rustup` và `/workspace/.cargo`. `scripts/check-native-db.py` biên dịch nguyên logic database với versions từ Cargo.lock, chỉ loại các IPC wrapper cần Tauri/GTK trong bản kiểm thử tạm; 5 tests Rust database đạt. Đây không phải full native Windows validation. Full Rust tests/build Windows vẫn do CI chạy.

Metadata backup không chứa bytes ảnh ngoài. Sao lưu dự án TeX/ảnh/PDF bằng cơ chế kho tài liệu và thư mục dự án; file chưa có vẫn cần giáo viên bổ sung. Không có database sản xuất hoặc bộ audit ngoài repository để kiểm tra thêm. Chưa tuyên bố đã build installer V2.

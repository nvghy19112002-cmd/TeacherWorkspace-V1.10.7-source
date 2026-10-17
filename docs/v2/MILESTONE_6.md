# M6 — QA và bàn giao mã nguồn

Phiên bản 2.0.0 đã đồng bộ bằng release:version; check cuối đạt 250 unit tests,
14 release tests, lint, TypeScript và production build. Full browser suite đạt
26/26, có cả raster 237 PDF thật. Hai E2E studio/ma trận đạt sau đổi phiên bản;
regression layout bổ sung kiểm tra pointer và hàng cuối nằm trong viewport đạt.
5 isolated Rust SQLite tests đạt. Xem TEST_REPORT.md để biết phạm vi và giới hạn.

Bàn giao: mã nguồn đầy đủ, checksum, changelog, danh sách thay đổi theo milestone,
báo cáo kiểm thử, ảnh QA, hướng dẫn migration/chạy/build và danh sách chưa hoàn thiện.
Gói nguồn không chứa private key, database người dùng, node_modules hoặc .git.
Giữ nguyên identifier và updater public key; migration 001/002 không đổi.

**Phần chưa hoàn tất của M6:** build/cài/nâng cấp Windows thật và publish release
đã ký. Môi trường Linux này không build EXE Windows; proxy chặn API GitHub nên
không xác nhận được Actions secret hoặc trạng thái release. Không tạo tag phát hành
để chạy ký khi các điều kiện này chưa được kiểm chứng. Push main sẽ kích hoạt
workflow Windows checks and installer; thành công mới có artifact bộ cài CI.

Các trường hợp cần đầu vào giáo viên: preamble cho hình 49, nhãn chuẩn AI, database
sản xuất để đối chiếu. KNOWN_LIMITATIONS.md còn ghi rõ asset bundle portable và
giới hạn bộ nhớ/snapshot. Không đánh dấu các phần này đã hoàn thành.

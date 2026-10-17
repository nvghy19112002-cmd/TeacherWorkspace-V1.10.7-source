# Kiểm chứng Teacher Workspace V1.9.0

Ngày: 16/10/2026. Source tiếp tục từ V1.8.2. Thay đổi tập trung vào frontend, quy tắc lưu câu và chuẩn bị LaTeX; không sửa migration SQL hoặc backend Rust.

## Kết quả

| Kiểm tra                                  | Kết quả                                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| ESLint                                    | Đạt, 0 cảnh báo                                              |
| TypeScript strict                         | Đạt                                                          |
| Vitest                                    | 15 tệp, 151/151 bài đạt                                      |
| Vite production build                     | Đạt                                                          |
| Playwright Chromium                       | 11/11 luồng đạt                                              |
| TeX thật                                  | 5/5 bài đạt: 4 pdfLaTeX, 1 XeLaTeX tiếng Việt                |
| Installer Windows, backend Rust           | Chưa chạy; môi trường Linux không có Cargo/Windows toolchain |
| Gemini thật và Windows Credential Manager | Chưa gọi/kiểm tra trong phiên này                            |

## Những luồng đã kiểm tra

- Nhập .tex có bước duyệt, bỏ câu trùng, đọc ID6/đáp án và cảnh báo macro riêng.
- Dán nhiều câu LaTeX, tìm tiếng Việt không dấu, sửa nguồn, Ctrl+S, lưu lại đáp án/lời giải và xem lịch sử.
- Khôi phục câu trong thùng rác; dữ liệu tồn tại sau reload qua SQLite WASM/IndexedDB thật.
- Chọn câu theo thứ tự khác danh sách, đổi vị trí trong khay, xuất .tex đúng thứ tự và giữ nguyên từng rawSource.
- Đề đã lưu xuất lại nguyên snapshot ngay cả sau khi sửa câu trong ngân hàng; ID câu đã dùng được khóa.
- Bảo vệ thay đổi chưa lưu; kiểm tra không tràn ngang ở 1024×768.
- Các luồng cũ: AI Tools offline/mô phỏng provider, lịch lặp, kéo thả, resize, thống kê/trạng thái, backup/restore, nhân bản workspace và xuất ảnh.
- Bảo toàn đáp án/lời giải nhập riêng ở kho cũ; nhắc đối chiếu khi nguồn thay đổi. Xóa lời giải có sẵn trong nguồn sẽ xóa metadata đã nhận diện tương ứng.
- Bộ mẫu tiếng Việt 4 câu: trắc nghiệm, choiceTF[1t], câu TikZ và shortans. Kiểm tra ID6 liên kết đủ đường dẫn và đáp án C, Đ–S–Đ–S, B, 5.
- 5 bài TeX thật: TikZ và input tương đối theo project; khai báo tích hợp không cần main.tex; immini+itemize+TikZ; biên dịch nhóm đúng thứ tự; bộ câu tiếng Việt bằng XeLaTeX không có cảnh báo `Missing character`.

Giao diện được kiểm tra trực quan bằng ảnh nội bộ của trạng thái thư viện có dữ liệu và trình sửa song song. Các ảnh nội bộ không được đưa vào gói source. Các ảnh lịch cũ trong docs/screenshots được giữ nguyên từ gói V1.8.2.

## Môi trường và giới hạn

- Node.js 24.19.0, dependency được cài bằng package-lock.json của source. `npm run check` chạy lint, tests và build.
- Chromium 153 được dùng qua PLAYWRIGHT_CHROMIUM_EXECUTABLE. Bộ Chromium chuẩn tải không trọn vẹn ở môi trường này; binary thay thế chỉ dùng để kiểm tra, không thêm vào dependency hoặc source ứng dụng.
- TeX Live 2023/Debian có pdfLaTeX và XeLaTeX. Máy kiểm tra thiếu bộ T5 cho pdfLaTeX, nên fixture tiếng Việt dùng XeLaTeX; native preview sẽ chỉ dẫn đổi engine/cài T5 khi gặp trường hợp này.
- Bản Windows vẫn cần kiểm tra PDF inline/WebView2, tự tìm TeX Live, cài đè lên dữ liệu thật, khai báo ex_test riêng và thao tác bỏ câu lỗi trong nhóm. Thao tác bỏ câu lỗi được triển khai dựa trên ánh xạ dòng/câu trong log; chưa chạy end-to-end qua Tauri trên Windows.
- Chưa benchmark kho lớn hoặc chuyển truy vấn sang SQLite. Không coi kiểm tra browser là chứng nhận installer Windows.
- Cây MathHub và dữ liệu người dùng giữ cấu trúc cũ; không có migration mới. Cargo.lock chưa có từ bản nguồn gốc.

## Chạy lại

```powershell
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
```

Hai dòng cuối liên quan native/browser cần môi trường tương ứng. Trên Windows dùng Build-Windows.cmd hoặc workflow Windows checks and installer để kiểm tra và đóng gói bộ cài.

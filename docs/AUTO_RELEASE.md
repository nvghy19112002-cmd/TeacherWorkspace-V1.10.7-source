# Phát hành cập nhật qua GitHub

## Kênh mới từ 1.10.8

Mã nguồn và bản phát hành cùng nằm tại `nvghy19112002-cmd/TeacherWorkspace-V1.10.7-source`. Endpoint của app:

`https://github.com/nvghy19112002-cmd/TeacherWorkspace-V1.10.7-source/releases/latest/download/latest.json`

Người dùng đã đồng ý tạo khóa ký mới và cài thủ công một lần để chuyển kênh. App cũ dùng endpoint TeacherWorkspace và khóa cũ sẽ không tự nhận/xác minh bản này. Cài bản 1.10.8 có chữ ký từ kênh mới một lần; các bản sau dùng **Cài đặt → Cập nhật → Kiểm tra cập nhật → Tải và cập nhật**. Giữ nguyên identifier `com.teacherworkspace.desktop`; xuất backup lịch, ngân hàng và kho tài liệu trước lần cài chuyển tiếp. Không gỡ ứng dụng hoặc xóa dữ liệu cũ.

## Thiết lập một lần

1. Đưa các thay đổi đã kiểm tra lên nhánh main của repository mã nguồn; repository phát hành phải công khai để app tải được mà không cần token GitHub.
2. Khóa mới được tạo ngoài checkout tại `/workspace/teacher-workspace-signing/updater.key`, file công khai ở cùng thư mục với đuôi `.pub`. Thư mục này không được commit. Khóa không đặt mật khẩu để ký tự động; bảo vệ quyền truy cập file và lưu bản sao vào nơi lưu trữ bí mật trước khi xóa môi trường đám mây. Không gửi khóa trong chat, không đưa vào artifact/issue/log.
3. Trong repository → Settings → Secrets and variables → Actions, tạo secret `TAURI_SIGNING_PRIVATE_KEY` chứa nội dung file khóa riêng qua kênh nhập an toàn. Với khóa mới không mật khẩu, không cần `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Nếu sau này mã hóa khóa, đặt secret mật khẩu tương ứng. Đây là GitHub Actions secret, không phải biến frontend VITE_ hoặc secret proxy của môi trường cloud.
4. Nếu đã có quyền GitHub CLI trực tiếp, có thể nhập an toàn bằng lệnh dưới đây (không in nội dung khóa). Không chạy khi chưa xác minh quyền đúng repository:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo nvghy19112002-cmd/TeacherWorkspace-V1.10.7-source < /workspace/teacher-workspace-signing/updater.key
```

5. Bật Actions và cho workflow quyền Contents read/write. Workflow dùng token tích hợp của GitHub; không cần PAT cho pipeline cùng repository.
6. Actions → **Publish Windows update** → Run workflow trên main sau khi các thay đổi đã có trên GitHub. Hoặc đẩy tag `v1.10.8` trỏ đến commit tương ứng.
7. Chỉ tải installer `.exe` từ release công khai sau khi workflow thành công. Cài bản chuyển tiếp trên Windows, xác nhận dữ liệu còn đủ. Bản tiếp theo mới chứng minh luồng nâng cấp giữa hai phiên bản thực tế.

## Mỗi lần phát triển và phát hành tiếp theo

Developer triển khai thay đổi và kiểm thử theo DEVELOPMENT.md. Ví dụ khi phát hành bản kế tiếp:

```bash
npm run release:version -- 1.10.9
npm run check
# Chạy E2E, kiểm tra diff và commit cả Cargo.lock/package-lock.json đã đồng bộ phiên bản.
git push origin main
git tag v1.10.9
git push origin v1.10.9
```

Chỉ tạo tag sau khi commit thay đổi; ví dụ trên không tự commit mã. Workflow cũng hỗ trợ Run workflow trên main đã tăng phiên bản. Không tái dùng phiên bản đã công bố.

Workflow đọc endpoint từ cấu hình, đối chiếu repository và phiên bản/tag, kiểm tra kênh công khai và secret, chạy lint/unit/release tests/build/E2E/native tests, build/ký NSIS rồi tải lên draft. Trước khi publish, script tải manifest, chữ ký và installer từ release, đối chiếu phiên bản/địa chỉ/file và xác minh chữ ký Ed25519/minisign bằng public key trong app. Chỉ publish khi mọi kiểm tra đạt; lỗi thì bản nháp không được công bố.

Sau khi có release mới hợp lệ, người dùng bấm nút cập nhật trong app, xác nhận và để app tải/xác minh, sao lưu SQLite rồi chạy installer. Có thể cần đóng/mở lại app theo hướng dẫn. Không cần tải ZIP, cài Node hay build thủ công.

## Khôi phục khi phát hành lỗi

Không sửa/xóa một bản đã được cài để ép hạ cấp. Sửa lỗi trên mã nguồn, tăng phiên bản mới và phát hành bản sửa. Nếu workflow lỗi trước publish, xem log và artifact chẩn đoán, sửa nguyên nhân rồi chạy lại bản nháp. Không bỏ kiểm tra chữ ký hoặc thay khóa để làm pipeline qua.

## Trạng thái xác thực

Kiểm tra cục bộ bản 1.10.8 đã đạt: lint, TypeScript, production build, 198 kiểm thử ứng dụng, 14 kiểm thử kênh/chữ ký và 18 E2E. Một E2E corpus PDF tùy chọn bỏ qua do chưa đặt CORPUS_TEX_DIR. Khóa mới đã ký thử bằng Tauri CLI và xác minh bằng public key trong cấu hình; file bị sửa bị từ chối. Đây là kiểm tra fixture, chưa phải installer Windows đã build.

Khóa mới và cấu hình đã được tạo trong cloud; mã pipeline và kiểm thử chữ ký được chuẩn bị cục bộ. Chưa xác nhận secret trên GitHub, chưa chạy workflow Windows, chưa phát hành hoặc thử cài/nâng cấp trên máy Windows. Git đọc được cả hai repository; API GitHub bị chính sách mạng cloud từ chối trong lần kiểm tra. Miền api.github.com đã được thêm vào bản nháp cấu hình môi trường; cần lưu cấu hình để áp dụng trước khi thử thao tác API. Việc lưu cấu hình cloud không tự tạo GitHub Actions secrets hoặc publish app.

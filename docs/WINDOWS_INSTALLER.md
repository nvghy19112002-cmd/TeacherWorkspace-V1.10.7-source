# Bàn giao và cập nhật bằng bộ cài Windows

Mục tiêu từ những lần bàn giao sau là cung cấp `Teacher Workspace_x.y.z_x64-setup.exe`, để người dùng không phải tự biên dịch. Cần một lượt build thành công trên Windows và lưu tệp kết quả; không đổi tên ZIP/source thành EXE.

## Pipeline sẵn có

1. Đưa nguồn cập nhật vào repository TeacherWorkspace của chủ dự án.
2. Trên GitHub, mở Actions → Windows checks and installer → Run workflow; hoặc push vào main.
3. Workflow `.github/workflows/windows-build.yml` kiểm tra npm, TypeScript/lint/tests, Rust, thao tác UI rồi build NSIS trên windows-latest.
4. Khi thành công, tải artifact `TeacherWorkspace-Windows-x64-CI-unsigned`, giải nén và lấy **Teacher Workspace_x.y.z_x64-setup.exe**. Đây là bộ cài cần bàn giao; tệp `teacher-workspace.exe` đơn lẻ không phải installer.
5. Trong app: Cài đặt → Cập nhật → Chọn file cập nhật (.exe). App có bước kiểm tra tệp và sao lưu trước khi mở installer. Hoặc chạy installer trực tiếp sau khi sao lưu và đóng app.

Bản build thường dùng tauri.ci.conf.json, không tạo updater artifacts và không cần mật khẩu ký updater. Windows có thể hiển thị thông tin nhà phát hành chưa xác minh vì chưa có chữ ký Authenticode.

## Cập nhật trực tuyến

Workflow windows-release.yml dùng khóa ký updater và mật khẩu riêng của chủ dự án. Chỉ phát hành khi khóa và kênh cập nhật đã cấu hình đúng. Luồng này khác bản setup.exe thường; không đoán mật khẩu ký.

Không thay identifier com.teacherworkspace.desktop. Kiểm thử cài đè, mở dữ liệu cũ và sao lưu trên Windows trước khi coi bộ cài là đã xác minh. Phiên bản 1.10.7 chưa được build hay chạy trên Windows trong lần bàn giao này.

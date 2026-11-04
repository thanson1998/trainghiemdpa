# Đăng nhập Chủ quán DPA bằng Google / Gmail

Chỉ có một tài khoản và một vai trò **Chủ quán**, có toàn quyền như trước. Không có phân vai nhân viên hay đăng ký công khai. Gmail dùng cho tài khoản GitHub vẫn đăng nhập Google được, nhưng GitHub và Google có cấu hình đăng nhập riêng.

## Cấu hình Google trước khi kích hoạt

1. Mở Google Cloud Console bằng Gmail của chủ quán. Tạo hoặc chọn project. Trong Google Auth Platform cấu hình Branding, Audience, thông tin liên hệ theo yêu cầu. Nếu ứng dụng còn ở Testing, thêm chính Gmail này vào Test users.
2. Trong Clients tạo OAuth client loại **Web application**, thêm Authorized JavaScript origins:
   - `https://thanson1998.github.io`
   - `https://trainghiemdpa.thanson198.workers.dev`
   Các giá trị là origin, không thêm `/trainghiemdpa/`. Đăng nhập dùng Google Identity Services qua popup/callback JavaScript, không cần redirect URI của máy chủ.
3. Sao chép **Client ID** dạng `....apps.googleusercontent.com`. Cơ chế này không cần Client Secret, mật khẩu Gmail, mã OTP, quyền đọc thư Gmail hay GitHub token.
4. Trong Cloudflare Dashboard → Worker `trainghiemdpa` → Settings → Variables and Secrets, thêm:
   - `DPA_GOOGLE_CLIENT_ID`: Client ID từ bước 3; biến văn bản được, giá trị này công khai theo thiết kế OAuth.
   - `DPA_OWNER_EMAIL`: đúng địa chỉ **Gmail** của chủ quán, nên lưu kiểu Secret để tránh hiển thị trong cấu hình công khai. Chỉ một địa chỉ `@gmail.com`, không có danh sách đăng ký tự do.
5. Triển khai migration `0031_owner_auth.sql`, `0032_owner_google.sql`, mã Worker và frontend. Lệnh deploy hiện có áp dụng migration trước khi cập nhật Worker và giữ runtime secrets.
6. Mở website → **Đăng nhập bằng Google** → chọn đúng Gmail đã cấu hình. Máy chủ tạo/liên kết tài khoản duy nhất sau khi kiểm tra chữ ký Google và email cho phép. Các đơn, thanh toán, thư viện và sao lưu hiện có được giữ nguyên.

Không kích hoạt trên web đang bán hàng trước khi có Client ID và Gmail cho phép: API nghiệp vụ sẽ bị khóa ngay khi triển khai. Nếu đã cấu hình sai origin hoặc vẫn ở chế độ Testing chưa thêm Test user, cần sửa trong Google Cloud trước khi đăng nhập được.

Hướng dẫn chính thức: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid và https://developers.google.com/identity/gsi/web/guides/verify-google-id-token.

## Mật khẩu dự phòng (tùy chọn)

Đăng nhập Google hoạt động độc lập, không bắt buộc tạo mật khẩu riêng trên DPA. Nếu muốn mật khẩu dự phòng:

- Thêm secret `DPA_OWNER_SETUP_KEY` trên Cloudflare bằng một chuỗi ngẫu nhiên ít nhất 32 ký tự; giữ riêng trong trình quản lý mật khẩu, không đưa vào GitHub, `config.js` hoặc hội thoại.
- Khi đã có tài khoản Google, mở **Đăng nhập bằng mật khẩu** → **Quên mật khẩu?**, dùng mã trên và đặt tên/mật khẩu riêng. Nếu chưa có tài khoản và chưa cấu hình Google, màn hình Thiết lập Chủ quán hỗ trợ tạo bằng mã này.
- Tên đăng nhập: 3–64 chữ không dấu, số, `.`, `_`, `-`. Mật khẩu: 12–128 ký tự; nên dùng một cụm từ dài và khó đoán.
- Đổi/khôi phục mật khẩu làm mọi phiên cũ mất hiệu lực. Không thay đổi chủ thể Google đã liên kết.
- Mất mã dự phòng: chủ Cloudflare thay secret trong Dashboard. Mất quyền Gmail: khôi phục tài khoản Google theo quy trình của Google; không có chức năng tự chuyển quyền chủ sang Gmail khác. Việc thay email cho phép không ghi đè chủ thể Google đã liên kết; phải kiểm tra và chuyển liên kết có chủ đích ở máy chủ.

## Phiên và dữ liệu

Phiên có thời hạn cố định 12 giờ. Mỗi tab giữ mã phiên trong `sessionStorage` và bộ nhớ, không lưu mật khẩu hay Google ID token. Máy chủ chỉ lưu SHA-256 của mã phiên. Tải lại cùng tab tiếp tục phiên còn hạn; dùng Đăng xuất khi rời máy chung, kể cả trình duyệt có khôi phục tab. Đăng xuất thu hồi phiên của tab hiện tại, đổi/khôi phục mật khẩu thu hồi mọi thiết bị. Mất mạng khi đăng xuất: khóa giao diện và xóa mã trên máy, báo rõ chưa xác nhận thu hồi ở máy chủ.

Google ID token được xác minh RS256 bằng public keys từ endpoint cố định của Google, kiểm tra issuer, audience, thời hạn, thời điểm phát hành, email đã xác minh và đúng Gmail cho phép, định danh `sub`, nonce dùng một lần. Không chỉ đọc email do trình duyệt gửi. Nonce/challenge hết hạn sau 5 phút và bị dùng một lần; giới hạn yêu cầu được lưu trong D1. Định danh Google được liên kết ổn định vào tài khoản duy nhất.

Mật khẩu dự phòng được băm PBKDF2-SHA256 với salt ngẫu nhiên, 100.000 vòng theo giới hạn WebCrypto của Workers. Giới hạn thử sai theo địa chỉ do Cloudflare cung cấp và tổng yêu cầu. DB/migration lỗi sẽ chặn truy cập thay vì bỏ qua đăng nhập.

GitHub Pages và Worker khác miền nên phiên dùng Bearer qua HTTPS thay cho cookie bên thứ ba. CORS cho phép Authorization ở origin Pages đã cấu hình; mã phiên không được chấp nhận trong URL hoặc cookie. JavaScript trên cùng trang có thể đọc sessionStorage, vì vậy không chèn script không tin cậy.

Toàn bộ API nghiệp vụ yêu cầu Chủ quán: đơn/khách, lịch sử, sao lưu/tải/khôi phục, thu tiền/hoàn tác, ngân hàng, bàn, AI, thiết lập thông báo. Trạng thái đăng nhập công khai chỉ có cờ cấu hình và Client ID công khai. Ảnh minh họa món GET theo mã vẫn công khai, không chứa dữ liệu khách.

Mã nguồn, tài nguyên frontend và thông tin thanh toán tĩnh đã công khai trước đây vẫn có thể tải từ GitHub. Đăng nhập bảo vệ dữ liệu máy chủ, không biến kho công khai thành kho riêng hay xóa lịch sử GitHub. Nháp trên cùng trình duyệt được giữ sau đăng xuất và truy cập qua ứng dụng sau đăng nhập; tính năng này không mã hóa ổ đĩa hay các bản sao đã tải xuống.

Cron chốt ca/sao lưu 12:00, giữ bản sao 60 ngày và thông báo theo cấu hình cũ chạy nội bộ, độc lập phiên. Bản sao nghiệp vụ không chứa tài khoản đăng nhập, password hash, phiên, challenge hay secrets; mất toàn bộ DB cần thiết lập lại tài khoản qua Google đã cho phép hoặc mã riêng.

## Kiểm tra

Các kiểm thử auth và Google dùng SQLite trong bộ nhớ cùng khóa RSA giả lập Google để kiểm tra chữ ký thật, tài khoản được phép/bị từ chối, giả mạo/expired token, nonce/replay, thu hồi phiên, giới hạn thử sai, CORS và DB lỗi. Không tạo tài khoản/đơn/thanh toán trên hệ thống thật. Đăng nhập Google thực tế cần Client ID, Gmail cho phép và thử trực tiếp trên trình duyệt của chủ quán.

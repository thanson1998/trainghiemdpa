# DPA · Quản trị đặt bàn

Quản lý 43 bàn theo sơ đồ DPA, tông xanh trầm – kem – vàng. Bàn hiển thị tên khách và số mâm; rê chuột hoặc chạm để xem, thêm và sửa tên, số người, giá/bàn, món ăn. Có ngày, ca trưa/tối, đặt nhiều bàn, kiểm tra trùng giờ, xuất CSV và đồng bộ mỗi 10 giây.

## Bật đồng bộ trực tuyến

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thanson1998/trainghiemdpa)

1. Nhấn **Deploy to Cloudflare**, đăng nhập tài khoản Cloudflare của bạn và cho phép kết nối GitHub. Đây là bước triển khai máy chủ, người dùng website không phải đăng nhập.
2. Giữ lệnh build `npm run build` và lệnh deploy `npm run deploy`. Cloudflare tạo cơ sở dữ liệu D1 và chạy migration theo cấu hình. Hoàn tất sẽ có đường dẫn `https://dpa-dat-ban.…workers.dev`.
3. Mở đường dẫn Worker trên điện thoại và máy tính. Cả giao diện và dữ liệu đều hoạt động ở đường dẫn này.

### Chạy giao diện trên GitHub Pages

Trong [Settings → Pages](https://github.com/thanson1998/trainghiemdpa/settings/pages), chọn **Source: Deploy from a branch**, **Branch: main**, thư mục **/(root)**, rồi nhấn Save. Tệp `index.html` đã là bản build hoàn chỉnh; không cần cấu hình GitHub Actions.

Mở `https://thanson1998.github.io/trainghiemdpa/`, mở **Kết nối dữ liệu**, nhập đường dẫn Worker ở bước trên và lưu. Sao chép link dùng trên thiết bị khác để dùng đúng cơ sở dữ liệu. Hoặc điền URL Worker vào `config.js` để mọi thiết bị tự dùng cấu hình chung sau lần build kế tiếp.

GitHub Pages không giữ lịch đặt bàn. Lịch chỉ được lưu trên D1. Không có chế độ lưu đặt bàn riêng trong trình duyệt; khi mất mạng, hệ thống báo lỗi và giữ nội dung form để thử lại. Cấu hình địa chỉ máy chủ được lưu ở trình duyệt.

## Không đăng nhập

Theo yêu cầu của chủ DPA, lịch này dùng chung và không có xác thực. Ai có đường dẫn có thể đọc, thêm, sửa và xóa đặt bàn. Không nhập bí mật, mật khẩu hoặc thông tin thẻ vào ghi chú. CORS chỉ giới hạn trình duyệt, không phải cơ chế bảo vệ dữ liệu.

## Phát triển và kiểm tra

```sh
npm install
npm test
npm run build
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

Đối với triển khai CLI thủ công, trước tiên tạo D1 bằng `npx wrangler d1 create dpa-bookings`, thay `database_id` trong `wrangler.json` bằng ID trả về, rồi chạy `npm run deploy`. Nút Deploy to Cloudflare tự cấu hình tài nguyên này. Nếu đổi tài khoản GitHub, đặt `ALLOWED_ORIGIN` trong Worker bằng origin GitHub Pages tương ứng.

Không đưa `.dev.vars`, `.env`, token, dữ liệu khách hoặc tệp xuất đặt bàn lên kho mã nguồn. Mã nguồn này độc lập với Sites/đăng nhập ChatGPT; không thay đổi dữ liệu của trang DPA cũ.

## Cấu trúc mã nguồn

Các tệp được đặt ở thư mục gốc để có thể tải lên GitHub một lần. `source.html` là trang đầu vào phát triển; `index.html` là bản build chạy ngay trên GitHub Pages. Chạy `npm run build` để tạo lại `index.html` và thư mục `dist` cho Cloudflare. `worker.ts` và `api.ts` xử lý API; `0001_reservations.sql` khởi tạo D1.

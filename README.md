# DPA · Quản trị đặt bàn

Quản lý 50 bàn theo sơ đồ DPA, tông xanh trầm – kem – vàng. Bàn hiển thị tên khách và số mâm; rê chuột hoặc chạm để xem, thêm và sửa tên, số người, giá/bàn, món ăn. Có ngày, ca trưa/tối, đặt nhiều bàn, kiểm tra trùng giờ, xuất CSV và đồng bộ mỗi 10 giây.

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

Khu **Trước quầy** có ba bàn **20 – 19 – 18**, nằm ở cột bên trái, ngay trên quầy thanh toán. Tổng cộng 48 bàn trong 8 khu vực.

## In menu

Mở chi tiết đặt bàn và nhấn **In menu**, hoặc nhấn **In menu** ở dòng khách trong Danh sách đặt bàn. Bản xem trước 80 mm hiển thị tên khách, ngày giờ, vị trí từng bàn, số người và số mâm mỗi bàn/tổng, danh sách món, giá mỗi bàn và tổng tiền. Nhấn **In / Lưu PDF** để mở hộp thoại in của thiết bị. Bản in lấy thông tin đang hiển thị khi mở xem trước; in menu không tự lưu thay đổi đặt bàn.

## Giá từng món

Thực đơn cho phép thêm/xóa dòng, nhập tên và giá cho từng món (giá mỗi bàn). Giá có thể để trống. Tổng giá đã nhập hiển thị bên dưới; nhấn **Dùng tổng món làm giá bàn** khi đã nhập đủ giá để cập nhật giá bàn. Giá bàn vẫn có thể nhập riêng theo giá thỏa thuận. Bản in, tooltip và CSV đều hiển thị giá từng món. Thực đơn cũ dạng văn bản vẫn được đọc và giữ nguyên; giá chưa có được để trống. Dữ liệu được lưu trong cột menu hiện có, không cần thay đổi bảng hoặc xóa dữ liệu.

Bản in dùng giấy cuộn 80 mm, chiều dài theo nội dung. Trong trình điều khiển máy in chọn giấy 80 mm, tỷ lệ 100%, tắt đầu/chân trang của trình duyệt.

Khu Bàn Đá gồm 11 bàn, đánh số từ 7 đến 17. Tổng toàn bộ sơ đồ: 48 bàn trong 8 khu vực.

## Thư viện, số lượng món, tiền cọc và danh sách tháng
- Thư viện dùng chung ở mục Thư viện thực đơn, khởi tạo trống. Người quản lý tự nhập món (tên, đơn vị, đơn giá) và thực đơn mẫu.
- Chọn mẫu để sao chép vào đặt bàn; mọi chỉnh sửa giá, số lượng, tên và đơn vị trong đặt bàn chỉ áp dụng cho đặt bàn đó.
- Số lượng món tính theo mỗi bàn, hỗ trợ hai chữ số thập phân; thành tiền làm tròn đến đồng. Giá bàn thỏa thuận vẫn độc lập, hoặc bấm dùng tổng món để áp dụng.
- Tiền cọc nhập một lần cho toàn bộ đặt bàn; số còn lại = giá mỗi bàn × số bàn − cọc. In cùng ghi chú, đơn vị và tổng số lượng món.
- Danh sách mặc định xem cả tháng, có cột ngày và thứ tự ngày/giờ; chọn ngày để xem riêng, bấm Xem cả tháng để bỏ lọc ngày.
- Migration 0002 bổ sung tiền cọc mặc định 0 cho dữ liệu cũ và bảng thư viện có kiểm tra phiên bản chống ghi đè.

Cỡ chữ giao diện được tăng để dễ đọc; tên khách, ngày đặt và số bàn trong danh sách dùng 15 px.
## Kết nối Gemini cho nhập đặt bàn bằng AI

Trong Cloudflare, chọn Worker `trainghiemdpa` → Settings → Variables and Secrets → Add. Chọn loại **Secret**, đặt tên **GEMINI_API_KEY**, nhập key Google AI Studio và Deploy. Không ghi key vào GitHub, `wrangler.json`, `config.js` hoặc mã giao diện.

Khi Secret đã có, máy chủ tự dùng Gemini 3.1 Flash-Lite. Có thể đổi mô hình bằng biến `GEMINI_MODEL`. Khi chưa có Secret, ứng dụng tiếp tục dùng Cloudflare AI. Phiếu nhập ghi rõ dịch vụ đã đọc văn bản. Nếu Gemini từ chối key hoặc hết hạn mức, ứng dụng báo lỗi cụ thể; không tự gửi lời nhắn sang dịch vụ khác.


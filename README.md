# DPA · Quản trị đặt bàn

## Nhóm món và thanh toán từ sơ đồ

Mỗi món mẫu có nhóm riêng trong phần Sửa: chọn nhóm có sẵn hoặc nhập nhóm mới. Thư viện và POS lọc theo cùng nhóm; tìm món cũng nhận tên nhóm. Migration 0008 tự phân loại món cũ từ tên tiếng Việt, giữ nguyên giá, đơn vị, thực đơn mẫu và nhóm đã sửa thủ công. Món mới học từ văn bản tự nhận nhóm; nhóm thủ công được giữ khi thiết bị cũ chỉ cập nhật giá.

Nút Thanh toán nhỏ màu đỏ dưới bàn có đơn mở hộp kiểm tra tiền cọc và số còn thu, không tự xác nhận thu tiền. Nếu một bàn có nhiều đơn, chọn đúng đơn trước; nếu POS đang giữ thay đổi chưa lưu trên trình duyệt này, mở POS để kiểm tra. Đơn đã thanh toán không còn hiện nút này. Thanh toán dùng chung lịch sử, kiểm tra phiên bản và phiếu 80mm.

Quản lý 50 bàn theo sơ đồ DPA, tông xanh trầm – kem – vàng. Bàn hiển thị tên khách và số mâm; rê chuột hoặc chạm để xem, thêm và sửa tên, số người, giá/bàn, món ăn. Có ngày, ca trưa/tối, đặt nhiều bàn, kiểm tra trùng giờ, xuất CSV và đồng bộ mỗi 10 giây.

## Bật đồng bộ trực tuyến

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thanson1998/trainghiemdpa)

1. Nhấn **Deploy to Cloudflare**, đăng nhập tài khoản Cloudflare của bạn và cho phép kết nối GitHub. Đây là bước triển khai máy chủ, người dùng website không phải đăng nhập.
2. Giữ lệnh build `npm run build` và lệnh deploy `npm run deploy`. Cloudflare tạo cơ sở dữ liệu D1 và chạy migration theo cấu hình. Hoàn tất sẽ có đường dẫn `https://dpa-dat-ban.…workers.dev`.
3. Mở đường dẫn Worker trên điện thoại và máy tính. Cả giao diện và dữ liệu đều hoạt động ở đường dẫn này.

### Chạy giao diện trên GitHub Pages

Trong [Settings → Pages](https://github.com/thanson1998/trainghiemdpa/settings/pages), chọn **Source: Deploy from a branch**, **Branch: main**, thư mục **/(root)**, rồi nhấn Save. Đưa lên đủ `index.html`, thư mục `assets`, `config.js` và `favicon.svg` từ cùng một lần build. JavaScript, CSS và ảnh dùng tên có mã băm để trình duyệt lưu đệm riêng, tránh tải lại toàn bộ mỗi lần mở trang.

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

Các tệp được đặt ở thư mục gốc để có thể tải lên GitHub một lần. `source.html` là trang đầu vào phát triển. Chạy `npm run build` để tạo lại `index.html` và `assets` cho GitHub Pages, cùng thư mục `dist` cho Cloudflare. Luôn triển khai HTML và tài nguyên của cùng bản build. `worker.ts` và `api.ts` xử lý API; `0001_reservations.sql` khởi tạo D1.

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

## Luồng quản lý đặt bàn mới

- Trang mở đầu hiển thị tổng quan hôm nay. Trên điện thoại có thẻ đơn hàng và sơ đồ theo từng khu, không cần vuốt ngang toàn bộ mặt bằng.
- Form gồm Khách & thời gian, Bàn & tổng số khách, Thực đơn & tiền. Giá tự chia và giá đã chốt là hai chế độ riêng. Đơn cũ mặc định giữ giá đã chốt.
- Nhập AI có phần xem cấu hình và kiểm tra kết nối. Chỉ kiểm tra khi bấm nút; website không đặt giới hạn số lượt/ngày.
- Sau khi lưu đơn, in và chuyển phiếu cho bếp, bấm **Đã gửi bếp — ghi nhận**. Lần sau có thể chọn **In món bổ sung / thay đổi** để in phần thêm, giảm/hủy và đổi bàn so với lần xác nhận trước. In thử hoặc hủy hộp thoại in không tự xác nhận gửi bếp.
- Mỗi lần tạo, sửa, chuyển hoặc xóa đơn đều có lịch sử. Mục **Lịch sử & sao lưu** cho phép khôi phục một phiên bản sau khi kiểm tra trùng bàn và phiên bản mới nhất. Đơn đã xóa được cấp mã đơn mới khi khôi phục; các phiên bản cũ vẫn được giữ.
- **Tải bản sao lưu** xuất JSON gồm đơn hàng, thư viện món, lịch sử và các lần gửi bếp. Tệp có thông tin khách, nên lưu ở nơi quản lý DPA sử dụng.


## Thanh toán

Tab Thanh toán mặc định ngày hôm nay, có lọc ngày/tháng và tìm theo khách, mã đơn hoặc bàn. Số cần thu = giá đã chốt mỗi bàn × số bàn − cọc. Nhập tiền khách đưa (tiền mặt có tính trả lại) hoặc số đã nhận chuyển khoản, kiểm tra rồi xác nhận đã nhận đủ. Thao tác này chỉ ghi nhận nội bộ, không kết nối ngân hàng.

Thanh toán lưu một lần cùng ảnh chụp dữ liệu đơn, thời điểm và phương thức; đơn chuyển sang Hoàn tất. Đơn đã thanh toán khóa sửa/xóa/chuyển bàn/khôi phục để giữ số liệu đối soát. Đơn Hoàn tất từ trước vẫn thuộc Chưa thanh toán nếu chưa có bản ghi thu tiền. In lại phiếu 80mm trong danh sách Đã thanh toán. Thống kê theo ngày đặt bàn, tách tiền cọc và phần thu thêm; bản sao lưu JSON bao gồm thanh toán. Migration 0007 chỉ tạo bảng/trigger mới, không đánh dấu đơn cũ đã thu tiền.

## POS Bán hàng

Tab POS dùng chung thư viện, mã đơn, lịch sử, gửi bếp và thanh toán với hệ thống hiện có. Máy tính có phiếu bên trái và lưới món/bàn bên phải; điện thoại chuyển giữa chọn món/bàn và phiếu. Tìm không dấu (F2), chọn món nhiều lần để cộng số lượng, sửa đơn giá riêng, áp dụng thực đơn mẫu/set và số set, ghi chú bếp, cọc, giữ giá đã chốt và chuyển bàn. Ctrl+S lưu đơn.

Có thể mở nhiều phiếu, nháp tự giữ trên trình duyệt này. Nút Mở phiếu đưa ngay nội dung đơn ra khung mở rộng, giữ nguyên nháp đang sửa và không tạo bản sao của đơn. Nháp chưa được đồng bộ cho tới khi bấm Lưu đơn; đóng nháp có thay đổi cần xác nhận. Đơn đang mở tải từ máy chủ theo ngày của phiếu, kiểm tra phiên bản khi cập nhật. Lỗi mạng giữ nháp và ID để tránh tạo đơn trùng; có thể tải bản máy chủ sau khi kiểm tra.

Gửi bếp và Thanh toán lưu đơn trước khi mở thao tác; bấm Đã gửi bếp trên phiếu in để ghi nhận. Thanh toán xác nhận thủ công đã nhận tiền, dùng cùng API chống thu trùng, có tiền trả lại và phiếu 80mm. Bàn đã thanh toán không chặn lượt khách tiếp theo dù còn trong khung giờ đặt cũ. Không có thao tác thanh toán thử nào được chạy trên dữ liệu thật trong lúc phát triển.

Nút thanh toán tại sơ đồ và POS mở đầy đủ bill trước khi thu tiền: tên khách, bàn, món, số lượng/đơn vị, đơn giá, tổng, cọc và số còn thu. Có in bill tạm tính 80mm, thao tác in không ghi nhận thanh toán. Chỉ xác nhận sau khi đã nhận đủ tiền. Form đặt bàn xếp thông tin khách, ngày/giờ và giá theo các cột phù hợp màn hình, giảm khoảng trống để xem được nhiều món hơn.


## Cố định POS, xóa set và chọn bàn theo sơ đồ

Trên máy tính, hai cột POS nằm trong chiều cao màn hình; cuộn danh sách món hoặc nội dung phiếu riêng, các nút Lưu đơn / Gửi bếp / Thanh toán vẫn trong cột phiếu. Điện thoại giữ nút chuyển giữa chọn món/bàn và phiếu.

Xóa set bỏ giá set cùng các món thuộc set, giữ món gọi thêm. Làm mới menu xóa toàn bộ thực đơn trên phiếu đang sửa. Cả hai có Hoàn tác ngay sau thao tác; chỉ đồng bộ khi lưu đơn. Giá đã chốt vẫn theo chế độ giá thỏa thuận hiện có.

Tab Bàn của POS và form đặt bàn dùng sơ đồ thu nhỏ theo vị trí khu, có quầy, lối đi, màu bàn đã chọn và bàn trùng giờ. Có thể chọn nhiều bàn; bàn có đơn khác trùng thời gian bị khóa. Form kiểm tra lịch theo đúng ngày đang sửa, kể cả khi đổi ngày.

Đã kiểm tra TypeScript, build, 64 bài kiểm tra hiện có và thao tác trên trình duyệt với dữ liệu mẫu (chọn bàn, khóa trùng giờ, áp dụng set, thêm món, xóa set, làm mới, hoàn tác; bố cục máy tính và điện thoại).


## Hoàn tác thanh toán nhầm

Trong Thanh toán → Đã thanh toán, bấm **Hoàn tác thanh toán**, nhập lý do và xác nhận. Đơn quay lại Chưa thanh toán để sửa món / số tiền rồi thanh toán lại. Món, giá, cọc và mã đơn được giữ nguyên. Đây là sửa ghi nhận nội bộ, không tự chuyển tiền trả khách.

Lần thu cũ được lưu đầy đủ trong `payment_reversals`, kèm lý do và thời gian; lịch sử hiển thị Hoàn tác thanh toán, bản sao lưu có `paymentReversals`. Số liệu đã thanh toán chỉ tính các lần thu còn hiệu lực. Migration 0010 bổ sung bảng lưu và trigger thực hiện lưu lịch sử, bỏ ghi nhận thu và mở lại đơn trong cùng giao dịch; lỗi sẽ hoàn tác toàn bộ. Kiểm tra đúng phiên bản và lần thanh toán chống bấm lặp/ghi đè. Nếu bàn đã được cấp cho đơn khác trùng giờ, cần chuyển đơn đang chiếm bàn trước khi mở lại.

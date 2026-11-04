# Cập nhật vận hành ngày 04/11/2026

## Thanh toán

Cấu hình tại POS → Thanh toán → Chuyển khoản → Sửa tài khoản được dùng chung cho QR và bill in. Khi chưa có cấu hình riêng trên máy chủ, hệ thống dùng thông tin nhận tiền hiện có. Mã thanh toán có chữ và số được chấp nhận; QR do ngân hàng cấp cho mã hiện tại được giữ nguyên. Sau khi thay đổi cấu hình, kiểm tra người nhận trong ứng dụng ngân hàng trước khi thu tiền.

## Nháp và ô nhập

Form đặt bàn tự giữ nhiều nháp trên tab đang dùng. Khi đóng một form có thay đổi, chọn Tiếp tục nhập hoặc Giữ nháp & đóng. Nháp xuất hiện ở màn hình chính để tiếp tục; khi lưu đơn thành công, chỉ nháp tương ứng được bỏ.

Nháp POS tách riêng theo tab và vẫn còn khi tải lại trang. Khôi phục nháp hiển thị các phiên bản còn lưu trên cùng trình duyệt, thời điểm chỉnh sửa thực tế, Số Bàn, số món và tổng tiền. Việc duy trì kết nối không làm thay đổi thời điểm sửa phiếu. Khi có nhiều nội dung khác nhau của cùng đơn, chọn và xác nhận bản cần dùng; phiếu đang mở được giữ làm bản dự phòng trước khi thay thế. Nháp cũ chưa có thời điểm sửa được ghi rõ để đối chiếu. Có tối đa 10 bản khôi phục từ các phiên POS cũ, ngoài những phiên đang hoạt động. Nháp chưa lưu chưa phải dữ liệu dùng chung trên máy chủ; cần Lưu đơn để thiết bị khác đọc được. Nếu trình duyệt không lưu được, hệ thống hiện cảnh báo.

Ngày, giờ, số khách, Số Bàn, giá và cọc được kiểm tra trước khi gửi. Số khách phải là số nguyên 1–50.000; Số Bàn là các số 1–9999, ngăn cách bằng dấu phẩy, không lặp; cọc không được vượt tổng đơn. Đặt bàn vẫn sử dụng khung giờ trong cùng ngày.

## Đồng bộ và giao diện

Các form dùng chung quy tắc kích thước và hiển thị lỗi. POS đang hoạt động đọc lại dữ liệu khoảng 5 giây/lần; khi không thao tác, chu kỳ giãn ra. Thư viện kiểm tra khoảng 15 giây/lần. Khi tab bị ẩn, ngừng đọc định kỳ; mở lại tab hoặc thao tác lưu sẽ kích hoạt kiểm tra sớm. Máy chủ vẫn kiểm tra phiên bản khi lưu để ngăn ghi đè từ thiết bị khác.

## Sao lưu cuối ca

Lưu chốt ca sẽ tạo một bản sao lưu trên máy chủ. Nếu sao lưu thất bại, bản chốt ca vẫn được giữ và có thông báo để tạo lại tại Lịch sử → Sao lưu & khôi phục. Lịch định kỳ hiện có tự chốt ca và tạo sao lưu lúc 12:00 trưa giờ Việt Nam, tổng hợp từ 12:00 hôm trước đến 12:00 hôm nay. Ca tự động và ca thủ công có danh sách riêng. Tiền kiểm đếm trong bản tự động để chưa xác nhận. Nếu sao lưu lỗi, hàng đợi độc lập tiếp tục thử lại sau 1, 5, 15 rồi 60 phút, kể cả khi đã qua ngày mới hoặc chưa đến 12:00. Mỗi lần chạy tự động xử lý tối đa một bản đang chờ. Báo cáo ca đã lưu không bị tính lại.

Giữ bản sao lưu trong 60 ngày kể từ thời điểm tạo thực tế. Các bản quá hạn được tự xóa để giải phóng dung lượng có thể sử dụng; đơn hàng, thanh toán, báo cáo ca và lịch sử gốc được giữ. Trạng thái hết hạn được ghi nhận để bản đã dọn không bị tự tạo lại. Danh sách có nút Xem thêm, không còn giới hạn lưu 30 bản. Màn hình Sao lưu hiển thị bản đang chờ, đang tạo hoặc thất bại cùng lịch thử lại; mỗi bản thành công có ngày hết hạn. Bản tạo muộn hiển thị đúng thời điểm tạo thực tế. Mỗi bản được nén và kiểm tra SHA-256 trước khi tải hoặc khôi phục. Nội dung gồm các đơn đã lưu, thư viện, lịch sử, phiếu bếp, thanh toán/hoàn tác, tài khoản nhận tiền, chốt ca và sơ đồ. Nháp trình duyệt và ảnh món ăn không nằm trong bản sao lưu JSON. Hãy tải thêm bản về máy để có bản độc lập với cơ sở dữ liệu đang chạy.

Chọn Xem để khôi phục → tìm đơn → Kiểm tra khôi phục → Xác nhận. Chỉ khôi phục từng đơn chưa thanh toán, chưa hủy; đơn đã thanh toán, phiên bản vừa thay đổi hoặc bàn trùng giờ sẽ bị chặn. Thao tác này không ghi đè thư viện, sơ đồ, hay lịch sử thu tiền. File tải xuống dùng để lưu trữ và đối chiếu; giao diện không có chức năng nhập toàn bộ file để ghi đè cơ sở dữ liệu.

## Kiểm chứng

Bộ kiểm thử hồi quy bao gồm thanh toán, trùng lịch, chống ghi đè, thông báo, set món và in phiếu. Kiểm thử bổ sung dùng cơ sở dữ liệu SQLite trong bộ nhớ và dữ liệu giả; không tạo đơn hay thanh toán trên hệ thống thật. Thử máy in XP-80C thực tế vẫn cần thực hiện tại quầy.

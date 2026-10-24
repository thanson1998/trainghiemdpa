# POS DPA: thao tác nhanh

- Nhóm **Hay dùng** ưu tiên món ghim ★ dùng chung; gợi ý món thường chọn được lưu trên từng trình duyệt. Ô món hiện ảnh nhỏ, tên, giá, số lượng đã chọn và tình trạng còn/hết món.
- Nút điều chỉnh trên ô món cho đánh dấu **Tạm hết** hoặc **Đã có trở lại**. Thông tin dùng chung giữa các máy. Đơn cũ giữ nguyên; không cho gọi thêm món hết, kể cả từ máy đang mở dữ liệu cũ. Trạng thái hết được giữ đến khi bật lại.
- Thông tin khách và số khách ở phần đầu phiếu. Ngày giờ, số điện thoại, giá chốt, tải bản máy chủ và chuyển bàn nằm trong **Thông tin đơn**. Xóa set / làm mới menu nằm trong **Tùy chọn thực đơn**. Thanh cuối giữ tổng tiền, tiền cọc, tiền cần thu và ba thao tác Lưu đơn / Gửi bếp / Thanh toán.
- Mỗi món có ghi chú riêng (tối đa 300 ký tự) và các gợi ý Không cay / Ít muối / Làm trước / Đóng hộp. Các món cùng tên nhưng ghi chú khác nhau giữ thành các dòng riêng. Phiếu bếp đầy đủ và phiếu bổ sung có ghi chú gắn đúng món.
- **Đánh dấu đã ra** lưu toàn bộ phiếu hợp lệ vào máy chủ. Nếu phiếu thiếu thông tin, phần thay đổi giữ dưới dạng nháp và hiển thị lỗi cần sửa. Khi tăng lượng một món đã ra, lượng cũ vẫn được giữ và món trở về tình trạng chưa ra đủ. Có thể bỏ dấu đã ra khi bấm nhầm.
- Trạng thái bếp dựa trên phiếu đã được xác nhận qua **Đã gửi bếp — ghi nhận**, không dựa trên việc mở hộp in. Món thêm/bớt hoặc đổi ghi chú tạo cảnh báo; đánh dấu đã ra không tạo yêu cầu bếp mới. Thanh toán hiển thị nhắc khi còn thay đổi chưa báo bếp nhưng không ngăn thu tiền.
- Tiền mặt có các nút số tiền gợi ý và Đúng số tiền. Với chuyển khoản, thiết lập ngân hàng / số tài khoản / tên chủ tài khoản một lần, dùng chung giữa các máy; nút Hiện QR dùng số tiền còn phải thu và mã phiếu. QR dùng VietQR; kiểm tra tên người nhận và xác nhận tiền thực nhận. Không có xác minh chuyển khoản tự động. Khi không tải được QR, số tài khoản vẫn hiện.
- **Chốt ca** chọn ngày bắt đầu và giờ 24h; giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu là ngày tiếp theo, tối đa 24h. Thu tiền mặt / chuyển khoản tính theo thời điểm thanh toán, độc lập ngày đặt bàn; chỉ cộng số thu thêm sau cọc. Nhập quỹ đầu ca, chi tiền mặt và tiền thực đếm để tính chênh lệch. Có cập nhật, lưu bản đối soát, xem 10 bản gần nhất và in A4.
- Chốt ca lưu ảnh chụp số liệu, không khóa kỳ hoặc tự ghi thu/chi mới. Cọc trên báo cáo là khoản đã trừ ở các đơn thanh toán, không đại diện cọc thu trong ca. Hoàn tác thanh toán được liệt kê riêng; nếu thực chi hoàn tiền, nhập Chi tiền mặt để đối soát. Đơn chưa thu và phiếu hủy tính theo ngày phục vụ bằng ngày bắt đầu ca tại thời điểm cập nhật. Bản đã lưu giữ nguyên.
- Mất mạng có thông báo rõ; nháp trên máy này khác với đơn đã lưu máy chủ. Thời điểm đồng bộ hiển thị theo giờ Việt Nam. Chức năng này không tự gửi bếp hay ghi nhận thanh toán khi mất mạng.

## Triển khai và kiểm chứng

Migration 0014 thêm tài khoản nhận tiền và lịch sử đối soát riêng; không sửa dữ liệu đơn hay thanh toán cũ. Bản sao lưu đầy đủ có thêm bank và shiftReports. Hai API mới /api/pos/bank và /api/pos/shift giữ nguyên kiểm tra nguồn truy cập và JSON; cập nhật ngân hàng kiểm tra phiên bản, lưu đối soát kiểm tra lại số liệu và chống gửi trùng mã bản ghi.

Đã kiểm thử nghiệp vụ, TypeScript, build và trình duyệt Chrome headless trên dữ liệu giả lập ở máy cục bộ: mở phiếu, đánh dấu món ra, ghi chú / in bếp, xác nhận bếp, tạm hết / có lại, tiền mặt, cấu hình chuyển khoản, chốt ca, báo mất mạng và bố cục máy tính / điện thoại. Không dùng đơn thật trong các phép thử này. Mã QR được kiểm tra định dạng / số tiền / mã đơn; chưa kiểm chứng bằng quét trong ứng dụng ngân hàng thực tế.

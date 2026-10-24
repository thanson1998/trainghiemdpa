# Rà soát giao diện POS — 25/10/2026

Quy ước thao tác được tập trung ở action-colors.css, chỉ áp dụng trên màn hình, giữ nguyên định dạng in.

- Xanh dương: lưu đơn, mở phiếu, in và lưu thông tin. Xanh lá: thanh toán / xác nhận hoàn tất. Cam: món chưa báo bếp, thay thế dữ liệu cần kiểm tra và hoàn tác thanh toán. Đỏ: hủy / xóa / bỏ nháp. Xám: đóng, giữ lại và tiện ích phụ.
- Gửi bếp chỉ nổi màu cam khi còn thay đổi cần gửi; khi đã xác nhận thì trở về kiểu nút phụ. Chữ và biểu tượng vẫn phân biệt thao tác, không dựa riêng vào màu.
- Thay nút biểu tượng ở ô món bằng nhãn Ghim / Đã ghim và Còn / hết. Món tạm hết vẫn đọc rõ tên và trạng thái, đồng thời giữ khả năng mở công cụ để bật lại.
- Xác nhận hủy và bỏ nháp dùng nút đỏ, có viền cảnh báo; thao tác thay set hoặc tải lại ghi đè nháp dùng màu cam. Trạng thái hoàn tác thanh toán cũng dùng cam.
- Tăng vùng bấm trên điện thoại cho ghim, tình trạng món, tăng giảm số lượng, xóa món, đánh dấu đã ra và các nút xác nhận. Giữ bố cục thanh ba nút chính ở màn hình hẹp 320 px; ẩn biểu tượng phụ ở kích thước này để giữ đủ nhãn chữ.
- Tăng độ rõ của viền lấy nét khi dùng bàn phím; đánh dấu nhóm món và tab đang chọn bằng chữ đậm / gạch dưới, cùng aria-pressed.

Kiểm chứng: TypeScript và build đạt; 107 bài kiểm thử nghiệp vụ đạt. Chrome headless dùng dữ liệu giả lập tại máy cục bộ kiểm tra chọn món, mở phiếu, xem thanh toán, mở rồi đóng xác nhận hủy, công cụ tạm hết, bố cục 1366 px, 390 px và 320 px. Không có lỗi JavaScript; không tràn ngang trang hay thanh nút cuối phiếu trên điện thoại hẹp. Vùng bấm ghim / tình trạng / tăng giảm đã đo cao 44 px trên điện thoại. Tỷ lệ tương phản chữ/nền ba nút Lưu đơn / Gửi bếp / Thanh toán lần lượt 6,16 / 5,02 / 7,13. Không thao tác trên đơn thật trong kiểm thử trình duyệt.

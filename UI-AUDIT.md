# Rà soát giao diện POS — 25/10/2026

Quy ước thao tác được tập trung ở action-colors.css, chỉ áp dụng trên màn hình, giữ nguyên định dạng in.

- Xanh dương: lưu đơn, mở phiếu, in và lưu thông tin. Xanh lá: thanh toán / xác nhận hoàn tất. Cam: món chưa báo bếp, thay thế dữ liệu cần kiểm tra và hoàn tác thanh toán. Đỏ: hủy / xóa / bỏ nháp. Xám: đóng, giữ lại và tiện ích phụ.
- Gửi bếp chỉ nổi màu cam khi còn thay đổi cần gửi; khi đã xác nhận thì trở về kiểu nút phụ. Chữ và biểu tượng vẫn phân biệt thao tác, không dựa riêng vào màu.
- Thay nút biểu tượng ở ô món bằng nhãn Ghim / Đã ghim và Còn / hết. Món tạm hết vẫn đọc rõ tên và trạng thái, đồng thời giữ khả năng mở công cụ để bật lại.
- Xác nhận hủy và bỏ nháp dùng nút đỏ, có viền cảnh báo; thao tác thay set hoặc tải lại ghi đè nháp dùng màu cam. Trạng thái hoàn tác thanh toán cũng dùng cam.
- Tăng vùng bấm trên điện thoại cho ghim, tình trạng món, tăng giảm số lượng, xóa món, đánh dấu đã ra và các nút xác nhận. Giữ bố cục thanh ba nút chính ở màn hình hẹp 320 px; ẩn biểu tượng phụ ở kích thước này để giữ đủ nhãn chữ.
- Tăng độ rõ của viền lấy nét khi dùng bàn phím; đánh dấu nhóm món và tab đang chọn bằng chữ đậm / gạch dưới, cùng aria-pressed.

Kiểm chứng: TypeScript và build đạt; 107 bài kiểm thử nghiệp vụ đạt. Chrome headless dùng dữ liệu giả lập tại máy cục bộ kiểm tra chọn món, mở phiếu, xem thanh toán, mở rồi đóng xác nhận hủy, công cụ tạm hết, bố cục 1366 px, 390 px và 320 px. Không có lỗi JavaScript; không tràn ngang trang hay thanh nút cuối phiếu trên điện thoại hẹp. Vùng bấm ghim / tình trạng / tăng giảm đã đo cao 44 px trên điện thoại. Tỷ lệ tương phản chữ/nền ba nút Lưu đơn / Gửi bếp / Thanh toán lần lượt 6,16 / 5,02 / 7,13. Không thao tác trên đơn thật trong kiểm thử trình duyệt.

## Rà soát toàn bộ các trang và tốc độ thao tác

Thay các tiêu đề giới thiệu bằng tên công việc. Bỏ tiêu đề bị lặp ở Thanh toán, Thư viện và Lịch sử; thống nhất thanh điều hướng, chiều rộng vùng làm việc, khoảng cách, thẻ và hệ thống cỡ chữ. Tiêu đề chính 22–26 px, tên khách / món 14–17 px, số tiền chính 21–27 px; thông tin phụ nhỏ hơn theo vai trò.

| Trang | Điều chỉnh |
| --- | --- |
| POS | Mở phiếu vẫn giữ danh sách món; phiếu đã lưu cuộn đến món, tên khách và bàn giữ ở đầu. Nút Chọn thêm món mở danh sách có sẵn; Tạo món mới nằm trong chế độ Quản lý món. Tìm kiếm tự chuyển sang Tất cả, nhóm trống được bỏ khỏi thanh lọc. Ô món thường ngày gọn hơn; nút ghim / còn hết chỉ hiện khi bật quản lý. Nút chuyển Phiếu / Chọn món cố định khi cuộn trên điện thoại. Sửa tràn các cột số lượng / giá bên trong phiếu hẹp. |
| Thanh toán | Thu gọn bộ lọc và thống kê, bố cục điện thoại 2 cột với khoản thu thêm riêng, đưa danh sách đơn lên sớm hơn. Giữ đủ tổng đơn, cọc và tiền cần thu. |
| Tổng quan đơn | Bốn ô thống kê trên máy tính; hai cột trên điện thoại, vẫn giữ các số tiền cần thu. Bộ lọc và cỡ chữ bảng thống nhất; tiêu đề bảng cố định khi cuộn. |
| Sơ đồ bàn | Tiêu đề rõ, bộ lọc và thống kê gọn hơn; giữ vị trí các khu và bàn. Menu điều hướng thu gọn trên máy tính bảng để dành chỗ cho sơ đồ. |
| Danh sách | Bảng dễ đọc và có tiêu đề cố định trên máy tính; dạng thẻ trên điện thoại / máy tính bảng. |
| Thư viện | Một tiêu đề, nhóm có món hiển thị thành hàng cuộn ngang; ô tìm kiếm giữ khi cuộn. Tăng cỡ tên / giá và kích thước Sửa / Xóa. Danh sách nhóm khi sửa món vẫn giữ đủ lựa chọn, kể cả nhóm đang trống. |
| Lịch sử | Thẻ bản ghi dễ phân biệt, tên / ngày / giờ / giá có thứ bậc rõ, nút khôi phục và sao lưu đủ lớn. |

Kiểm tra toàn bộ 7 trang ở 1366, 820, 390 và 320 px bằng Chrome headless với dữ liệu giả lập. Kiểm tra riêng các hộp sửa món, thêm đặt bàn, khôi phục và thanh toán ở 320 px; các hộp dài cuộn bên trong. Kiểm tra luồng tìm món khác nhóm, mở phiếu, chuyển chọn món / phiếu khi cuộn và mở công cụ tạo món riêng. Không sửa đơn thật; không thay đổi phép tính tiền, dữ liệu thanh toán hoặc bố cục in.

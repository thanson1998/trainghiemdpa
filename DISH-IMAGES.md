# Ảnh minh họa món ăn DPA

Cron Cloudflare chạy mỗi phút, tự nhận diện món mới hoặc đổi tên và xử lý tối đa 3 ảnh mỗi lượt. Cron hoạt động khi đóng website. Ảnh hoàn tất được lưu dùng chung; tải trang và xem ảnh không gọi AI. Hóa đơn, bill và phiếu bếp không in ảnh.

Hàng đợi tự thử lại liên tục, không dừng vĩnh viễn sau 3 lỗi. Lỗi tạm thời được giãn cách từ 1 phút tới tối đa 6 giờ. Ảnh trả về không hợp lệ chỉ hoãn món đó. Lỗi dịch vụ hoặc tài khoản tạm hoãn toàn hàng đợi. Hết hạn mức AI ngày thì chờ đến 00:01 UTC (07:01 Việt Nam) rồi thử lại. Không tự nâng gói hoặc đổi hạn mức sử dụng.

Giới hạn sẵn có vẫn là 300 lần gọi/ngày theo giờ Việt Nam, tối đa 3 ảnh mỗi lượt; DISH_IMAGES_DAILY_LIMIT cho phép cấu hình 0–1000, DISH_IMAGES_ENABLED=false tắt chức năng. Hạn mức nhà cung cấp có thể thấp hơn. Khóa chung chống xử lý trùng; ưu tiên món chưa thử trước món lỗi. Chỉ tạo lại khi đổi tên hoặc người dùng yêu cầu; đổi giá giữ nguyên ảnh.

Migration 0013 đưa các món lỗi trước đây về hàng đợi và chỉ giải phóng thời gian chờ của khóa đang nhàn rỗi. Giữ nguyên ảnh và dữ liệu đơn hàng.

GET /api/dish-images trả về counts, errors theo nhóm lý do cố định, resumeAfter (milliseconds) và retryPolicy continuous-v1. Không công khai lỗi gốc từ nhà cung cấp. Thư viện tự cập nhật tiến độ qua đồng bộ hiện có. Ảnh nhóm tiếp tục hiển thị trong khi đợi ảnh riêng.

Kiểm chứng: các bài kiểm tra bao gồm phục hồi sau hơn 3 lỗi, tạm ngừng toàn hàng đợi khi hết hạn mức rồi tiếp tục, giãn cách có giới hạn, khóa chống trùng, giới hạn ngày, thay tên trong lúc tạo ảnh và dữ liệu D1 BLOB thực tế. Health workflow chỉ đọc trạng thái và ảnh mẫu, không truy cập đơn hàng.

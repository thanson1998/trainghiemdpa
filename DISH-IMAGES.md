# Ảnh minh họa món ăn DPA

POS và Thư viện thực đơn có ảnh nhỏ. Bộ 16 ảnh minh họa nhóm món được tạo riêng, nhúng sẵn trong giao diện để vẫn hiển thị khi dịch vụ tạo ảnh chưa sẵn sàng. Ảnh nhóm chỉ minh họa; ảnh riêng được tạo theo tên món và tự thay thế khi hoàn tất. Hóa đơn, bill tạm tính và phiếu bếp chỉ có chữ, không in ảnh.

Migration `0011_dish_images.sql` lưu ảnh JPEG riêng khỏi thực đơn và đơn hàng trong D1. Cron chạy mỗi phút, tự phát hiện món mới từ cả POS, Thư viện và nhập văn bản; mỗi lượt xử lý tối đa 3 món bằng Workers AI FLUX.1 Schnell qua binding AI hiện có. Món mới được ưu tiên trước hàng chờ cũ; toàn bộ thư viện hiện có cũng được tạo dần. Không cần thêm khóa API tạo ảnh. Ảnh tạo xong được lưu và dùng chung trên các thiết bị. Đổi giá không tạo lại; đổi tên yêu cầu ảnh mới. Mục Sửa món có nút Yêu cầu tạo ảnh / Tạo lại ảnh, giữ ảnh cũ trong khi chờ.

Chỉ cron gọi dịch vụ AI. Mở trang, tải ảnh và làm mới giao diện không tạo thêm ảnh. Khóa dùng chung chống cron chạy trùng; giới hạn mặc định 300 lượt tạo/ngày (theo giờ Việt Nam, bao gồm lượt thất bại), tối đa 3 lần thử tự động/món. Khi dịch vụ lỗi, chờ trước khi thử lại và giữ ảnh nhóm để tiếp tục bán hàng. Có thể đặt `DISH_IMAGES_DAILY_LIMIT` từ 0–1000 hoặc `DISH_IMAGES_ENABLED=false` trong Worker để điều chỉnh/tắt. Tạo ảnh sử dụng hạn mức và có thể phát sinh phí Workers AI của tài khoản Cloudflare; giới hạn số lượt không phải giới hạn chi phí bằng tiền. Ảnh riêng cần thời gian xử lý hàng chờ và tùy hạn mức tài khoản. Không tự tạo ảnh cho dòng tiền cọc, vé, phí phục vụ, khăn ướt.

Triển khai bằng luồng Cloudflare hiện có: build, áp dụng migration rồi deploy. Cron vẫn hoạt động khi không mở website. Các client cũ không ghi đè hoặc xóa ảnh đã tạo; trạng thái ảnh không tăng phiên bản thư viện, không làm xung đột phiếu đang sửa.

Kiểm tra: 84 bài kiểm thử gồm tạo ảnh, chống trùng, giới hạn lượt, thử lại khi lỗi, tạo lại, đổi tên trong lúc tạo ảnh, tương thích client cũ, CORS và xác nhận bản in không có ảnh. TypeScript và build đạt. Phiên làm việc này không có công cụ trình duyệt để kiểm tra trực quan toàn trang.

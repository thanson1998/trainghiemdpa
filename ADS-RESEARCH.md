# Ads Thái Nguyên — bản cơ bản

Tab nghiên cứu độc lập với POS, tải JS/CSS khi mở tab. Dữ liệu dùng chung ở D1 `ads_research`, khóa phiên bản chống ghi đè từ thiết bị khác; lưu JSON xuất riêng và kèm trong sao lưu chung.

- Quán: thêm/sửa/xóa, fanpage, Page ID, nguồn tìm thấy, mô hình, khu vực, điểm cần nghiên cứu và ghi chú.
- Mở Meta Ad Library với quốc gia VN, trạng thái active; có Page ID thì mở đúng Trang, nếu chưa có thì tìm từ khóa và người dùng chọn đúng Trang.
- Ghi nhận số quảng cáo quan sát theo ngày, link kiểm tra và phạm vi. Cùng ngày cập nhật một bản ghi. Không suy diễn số lượng thành ngân sách/hiệu quả, không cộng số quan sát khác ngày thành số hiện tại.
- Mẫu: bắt buộc link Facebook Ad Library có ID, quán, ngày kiểm tra; định dạng, trạng thái tại lần kiểm tra, ngày bắt đầu nếu thấy, ưu đãi, ghi chú, link ảnh https tùy chọn, đánh dấu tham khảo. Không tự tải nội dung từ URL hay tự tạo mẫu quảng cáo của quán.
- Bộ lọc, sắp xếp theo tên/số quan sát gần nhất, xuất JSON. Không có tự động thu thập, xếp hạng chi tiêu hay kết luận toàn thị trường.

## Danh sách gợi ý 25/10/2026

Buffet Time, The Time BBQ, 1990 BBQ & Hotpot, Thai Aroi, Rồng Vàng BBQ, Nhà hàng Đoàn Viên. Nguồn công khai được giữ ở từng quán (fanpage và/hoặc bài giới thiệu). Đây là danh sách cần nghiên cứu, **chưa xác minh đang chạy nhiều ads**. Việc truy cập trực tiếp Ad Library bằng công cụ nghiên cứu bị Facebook chặn; không đưa số giả, mẫu giả hoặc bài đăng thường vào nhóm quảng cáo đã xác minh. Các trường số ads ban đầu trống, mẫu và lịch sử ban đầu rỗng.

## Kiểm tra

TypeScript, build Vite, 109 bài kiểm thử đạt. Kiểm tra Chrome với dữ liệu tổng hợp: 6 quán ban đầu chưa xác minh; lưu lần quan sát, lưu mẫu, đánh dấu tham khảo, tải lại, sửa mẫu giữ nội dung; không tràn ngang ở 1366/820/390/320px hoặc form ở 320px. Kiểm tra CAS, link không an toàn, ngày sai, quán không tồn tại, trùng ID quảng cáo, trùng ngày ghi nhận, và sao lưu. Không tạo bản ghi quảng cáo giả trên máy chủ thật.

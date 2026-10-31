# Ảnh và tốc độ tải

Kiểm tra máy chủ ngày 24/10/2026: 276 món, 269 dòng cần ảnh, 75 ảnh có trạng thái ready, 192 queued và 2 error. Một ảnh được báo ready nhưng HTTP trả 200 với 0 byte; trang HTML cũ khoảng 899 KB. Các số này là trạng thái lúc kiểm tra, không phải số cố định.

Sửa việc đọc BLOB: Cloudflare D1 trả cột ảnh dưới dạng mảng số, cần chuyển thành Uint8Array trước khi tạo Response. Bản sửa kiểm tra dấu JPEG, trả Content-Length và đổi URL/ETag để tránh ảnh rỗng đã được trình duyệt lưu đệm. Cache API lưu ảnh tại biên, kiểm tra nguồn truy cập trước khi trả dữ liệu và chỉ lưu ảnh HTTP 200.

Bộ ảnh nhóm chỉ khai báo một lần trong CSS, không chép chuỗi base64 lớn vào từng ô món. Ảnh riêng vẫn tải lười và giải mã bất đồng bộ. Thumbnail dùng React memo; khi thư viện và danh sách đơn không đổi, poll giữ nguyên đối tượng thay vì cập nhật lại toàn giao diện. Cập nhật tiến độ ảnh ở cùng phiên bản thư viện vẫn được nhận.

HTML, JavaScript, CSS và ảnh tách thành tài nguyên có mã băm. Mã lưu PNG hóa đơn chỉ tải lúc sử dụng. Font tải không chặn hiển thị. HTML sau tối ưu khoảng 0.9 KB; JavaScript ban đầu khoảng 388 KB (112 KB gzip), thay cho khoảng 767 KB trước tối ưu. Đây là dung lượng tài nguyên, không phải cam kết thời gian tải trên mọi mạng.

Cron chỉ xếp thêm tối đa 15 ảnh mỗi lượt và tạo tối đa 3 ảnh; giữ nguyên giới hạn lượt/ngày. Thư viện hiển thị tiến độ ảnh ngay trong giao diện. Tạo ảnh chạy trên máy chủ và không chặn bán hàng.

Workflow DPA web health chỉ đọc số lượng ảnh, dung lượng và thời gian phản hồi của trang/catalog/ảnh mẫu; không truy vấn đơn hàng hoặc ghi nhận thanh toán. Workflow chờ bản cập nhật rồi xác nhận ảnh thật có byte JPEG, kiểm tra tài nguyên tách riêng và thử tải lại ảnh để kiểm tra cache. Thời gian đo từ runner không đại diện trực tiếp cho mạng tại nhà hàng.

## Rà soát 31/10/2026

Mẫu đo mạng từ môi trường kiểm tra: HTML 181 ms, JS chính 302 ms, catalog 339 ms (~95,876 byte JSON chưa nén), sơ đồ 200 ms. Không phải số đo mạng tại nhà hàng.

Bản tối ưu tách Email, Lịch sử, Tổng quan và Thư viện thành các mô-đun tải khi mở; JavaScript đầu vào giảm từ 462,605 xuống khoảng 430,750 byte (gzip 133.13 xuống 126.33 KB). Thư viện dựng 48 thẻ đầu và bổ sung khi cuộn; bộ dữ liệu mẫu 275 món có 4,866 phần tử DOM trước và 1,020 sau. Khi chuyển lại vào thư viện trong kiểm tra cục bộ sau khi mã đã tải, thời gian tới lượt vẽ thứ hai giảm từ 165 xuống 80 ms. Đây là phép đo chẩn đoán, không phải INP hay cam kết tốc độ trên mọi thiết bị.

Catalog hỗ trợ tham số revision tùy chọn, mã SHA-256 bao gồm nội dung món/set và tiến độ ảnh. Poll giữ nguyên mỗi 3 giây, trả JSON nhỏ khi không đổi; cập nhật giá hoặc ảnh ở cùng phiên bản vẫn trả toàn bộ dữ liệu mới. Phiên bản trình duyệt cũ tiếp tục dùng API như trước.

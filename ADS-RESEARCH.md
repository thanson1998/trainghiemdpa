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

## Kết nối SearchApi

Tab “Quảng cáo thật” dùng Meta Ad Library engine, country VN, active_status active. Chỉ API máy chủ gọi nhà cung cấp bằng Authorization header. Khóa có thể lấy từ Cloudflare Secret SEARCHAPI_API_KEY hoặc cấu hình một lần vào bảng riêng ads_connection; tuyệt đối không trả về frontend, sao lưu chung, log, hay đưa vào git.

Kênh cấu hình lần đầu dùng RSA-OAEP SHA-256: máy chủ tạo cặp khóa và chỉ công bố public JWK. Payload gồm khóa SearchApi và capability ngẫu nhiên chỉ được gửi dưới dạng ciphertext. Máy chủ kiểm tra SHA-256 capability, xác minh /api/v1/me trước khi lưu, rồi xóa private/public JWK và đóng cấu hình. Ciphertext không thể dùng để thay khóa đã cấu hình. Nếu cần thay khóa, dùng Secret trong Cloudflare hoặc quy trình quản trị mới; không có form công khai nhận khóa.

Tối đa 3 truy vấn mới mỗi ngày theo giờ Việt Nam, cấp lượt atomically bằng SQLite RETURNING. Mỗi từ khóa có khóa xử lý để tránh thiết bị gọi trùng. Kết quả dùng lại 12 giờ; GET và tải lại trang không gọi SearchApi. Không mua gói hay tự tăng hạn mức. Chỉ lấy trang đầu, tối đa 100 mẫu; ghi rõ còn kết quả khác và tổng nguồn trả về, không coi đó là số toàn thị trường.

Kết quả gồm tên Trang, nội dung, ảnh/video nếu nguồn có, ngày bắt đầu, trạng thái lúc lấy, liên kết quảng cáo gốc. Có thể lưu mẫu cùng quán vào nghiên cứu, nhưng mặc định yêu cầu xác minh địa chỉ tại Thái Nguyên. Lỗi nhà cung cấp được ánh xạ sang thông báo an toàn, giữ kết quả cũ và không lộ khóa hoặc payload thô.

Kiểm thử mới: chuẩn hóa dữ liệu thật và loại trùng ID, cache, ngân sách ngày, giữ dữ liệu khi lỗi, không lộ khóa qua API/sao lưu, bootstrap RSA và từ chối capability sai. Tổng cộng 114 bài đạt; Chrome kiểm tra kết quả và lưu nghiên cứu ở 1366/820/390/320px bằng dữ liệu tổng hợp, không tạo mẫu giả trên môi trường thật.

Bộ lọc Thái Nguyên dùng tên Trang, nhóm ngành nếu nguồn cung cấp và địa danh trong nội dung; loại trang thiết bị/đồ cũ/điện lạnh/thanh lý. Truy vấn mặc định tìm cụm từ chính xác. Tổng kết quả toàn nguồn không được dùng làm tổng thị trường sau khi đã lọc ngành và khu vực.

## Sửa lỗi tab trắng 25/10/2026

Đã tái hiện trong Chrome: chặn chunk ads-panel làm React lazy import thất bại và unmount toàn bộ app. Chưa thể khẳng định thiết bị của người dùng có bật trình chặn; đây là một đường lỗi đã kiểm chứng.

Chuyển tệp frontend/CSS, class giao diện và đường đọc dữ liệu nghiên cứu sang tên market để tránh nhận diện nhầm là khung quảng cáo. Các API cũ giữ tương thích qua alias. Error boundary riêng giữ POS/sidebar hoạt động khi chunk lỗi, có nút phục hồi rõ ràng. Trang thật không phụ thuộc vào việc tải dữ liệu nghiên cứu; trạng thái kết nối và danh sách kết quả cũng tải độc lập. Tự chọn kết quả có mẫu thay vì mặc định vào truy vấn rỗng. Link #thi-truong mở thẳng trang nghiên cứu; truy cập thường vẫn mặc định POS.

Kiểm tra TypeScript, build và 115 bài kiểm thử. QA trình duyệt mô phỏng chặn đường cũ, lỗi metadata, lỗi trạng thái, lỗi chunk, quay về POS và 4 kích thước màn hình. Health check chỉ đọc cache, không tiêu tốn lượt SearchApi.

## Bài quảng cáo đề xuất cho DPA

Mục đề xuất hiển thị trên tab quảng cáo thật, dựa trên tối đa 12 mẫu đang hoạt động có nội dung trong kết quả đang xem, khử trùng ID. Nhận diện các hướng nội dung về dịp gặp gỡ/tiệc, không gian, món ăn, ưu đãi và lời mời đặt bàn (hỗ trợ chữ Unicode kiểu đậm). Bài viết gốc dùng thông tin đã biết của DPA, không lấy giá, miễn phí, quà tặng, địa chỉ hay hotline của quán khác. Đây là gợi ý biên tập theo dấu hiệu nội dung, không đánh giá hiệu quả ads và không gọi thêm SearchApi hoặc mô hình AI.

Có bài viết chỉnh sửa được, sao chép, bản sửa tự lưu trên thiết bị theo bộ nguồn tham khảo, trở về bản gợi ý, giải thích nguồn cùng link ads gốc và ngày thu thập; kèm gợi ý ảnh thật DPA. Không có thao tác tự đăng Facebook. Nếu không có mẫu đang hoạt động có chữ thì không dựng đề xuất giả.

Đã đọc 4 nguồn thật: The King Hotel (không gian/dịch vụ), Rồng Vàng BBQ (món ăn, nhóm đông/sinh nhật/ưu đãi), Đức Huệ (tiệc trọn gói), Sen Việt (buffet hải sản). Hướng chọn cho DPA: bữa tiệc vui và người tổ chức thảnh thơi. Kiểm thử 116 bài đạt; kiểm tra giao diện, sửa/sao chép và giữ bản nháp trên máy tính và điện thoại.

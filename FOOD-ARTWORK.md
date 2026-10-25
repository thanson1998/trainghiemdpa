# Ảnh món ăn bổ sung bằng ChatGPT — 25/10/2026

16 món còn thiếu đã được tạo minh họa mới bằng ChatGPT: cá hấp xì dầu, cơm rang, lợn mán chiên riềng, tóp mỡ dưa chua, cá tầm lẩu, trứng rán, sườn sụn, canh chua, salad rau mầm, cháo gà, trâu nướng lá lốt, gà quay, canh khoai sọ rau muống, nộm dạ dày hoa chuối, bò cuốn cải, móng giò chiên mắm.

Ảnh ghép gốc được mã hóa WebP 296,220 byte trong dish-art-extra-20261025.webp. Mỗi món dùng đúng ô ảnh thông qua tên đã chuẩn hóa NFC, chữ thường và khoảng trắng; không đoán theo từ khóa chung. Vị trí hiển thị điều chỉnh theo bố cục ảnh thực tế để không lẫn món ở hàng kế tiếp. File tải một lần, dùng chung cho các ảnh nhỏ trên POS, thư viện và ảnh set. Ưu tiên ảnh riêng đã có từ máy chủ; ảnh ChatGPT là bổ sung khi món chưa có ảnh riêng hoặc ảnh riêng tải lỗi.

Tiến độ giao diện và API phân biệt ảnh riêng với ảnh bổ sung, đếm duy nhất theo món, không cộng hai lần nếu máy chủ sau này tạo ảnh cho cùng món. Không ảnh hưởng đơn hàng, giá, set, ghi chú, hóa đơn hay phiếu bếp. Không đặt hình món lên bản in. Cron giữ nguyên hàng chờ và chính sách retry/quota.

Kiểm tra TypeScript, build và 117 bài kiểm thử. Kiểm tra Chrome đủ 16 tên/ô ảnh và xem trực quan ảnh từng món; không đưa dữ liệu QA hoặc ảnh thực đơn giả vào máy chủ thật.

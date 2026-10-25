# Ảnh món ăn bổ sung bằng ChatGPT — 25/10/2026

16 món còn thiếu đã được tạo minh họa mới bằng ChatGPT: cá hấp xì dầu, cơm rang, lợn mán chiên riềng, tóp mỡ dưa chua, cá tầm lẩu, trứng rán, sườn sụn, canh chua, salad rau mầm, cháo gà, trâu nướng lá lốt, gà quay, canh khoai sọ rau muống, nộm dạ dày hoa chuối, bò cuốn cải, móng giò chiên mắm.

Ảnh ghép gốc được mã hóa WebP 296,220 byte trong dish-art-extra-20261025.webp. Mỗi món dùng đúng ô ảnh thông qua tên đã chuẩn hóa NFC, chữ thường và khoảng trắng; không đoán theo từ khóa chung. Vị trí hiển thị điều chỉnh theo bố cục ảnh thực tế để không lẫn món ở hàng kế tiếp. File tải một lần, dùng chung cho các ảnh nhỏ trên POS, thư viện và ảnh set. Ưu tiên ảnh riêng đã có từ máy chủ; ảnh ChatGPT là bổ sung khi món chưa có ảnh riêng hoặc ảnh riêng tải lỗi.

Tiến độ giao diện và API phân biệt ảnh riêng với ảnh bổ sung, đếm duy nhất theo món, không cộng hai lần nếu máy chủ sau này tạo ảnh cho cùng món. Không ảnh hưởng đơn hàng, giá, set, ghi chú, hóa đơn hay phiếu bếp. Không đặt hình món lên bản in. Cron giữ nguyên hàng chờ và chính sách retry/quota.

Kiểm tra TypeScript, build và 117 bài kiểm thử. Kiểm tra Chrome đủ 16 tên/ô ảnh và xem trực quan ảnh từng món; không đưa dữ liệu QA hoặc ảnh thực đơn giả vào máy chủ thật.

## Đợt bổ sung 32 món

Cơm, canh cua cà, Mỳ tôm, mỳ gạo, Xúc xích lẩu, Vịt cổ xanh xào, Cá hồi sốt chanh leo, Nấm tuyết, Xúc xích 5000, Cháo cá, Dưa muối, Canh chua cá tầm, Ba chỉ nướng, Nem cá, Cá tầm xào, Cá tầm rang muối, Cá tầm hấp xì dầu, Nộm, Cá lăng chiên, Chim câu xúc bánh đa (2con), Cá chép giòn xào nấm, Ếch rang muối, Củ quả kho quẹt, Cải luộc chấm trứng, Gà đen hấp, Cơm trắng, Canh xương cổ cánh khoai sọ, Canh khoai sọ vịt cổ xanh, Cá suối chiên - to, Diềm tim nhúng, Tráng miệng, Canh khoai sọ, Vịt cổ xanh hấp, Miến chim câu.

Hai ảnh ghép mới do ChatGPT tạo, mã hóa WebP chất lượng 80: 218.496 và 240.152 byte. Ánh xạ tên chính xác vào ô 16–47, giữ nguyên 16 ô trước và ưu tiên ảnh riêng từ máy chủ. Không có hình món trên bản in.

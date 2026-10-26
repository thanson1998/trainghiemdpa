# Ảnh món ăn bổ sung bằng ChatGPT — 25/10/2026

16 món còn thiếu đã được tạo minh họa mới bằng ChatGPT: cá hấp xì dầu, cơm rang, lợn mán chiên riềng, tóp mỡ dưa chua, cá tầm lẩu, trứng rán, sườn sụn, canh chua, salad rau mầm, cháo gà, trâu nướng lá lốt, gà quay, canh khoai sọ rau muống, nộm dạ dày hoa chuối, bò cuốn cải, móng giò chiên mắm.

Ảnh ghép gốc được mã hóa WebP 296,220 byte trong dish-art-extra-20261025.webp. Mỗi món dùng đúng ô ảnh thông qua tên đã chuẩn hóa NFC, chữ thường và khoảng trắng; không đoán theo từ khóa chung. Vị trí hiển thị điều chỉnh theo bố cục ảnh thực tế để không lẫn món ở hàng kế tiếp. File tải một lần, dùng chung cho các ảnh nhỏ trên POS, thư viện và ảnh set. Ưu tiên ảnh riêng đã có từ máy chủ; ảnh ChatGPT là bổ sung khi món chưa có ảnh riêng hoặc ảnh riêng tải lỗi.

Tiến độ giao diện và API phân biệt ảnh riêng với ảnh bổ sung, đếm duy nhất theo món, không cộng hai lần nếu máy chủ sau này tạo ảnh cho cùng món. Không ảnh hưởng đơn hàng, giá, set, ghi chú, hóa đơn hay phiếu bếp. Không đặt hình món lên bản in. Cron giữ nguyên hàng chờ và chính sách retry/quota.

Kiểm tra TypeScript, build và 117 bài kiểm thử. Kiểm tra Chrome đủ 16 tên/ô ảnh và xem trực quan ảnh từng món; không đưa dữ liệu QA hoặc ảnh thực đơn giả vào máy chủ thật.

## Đợt bổ sung 32 món

Cơm, canh cua cà, Mỳ tôm, mỳ gạo, Xúc xích lẩu, Vịt cổ xanh xào, Cá hồi sốt chanh leo, Nấm tuyết, Xúc xích 5000, Cháo cá, Dưa muối, Canh chua cá tầm, Ba chỉ nướng, Nem cá, Cá tầm xào, Cá tầm rang muối, Cá tầm hấp xì dầu, Nộm, Cá lăng chiên, Chim câu xúc bánh đa (2con), Cá chép giòn xào nấm, Ếch rang muối, Củ quả kho quẹt, Cải luộc chấm trứng, Gà đen hấp, Cơm trắng, Canh xương cổ cánh khoai sọ, Canh khoai sọ vịt cổ xanh, Cá suối chiên - to, Diềm tim nhúng, Tráng miệng, Canh khoai sọ, Vịt cổ xanh hấp, Miến chim câu.

Hai ảnh ghép mới do ChatGPT tạo, mã hóa WebP chất lượng 80: 218.496 và 240.152 byte. Ánh xạ tên chính xác vào ô 16–47, giữ nguyên 16 ô trước và ưu tiên ảnh riêng từ máy chủ. Không có hình món trên bản in.

## Đợt 4–5: thêm 32 ảnh ChatGPT

Đà điểu xào lúc lắc, Gà hấp lá chanh, Cơm chiên hải sản, Thịt quay, Rau sống, Đậu rán, Rau lẩu, Cá chép giòn, Sụn sườn, Phù trúc, Tôm lẩu ( thêm ), Vịt xào lăn, Cá chép om dưa, Nem tai, Rau cải luộc, Rau bồ công anh xào, Nộm Hoa Chuối, Lòng tràng thập cẩm, Gỏi cá hồi, Măng, Ốc om chuối đậu, Vịt hấp, Sashimi, Đậu lẩu, Mỳ gạo, Chim câu phồng tôm, Bò lẩu, Ngô, Nấm, Gỏi tôm, Sườn Chua Ngọt, Nộm tai heo, Xôi cẩm.

Ánh xạ chính xác các ô 48–79; giữ ảnh cũ và ưu tiên ảnh riêng từ máy chủ. Hai atlas được nén WebP, dùng chung và lưu bộ nhớ đệm cho POS/thư viện/set. Không hiển thị hình trên bản in.

Dung lượng: batch 4 = 282.224 byte; batch 5 = 243.378 byte. Kiểm tra TypeScript, build, 117 bài kiểm thử và Chrome đủ 32 ô ảnh đúng tên, không lẫn ảnh bên cạnh.

## Đợt 6–7: thêm 32 ảnh ChatGPT

Dạ dày chiên xù, Gà trống thiến hấp, Rau xào, Cá quả nướng, Mực lẩu, Gà chọi hấp, Mướp xào lòng gà, Gà xào sả ớt, Đậu lướt ván, Gà xào nấm, Bò xào rau cải, Trứng cút, Nem bùi, Trứng gà, Ba chỉ, Nước lẩu, Chim câu, Chép giòn xào, Vách xào, Rau cải xào, Bánh đa, Khoai tây lắc phô mai ( lớn ), Gầu bò, Nem ngựa, Mỳ tôm, Cơm rang ( lớn ), Mỳ tôm xào ( lớn ), Khoai tàu kẹp thịt, Sake chiên, Lạp xưởng, Dưa chuột chẻ, Gà chiên mắm.

Ánh xạ chính xác các ô 80–111; nén WebP chất lượng 80. Giữ ảnh cũ, ưu tiên ảnh riêng từ máy chủ và không in hình món trên hóa đơn/phiếu bếp.

Dung lượng: batch 6 = 240.118 byte, batch 7 = 263.922 byte. Điều chỉnh riêng hàng ảnh đợt 6 để tránh lẫn món. Kiểm tra TypeScript, build, 117 bài kiểm thử và Chrome đủ 32 ô ảnh.

## Đợt 8–9 ngày 26/10/2026

32 ảnh ChatGPT mới, ánh xạ chính xác ô 112–143: Cơm + canh cải luộc, Nước ép - Cóc, Gà lẩu, Cam Dứa, Dứa Táo, Nước ép Dứa + Ổi, Vịt món, Vịt hấp, xào lăn, canh măng, Rau bồ công anh, Sữa chua ( nhân viên ), Trà Sâm Dứa, Dưa chua, Mỳ trắng, Xúc xích, Rượu men lá - 1000ml, Bia Thái Nguyên, Mâm món trẻ con, Mâm món, Mâm đặt, Lẩu 6 người, Cỗ nhỏ, Vịt + tiết canh, Cầy 5,2kg, Gà trống thiến - hấp, xào mướp. xào xả ớt, Bia sài gòn, Bia Heineken, Rượu Bằng Phúc, Nước lọc ( nhỏ ), Tôm bỏ vỏ sốt trứng muối, Ngan hấp, Ngan xào sả ớt, Miến tỏi đen. Thêm 8 tên biến thể đã đối chiếu thủ công, không dùng suy đoán từ khóa. Ảnh mâm/lẩu là minh họa, không quy định thành phần thực đơn. Ưu tiên ảnh máy chủ, giữ nguyên dữ liệu món/giá/đơn hàng và ẩn ảnh khi in.

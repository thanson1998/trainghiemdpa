# Đơn mang về

POS có lựa chọn Tại quán / Mang về. Đơn mang về lưu `serviceType: takeaway` và `tables: []`, không có bàn giả và không chiếm bàn trên sơ đồ. Lựa chọn cũng có trong form sửa đơn để nhất quán khi mở từ danh sách hoặc Thanh toán.

Tổng tiền = giá đơn với đơn mang về; đơn tại quán vẫn là giá mỗi bàn × số bàn. Cùng một hàm tính được dùng ở POS, API thanh toán, hóa đơn, báo cáo, CSV và lịch sử. Set mang về dùng một đơn vị tính hoặc số set đã chọn rõ ràng. Khi chuyển đơn tại quán thành mang về, số set cũ và tổng giá đã chốt được giữ.

Nút In bill mang về 80mm lưu đơn và mở bill tạm tính, không ghi nhận đã thu tiền. Gửi bếp và thanh toán vẫn theo luồng hiện có. Phiếu in hiện MANG VỀ, không có ảnh và không ghi 0 bàn. Đơn mang về không chuyển bàn; muốn dùng bàn, đổi sang Tại quán và chọn bàn trước khi lưu.

Migration `0012_takeaway.sql` thêm hình thức phục vụ, giữ nguyên đơn cũ dưới hình thức tại quán và lưu hình thức mang về trong lịch sử. Thanh toán, hoàn tác thanh toán, hủy, xóa, khôi phục và xác nhận gửi bếp giữ đúng hình thức phục vụ.

-- Add the owner's twelve-dish salmon menu. Prices remain unspecified.
UPDATE menu_catalog
SET data=json_insert(data,'$.templates[#]',json('{"id":"69ce6d05-4958-4fa5-b0fb-c62b453782ee","name":"Thực đơn Cá hồi","menu":"DPA_MENU_V1:[{\"name\":\"Cá hồi\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Ba ba rang muối\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Ba ba om chuối đậu\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Thịt gà hấp\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Chim câu quay\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Thịt lợn mán nướng\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Cá chép tẩm bột chiên\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Rau củ quả luộc hoặc dưa chua\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Canh xương ngô củ quả\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Gỏi lạc\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Xôi lạc\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"},{\"name\":\"Hoa quả tráng miệng\",\"price\":null,\"quantity\":1,\"unit\":\"đĩa\"}]"}')),
    version=version+1,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='dpa-shared'
  AND NOT EXISTS (
    SELECT 1 FROM json_each(data,'$.templates')
    WHERE json_extract(value,'$.id')='69ce6d05-4958-4fa5-b0fb-c62b453782ee'
       OR json_extract(value,'$.name')='Thực đơn Cá hồi'
  );

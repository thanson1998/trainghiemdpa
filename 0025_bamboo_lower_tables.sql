-- Add the new area once while preserving every existing table ID and booking.
UPDATE table_layout
SET data=json_insert(data,'$[#]',json('{"id":"NTD","title":"Nhà Tre Dưới","sub":"Không gian trong nhà","type":"inside","count":10,"tables":["NTD-01","NTD-02","NTD-03","NTD-04","NTD-05","NTD-06","NTD-07","NTD-08","NTD-09","NTD-10"]}')),version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='dpa-shared' AND NOT EXISTS(SELECT 1 FROM json_each(table_layout.data) area WHERE json_extract(area.value,'$.id')='NTD' OR lower(trim(json_extract(area.value,'$.title')))=lower('Nhà Tre Dưới'));

-- Add the new area once while preserving every existing table ID and booking.
UPDATE table_layout
SET data=json_insert(data,'$[#]',json('{"id":"NTC","title":"Nhà Tre Cao","sub":"Không gian trong nhà","type":"inside","count":6,"tables":["NTC-01","NTC-02","NTC-03","NTC-04","NTC-05","NTC-06"]}')),version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='dpa-shared' AND NOT EXISTS(SELECT 1 FROM json_each(table_layout.data) area WHERE json_extract(area.value,'$.id')='NTC' OR lower(trim(json_extract(area.value,'$.title')))=lower('Nhà Tre Cao'));

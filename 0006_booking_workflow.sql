ALTER TABLE reservations ADD COLUMN total_people INTEGER;
ALTER TABLE reservations ADD COLUMN price_mode TEXT NOT NULL DEFAULT 'agreed';
CREATE TABLE reservation_history(event_id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id TEXT NOT NULL,action TEXT NOT NULL,version INTEGER NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX reservation_history_booking ON reservation_history(booking_id,event_id);
CREATE TABLE booking_prints(id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id TEXT NOT NULL,booking_version INTEGER NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX booking_prints_booking ON booking_prints(booking_id,id);
INSERT INTO reservation_history(booking_id,action,version,snapshot,created_at) SELECT r.id,'baseline',r.version,json_object('id',r.id,'orderCode',r.order_code,'date',r.date,'start',r.start,'end',r.end,'name',r.name,'phone',r.phone,'people',r.people,'platters',r.platters,'price',r.price,'deposit',r.deposit,'menu',r.menu,'note',r.note,'status',r.status,'version',r.version,'updatedAt',r.updated_at,'totalPeople',r.total_people,'priceMode',r.price_mode,'tables',json(r.table_ids)),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM reservations r;
CREATE TRIGGER reservation_history_create AFTER UPDATE OF order_code ON reservations WHEN OLD.order_code IS NULL AND NEW.order_code IS NOT NULL BEGIN
 INSERT INTO reservation_history(booking_id,action,version,snapshot,created_at) VALUES(NEW.id,'created',NEW.version,json_object('id',NEW.id,'orderCode',NEW.order_code,'date',NEW.date,'start',NEW.start,'end',NEW.end,'name',NEW.name,'phone',NEW.phone,'people',NEW.people,'platters',NEW.platters,'price',NEW.price,'deposit',NEW.deposit,'menu',NEW.menu,'note',NEW.note,'status',NEW.status,'version',NEW.version,'updatedAt',NEW.updated_at,'totalPeople',NEW.total_people,'priceMode',NEW.price_mode,'tables',json(NEW.table_ids)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER reservation_history_update AFTER UPDATE ON reservations WHEN OLD.version<>NEW.version BEGIN
 INSERT INTO reservation_history(booking_id,action,version,snapshot,created_at) VALUES(NEW.id,'updated',NEW.version,json_object('id',NEW.id,'orderCode',NEW.order_code,'date',NEW.date,'start',NEW.start,'end',NEW.end,'name',NEW.name,'phone',NEW.phone,'people',NEW.people,'platters',NEW.platters,'price',NEW.price,'deposit',NEW.deposit,'menu',NEW.menu,'note',NEW.note,'status',NEW.status,'version',NEW.version,'updatedAt',NEW.updated_at,'totalPeople',NEW.total_people,'priceMode',NEW.price_mode,'tables',json(NEW.table_ids)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER reservation_history_code AFTER UPDATE OF order_code ON reservations WHEN OLD.order_code IS NOT NULL AND OLD.order_code<>NEW.order_code BEGIN
 UPDATE reservation_history SET snapshot=json_set(snapshot,'$.orderCode',NEW.order_code) WHERE booking_id=NEW.id AND version=NEW.version;
END;
CREATE TRIGGER reservation_history_delete BEFORE DELETE ON reservations BEGIN
 INSERT INTO reservation_history(booking_id,action,version,snapshot,created_at) VALUES(OLD.id,'deleted',OLD.version,json_object('id',OLD.id,'orderCode',OLD.order_code,'date',OLD.date,'start',OLD.start,'end',OLD.end,'name',OLD.name,'phone',OLD.phone,'people',OLD.people,'platters',OLD.platters,'price',OLD.price,'deposit',OLD.deposit,'menu',OLD.menu,'note',OLD.note,'status',OLD.status,'version',OLD.version,'updatedAt',OLD.updated_at,'totalPeople',OLD.total_people,'priceMode',OLD.price_mode,'tables',json(OLD.table_ids)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

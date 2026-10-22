ALTER TABLE reservations ADD COLUMN order_code text;

CREATE TABLE reservation_day_counters (
 user_id text NOT NULL,
 date text NOT NULL,
 last_number integer NOT NULL,
 PRIMARY KEY (user_id, date)
);

-- Older rows have no creation timestamp; assign once by last update, then id.
WITH ranked AS (
 SELECT id, date, ROW_NUMBER() OVER (PARTITION BY user_id, date ORDER BY updated_at, id) AS number
 FROM reservations
)
UPDATE reservations SET order_code = (
 SELECT printf('DPA-%s%s%s-%02d', substr(r.date,9,2), substr(r.date,6,2), substr(r.date,1,4), r.number)
 FROM ranked r WHERE r.id=reservations.id
);

INSERT INTO reservation_day_counters (user_id,date,last_number)
SELECT user_id,date,COUNT(*) FROM reservations GROUP BY user_id,date;

CREATE UNIQUE INDEX reservations_order_code ON reservations(user_id,order_code);

-- A trigger runs inside the same write transaction, including concurrent devices.
CREATE TRIGGER reservations_assign_order_code AFTER INSERT ON reservations
BEGIN
 INSERT INTO reservation_day_counters (user_id,date,last_number) VALUES (NEW.user_id,NEW.date,1)
 ON CONFLICT(user_id,date) DO UPDATE SET last_number=last_number+1;
 UPDATE reservations SET order_code=(
  SELECT printf('DPA-%s%s%s-%02d',substr(NEW.date,9,2),substr(NEW.date,6,2),substr(NEW.date,1,4),last_number)
  FROM reservation_day_counters WHERE user_id=NEW.user_id AND date=NEW.date
 ) WHERE id=NEW.id;
END;

-- A move to another party date receives the next number for that date.
CREATE TRIGGER reservations_move_order_code AFTER UPDATE OF date ON reservations
WHEN OLD.date<>NEW.date
BEGIN
 INSERT INTO reservation_day_counters (user_id,date,last_number) VALUES (NEW.user_id,NEW.date,1)
 ON CONFLICT(user_id,date) DO UPDATE SET last_number=last_number+1;
 UPDATE reservations SET order_code=(
  SELECT printf('DPA-%s%s%s-%02d',substr(NEW.date,9,2),substr(NEW.date,6,2),substr(NEW.date,1,4),last_number)
  FROM reservation_day_counters WHERE user_id=NEW.user_id AND date=NEW.date
 ) WHERE id=NEW.id;
END;

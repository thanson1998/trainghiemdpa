ALTER TABLE reservations ADD COLUMN deposit integer NOT NULL DEFAULT 0;
CREATE TABLE menu_catalog (
 id text PRIMARY KEY NOT NULL,
 data text NOT NULL,
 version integer NOT NULL DEFAULT 1,
 updated_at text NOT NULL
);

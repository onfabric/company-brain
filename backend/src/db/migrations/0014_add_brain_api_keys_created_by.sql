ALTER TABLE brain.api_keys
  ADD COLUMN created_by text NOT NULL REFERENCES auth."user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX api_keys_created_by_idx ON brain.api_keys (created_by);

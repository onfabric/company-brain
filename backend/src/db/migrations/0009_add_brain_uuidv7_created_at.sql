ALTER TABLE brain.data_sources
  ADD COLUMN created_at timestamptz GENERATED ALWAYS AS (uuid_extract_timestamp(id)) VIRTUAL;

ALTER TABLE brain.people
  ADD COLUMN created_at timestamptz GENERATED ALWAYS AS (uuid_extract_timestamp(id)) VIRTUAL;

ALTER TABLE brain.people_data_sources
  ADD COLUMN created_at timestamptz GENERATED ALWAYS AS (uuid_extract_timestamp(id)) VIRTUAL;

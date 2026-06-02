-- Normalize the integration identifier into its own table so future tables can
-- reference a data source by id. This migration adds the new FK column alongside
-- the legacy text column (renamed to nango_integration_id); a later migration
-- drops nango_integration_id once every reader has moved to data_source_id.
-- Backfilling brain.data_sources and records.data_source_id is done manually.
CREATE TABLE brain.data_sources (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  nango_integration_id text NOT NULL UNIQUE
);

ALTER TABLE brain.records RENAME COLUMN data_source_id TO nango_integration_id;

ALTER TABLE brain.records
  ADD COLUMN data_source_id uuid REFERENCES brain.data_sources (id);

DROP INDEX brain.records_data_source_updated_at_idx;
CREATE INDEX records_data_source_updated_at_idx ON brain.records (data_source_id, updated_at DESC);

DROP INDEX brain.records_bm25_idx;

CREATE INDEX records_bm25_idx ON brain.records
  USING bm25 (id, body, data_source_id, nango_model, created_at, updated_at)
  WITH (key_field = 'id');

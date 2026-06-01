CREATE TABLE brain.records (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL,
  data_source_id      text NOT NULL,
  nango_connection_id integer NOT NULL,
  nango_model         text NOT NULL,
  nango_id            uuid NOT NULL,
  body                text NOT NULL,
  UNIQUE (nango_connection_id, nango_model, nango_id)
);

CREATE INDEX records_created_at_idx ON brain.records (created_at);
CREATE INDEX records_updated_at_idx ON brain.records (updated_at);
CREATE INDEX records_data_source_updated_at_idx ON brain.records (data_source_id, updated_at DESC);

CREATE INDEX records_bm25_idx ON brain.records
  USING bm25 (id, body, updated_at, data_source_id)
  WITH (key_field = 'id');

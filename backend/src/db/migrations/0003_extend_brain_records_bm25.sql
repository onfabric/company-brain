-- Widen the bm25 index so the discovery/search API can filter on data_source_id
-- and nango_model and bound either created_at or updated_at, all pushed down
-- into the index instead of post-filtered on the heap.
DROP INDEX brain.records_bm25_idx;

CREATE INDEX records_bm25_idx ON brain.records
  USING bm25 (id, body, data_source_id, nango_model, created_at, updated_at)
  WITH (key_field = 'id');

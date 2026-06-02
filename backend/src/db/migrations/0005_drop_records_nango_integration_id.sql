-- Drop the legacy integration name from records now that every reader uses the
-- data_source_id FK. The integration name lives only in brain.data_sources.
-- SET NOT NULL runs first as a safety gate: if any record was not backfilled,
-- it fails and the whole migration rolls back, leaving nango_integration_id in
-- place rather than dropping the only way to reconstruct the mapping.
ALTER TABLE brain.records ALTER COLUMN data_source_id SET NOT NULL;
ALTER TABLE brain.records DROP COLUMN nango_integration_id;

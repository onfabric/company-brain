-- Document the uuidv7-derived `created_at` columns. Postgres reports GENERATED
-- columns as nullable in the catalog, so the `@notNull` marker tells bun-sqlgen
-- they are always present — declared once here instead of per query.
COMMENT ON COLUMN brain.api_keys.created_at IS 'Derived from the uuidv7 id; the moment the row was created. @notNull';
COMMENT ON COLUMN brain.knowledge.created_at IS 'Derived from the uuidv7 id; the moment the row was created. @notNull';
COMMENT ON COLUMN brain.data_sources.created_at IS 'Derived from the uuidv7 id; the moment the row was created. @notNull';
COMMENT ON COLUMN brain.people.created_at IS 'Derived from the uuidv7 id; the moment the row was created. @notNull';
COMMENT ON COLUMN brain.people_data_sources.created_at IS 'Derived from the uuidv7 id; the moment the row was created. @notNull';

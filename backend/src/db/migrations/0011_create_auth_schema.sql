-- Dedicated schema for better-auth's own tables (created in the next migration
-- from raw CLI output), kept separate from the app-owned brain.* tables.
CREATE SCHEMA IF NOT EXISTS auth;

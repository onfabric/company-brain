CREATE TABLE brain.api_keys (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  created_at timestamptz GENERATED ALWAYS AS (uuid_extract_timestamp(id)) VIRTUAL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  name       text NOT NULL,
  key_hash   text NOT NULL UNIQUE,
  key_prefix text NOT NULL
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON brain.api_keys
  FOR EACH ROW EXECUTE FUNCTION brain.set_updated_at();

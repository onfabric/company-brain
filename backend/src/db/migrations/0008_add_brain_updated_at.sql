CREATE FUNCTION brain.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER TABLE brain.data_sources
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brain.data_sources
  FOR EACH ROW EXECUTE FUNCTION brain.set_updated_at();

ALTER TABLE brain.people
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brain.people
  FOR EACH ROW EXECUTE FUNCTION brain.set_updated_at();

ALTER TABLE brain.people_data_sources
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brain.people_data_sources
  FOR EACH ROW EXECUTE FUNCTION brain.set_updated_at();

ALTER TABLE brain.records_people
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brain.records_people
  FOR EACH ROW EXECUTE FUNCTION brain.set_updated_at();

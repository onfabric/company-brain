CREATE TABLE brain.people (
  id    uuid PRIMARY KEY DEFAULT uuidv7(),
  name  text,
  email text
);

CREATE TABLE brain.people_data_sources (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  person_id           uuid NOT NULL REFERENCES brain.people (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  data_source_id      uuid NOT NULL REFERENCES brain.data_sources (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  data_source_user_id text NOT NULL,
  UNIQUE (data_source_id, data_source_user_id)
);

CREATE INDEX people_data_sources_person_id_idx ON brain.people_data_sources (person_id);

CREATE TABLE brain.records_people (
  record_id uuid NOT NULL REFERENCES brain.records (id) ON DELETE CASCADE ON UPDATE CASCADE,
  person_id uuid NOT NULL REFERENCES brain.people (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (record_id, person_id)
);

CREATE INDEX records_people_person_id_record_id_idx ON brain.records_people (person_id, record_id);

CREATE TABLE brain.knowledge_types (
  id   uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL UNIQUE
);

CREATE TABLE brain.knowledge (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  knowledge_type_id uuid NOT NULL REFERENCES brain.knowledge_types (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  title             text NOT NULL,
  body              text NOT NULL
);

CREATE INDEX knowledge_type_id_idx ON brain.knowledge (knowledge_type_id);

CREATE INDEX knowledge_bm25_idx ON brain.knowledge
  USING bm25 (id, title, body, knowledge_type_id)
  WITH (key_field = 'id');

CREATE TABLE brain.knowledge_people (
  knowledge_id uuid NOT NULL REFERENCES brain.knowledge (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  person_id    uuid NOT NULL REFERENCES brain.people (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (knowledge_id, person_id)
);

-- Reverse of the PK: lookups by person (the PK only covers knowledge_id first).
CREATE INDEX knowledge_people_person_id_knowledge_id_idx ON brain.knowledge_people (person_id, knowledge_id);

CREATE TABLE brain.knowledge_records (
  knowledge_id uuid NOT NULL REFERENCES brain.knowledge (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  record_id    uuid NOT NULL REFERENCES brain.records (id) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (knowledge_id, record_id)
);

-- Reverse of the PK: lookups by record (the PK only covers knowledge_id first).
CREATE INDEX knowledge_records_record_id_knowledge_id_idx ON brain.knowledge_records (record_id, knowledge_id);

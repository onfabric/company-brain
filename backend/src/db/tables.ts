// Row types for the `brain` schema tables — one exported type per table.
// Add a type here whenever a migration adds a table; see AGENTS.md.

export type DataSources = {
  id: string;
  nango_integration_id: string;
  created_at: Date;
  updated_at: Date;
};

export type Records = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data_source_id: DataSources['id'];
  nango_connection_id: number;
  nango_model: string;
  nango_id: string;
  body: string;
};

export type People = {
  id: string;
  name: string | null;
  email: string | null;
  is_external: boolean;
  created_at: Date;
  updated_at: Date;
};

export type PeopleDataSources = {
  id: string;
  person_id: People['id'];
  data_source_id: DataSources['id'];
  data_source_user_id: string;
  created_at: Date;
  updated_at: Date;
};

export type RecordsPeople = {
  record_id: Records['id'];
  person_id: People['id'];
  created_at: Date;
  updated_at: Date;
};

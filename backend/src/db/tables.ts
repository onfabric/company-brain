// Row types for the `brain` schema tables — one exported type per table.
// Add a type here whenever a migration adds a table; see AGENTS.md.

export type Records = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data_source_id: string;
  nango_connection_id: number;
  nango_model: string;
  nango_id: string;
  body: string;
};

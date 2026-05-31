import type { NotionFile, NotionLink, NotionPerson, NotionReference } from './models.js';

export type RawNotionParent = {
  type?: string;
  workspace?: boolean;
  page_id?: string;
  database_id?: string;
  data_source_id?: string;
  block_id?: string;
  agent_id?: string;
};

export type RawNotionUser = {
  object?: string;
  id?: string;
  name?: string | null;
  type?: string;
  person?: {
    email?: string | null;
  };
  bot?: {
    owner?: unknown;
  };
};

export type RawRichText = {
  type?: string;
  plain_text?: string;
  href?: string | null;
  text?: {
    content?: string;
    link?: {
      url?: string;
    } | null;
  };
  mention?: {
    type?: string;
    page?: {
      id?: string;
    };
    database?: {
      id?: string;
    };
    date?: {
      start?: string;
      end?: string | null;
    } | null;
    user?: RawNotionUser;
    link_preview?: {
      url?: string;
    };
  };
  equation?: {
    expression?: string;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
};

export type RawNotionFile = {
  type?: 'external' | 'file' | 'file_upload' | string;
  name?: string;
  caption?: RawRichText[];
  external?: {
    url?: string;
  };
  file?: {
    url?: string;
    expiry_time?: string;
  };
  file_upload?: {
    id?: string;
  };
};

export type RawNotionPage = {
  object?: 'page' | string;
  id: string;
  created_time?: string;
  last_edited_time?: string;
  created_by?: RawNotionUser;
  last_edited_by?: RawNotionUser;
  parent?: RawNotionParent;
  properties?: Record<string, RawPageProperty>;
  url?: string;
  public_url?: string | null;
  cover?: RawNotionFile | null;
  icon?: RawNotionFile | { type?: string; emoji?: string } | null;
  in_trash?: boolean;
  archived?: boolean;
};

export type RawNotionDatabase = {
  object?: 'database' | string;
  id: string;
  title?: RawRichText[];
  url?: string;
  data_sources?: Array<{
    id?: string;
    name?: string;
  }>;
};

export type RawNotionDataSource = {
  object?: 'data_source' | string;
  id: string;
  name?: string;
  title?: RawRichText[];
  parent?: RawNotionParent;
  database_parent?: RawNotionParent;
};

export type RawNotionBlock = {
  object?: 'block' | string;
  id: string;
  type?: string;
  has_children?: boolean;
  parent?: RawNotionParent;
  created_time?: string;
  last_edited_time?: string;
  unsupported?: {
    block_type?: string;
  };
  audio?: RawNotionFile;
  bookmark?: {
    caption?: RawRichText[];
    url?: string;
  };
  bulleted_list_item?: RichTextBlock;
  callout?: RichTextBlock & {
    icon?: { type?: string; emoji?: string };
  };
  child_database?: {
    title?: string;
  };
  child_page?: {
    title?: string;
  };
  code?: {
    caption?: RawRichText[];
    rich_text?: RawRichText[];
    language?: string;
  };
  embed?: {
    url?: string;
  };
  equation?: {
    expression?: string;
  };
  file?: RawNotionFile;
  heading_1?: RichTextBlock & {
    is_toggleable?: boolean;
  };
  heading_2?: RichTextBlock & {
    is_toggleable?: boolean;
  };
  heading_3?: RichTextBlock & {
    is_toggleable?: boolean;
  };
  heading_4?: RichTextBlock & {
    is_toggleable?: boolean;
  };
  image?: RawNotionFile;
  link_preview?: {
    url?: string;
  };
  link_to_page?: {
    type?: string;
    page_id?: string;
    database_id?: string;
  };
  numbered_list_item?: RichTextBlock;
  paragraph?: RichTextBlock;
  pdf?: RawNotionFile;
  quote?: RichTextBlock;
  synced_block?: {
    synced_from?: {
      type?: string;
      block_id?: string;
    } | null;
  };
  table?: {
    has_column_header?: boolean;
    has_row_header?: boolean;
  };
  table_row?: {
    cells?: RawRichText[][];
  };
  template?: RichTextBlock;
  to_do?: RichTextBlock & {
    checked?: boolean;
  };
  toggle?: RichTextBlock;
  video?: RawNotionFile;
};

export type RichTextBlock = {
  rich_text?: RawRichText[];
  color?: string;
};

export type RawPageProperty = {
  id?: string;
  type?: string;
  checkbox?: boolean;
  created_by?: RawNotionUser;
  created_time?: string;
  date?: {
    start?: string;
    end?: string | null;
  } | null;
  email?: string | null;
  files?: RawNotionFile[];
  formula?: RawFormulaValue;
  last_edited_by?: RawNotionUser;
  last_edited_time?: string;
  multi_select?: Array<{ name?: string }>;
  number?: number | null;
  people?: RawNotionUser[];
  phone_number?: string | null;
  relation?: Array<{ id?: string }>;
  rich_text?: RawRichText[];
  rollup?: RawRollupValue;
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  title?: RawRichText[];
  unique_id?: {
    prefix?: string | null;
    number?: number;
  };
  url?: string | null;
  verification?: {
    state?: string;
    verified_by?: RawNotionUser | null;
    date?: {
      start?: string;
      end?: string | null;
    } | null;
  };
};

export type RawFormulaValue = {
  type?: string;
  boolean?: boolean | null;
  date?: {
    start?: string;
    end?: string | null;
  } | null;
  number?: number | null;
  string?: string | null;
};

export type RawRollupValue = {
  type?: string;
  array?: RawPageProperty[];
  date?: {
    start?: string;
    end?: string | null;
  } | null;
  number?: number | null;
  unsupported?: unknown;
};

export type RenderedRichText = {
  text: string;
  links: NotionLink[];
  mentionedPeople: NotionPerson[];
  relatedPages: NotionReference[];
  childDatabases: NotionReference[];
  pageIds: string[];
  databaseIds: string[];
};

export type RenderedContent = {
  markdown: string;
  files: NotionFile[];
  links: NotionLink[];
  mentionedPeople: NotionPerson[];
  childPages: NotionReference[];
  childDatabases: NotionReference[];
  relatedPages: NotionReference[];
  pageIds: string[];
  databaseIds: string[];
  dataSourceIds: string[];
};

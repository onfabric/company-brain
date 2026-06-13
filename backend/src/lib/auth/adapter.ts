import { createAdapterFactory } from 'better-auth/adapters';
import type { SQL } from 'bun';

const AUTH_SCHEMA = 'auth';

type CleanedWhere = {
  field: string;
  value: string | number | boolean | string[] | number[] | Date | null;
  operator:
    | 'eq'
    | 'ne'
    | 'lt'
    | 'lte'
    | 'gt'
    | 'gte'
    | 'in'
    | 'not_in'
    | 'contains'
    | 'starts_with'
    | 'ends_with';
  connector: 'AND' | 'OR';
  mode: 'sensitive' | 'insensitive';
};

function quoteId(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function qualified(model: string): string {
  return `${AUTH_SCHEMA}.${quoteId(model)}`;
}

type Param = string | number | boolean | string[] | number[] | Date | null;

class SqlBuilder {
  private readonly params: Param[] = [];

  placeholder(value: Param): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  values(): Param[] {
    return this.params;
  }
}

// Bun.sql rejects `= ANY($n)` with a bound array, so `in`/`not_in` expand to a
// placeholder list. An empty set degrades to a constant: nothing matches `in`,
// everything matches `not_in`.
function inList(builder: SqlBuilder, column: string, value: Param, negate: boolean): string {
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) {
    return negate ? 'TRUE' : 'FALSE';
  }
  const placeholders = items.map((item) => builder.placeholder(item as Param)).join(', ');
  return `${column} ${negate ? 'NOT IN' : 'IN'} (${placeholders})`;
}

function comparison(builder: SqlBuilder, where: CleanedWhere): string {
  const column = quoteId(where.field);
  const insensitive = where.mode === 'insensitive';
  const lhs = insensitive ? `lower(${column}::text)` : column;
  const bind = (value: Param): string => {
    const placeholder = builder.placeholder(value);
    return insensitive && typeof value === 'string' ? `lower(${placeholder})` : placeholder;
  };

  switch (where.operator) {
    case 'eq':
      return where.value === null ? `${column} IS NULL` : `${lhs} = ${bind(where.value)}`;
    case 'ne':
      return where.value === null ? `${column} IS NOT NULL` : `${lhs} <> ${bind(where.value)}`;
    case 'lt':
      return `${column} < ${builder.placeholder(where.value)}`;
    case 'lte':
      return `${column} <= ${builder.placeholder(where.value)}`;
    case 'gt':
      return `${column} > ${builder.placeholder(where.value)}`;
    case 'gte':
      return `${column} >= ${builder.placeholder(where.value)}`;
    case 'in':
      return inList(builder, column, where.value, false);
    case 'not_in':
      return inList(builder, column, where.value, true);
    case 'contains':
      return `${lhs} LIKE ${bind(`%${String(where.value)}%`)}`;
    case 'starts_with':
      return `${lhs} LIKE ${bind(`${String(where.value)}%`)}`;
    case 'ends_with':
      return `${lhs} LIKE ${bind(`%${String(where.value)}`)}`;
  }
}

function whereClause(builder: SqlBuilder, where: CleanedWhere[] | undefined): string {
  if (!where || where.length === 0) {
    return '';
  }
  const [first, ...rest] = where;
  let clause = comparison(builder, first as CleanedWhere);
  for (const condition of rest) {
    const sql = comparison(builder, condition);
    clause = condition.connector === 'OR' ? `${clause} OR ${sql}` : `${clause} AND ${sql}`;
  }
  return ` WHERE ${clause}`;
}

function selectColumns(select: string[] | undefined): string {
  if (!select || select.length === 0) {
    return '*';
  }
  return select.map(quoteId).join(', ');
}

function assignments(builder: SqlBuilder, update: Record<string, unknown>): string[] {
  return Object.entries(update).map(
    ([column, value]) => `${quoteId(column)} = ${builder.placeholder(value as Param)}`,
  );
}

// Bun.sql resolves a query to a rows array that also carries `count` (the
// number of rows the statement affected) — the source of truth for the
// affected-row totals `updateMany`/`deleteMany` must return.
type SqlResult<T> = T[] & { count: number };

export function bunSqlAdapter(sql: SQL) {
  const run = <T>(text: string, params: Param[]): Promise<SqlResult<T>> =>
    sql.unsafe(text, params) as unknown as Promise<SqlResult<T>>;

  return createAdapterFactory({
    config: {
      adapterId: 'bun-sql',
      adapterName: 'Bun SQL Adapter',
      supportsJSON: false,
      supportsDates: true,
      supportsBooleans: true,
      supportsArrays: false,
      supportsNumericIds: false,
      usePlural: false,
    },
    adapter: () => ({
      create: async ({ model, data }) => {
        const entries = Object.entries(data);
        const builder = new SqlBuilder();
        const placeholders = entries.map(([, value]) => builder.placeholder(value as Param));
        const text =
          entries.length === 0
            ? `INSERT INTO ${qualified(model)} DEFAULT VALUES RETURNING *`
            : `INSERT INTO ${qualified(model)} (${entries.map(([column]) => quoteId(column)).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        const [row] = await run<Record<string, unknown>>(text, builder.values());
        return row as never;
      },

      findOne: async ({ model, where, select }) => {
        const builder = new SqlBuilder();
        const text = `SELECT ${selectColumns(select)} FROM ${qualified(model)}${whereClause(builder, where)} LIMIT 1`;
        const [row] = await run<Record<string, unknown>>(text, builder.values());
        return (row ?? null) as never;
      },

      findMany: async ({ model, where, limit, sortBy, offset, select }) => {
        const builder = new SqlBuilder();
        let text = `SELECT ${selectColumns(select)} FROM ${qualified(model)}${whereClause(builder, where)}`;
        if (sortBy) {
          text += ` ORDER BY ${quoteId(sortBy.field)} ${sortBy.direction === 'desc' ? 'DESC' : 'ASC'}`;
        }
        if (typeof limit === 'number') {
          text += ` LIMIT ${builder.placeholder(limit)}`;
        }
        if (typeof offset === 'number') {
          text += ` OFFSET ${builder.placeholder(offset)}`;
        }
        return (await run<Record<string, unknown>>(text, builder.values())) as never;
      },

      count: async ({ model, where }) => {
        const builder = new SqlBuilder();
        const text = `SELECT count(*)::int AS count FROM ${qualified(model)}${whereClause(builder, where)}`;
        const [row] = await run<{ count: number }>(text, builder.values());
        return row?.count ?? 0;
      },

      update: async ({ model, where, update }) => {
        const builder = new SqlBuilder();
        const set = assignments(builder, update as Record<string, unknown>);
        if (set.length === 0) {
          return null as never;
        }
        const text = `UPDATE ${qualified(model)} SET ${set.join(', ')}${whereClause(builder, where)} RETURNING *`;
        const [row] = await run<Record<string, unknown>>(text, builder.values());
        return (row ?? null) as never;
      },

      updateMany: async ({ model, where, update }) => {
        const builder = new SqlBuilder();
        const set = assignments(builder, update);
        if (set.length === 0) {
          return 0;
        }
        const text = `UPDATE ${qualified(model)} SET ${set.join(', ')}${whereClause(builder, where)}`;
        const result = await run<unknown>(text, builder.values());
        return result.count;
      },

      delete: async ({ model, where }) => {
        const builder = new SqlBuilder();
        await run(
          `DELETE FROM ${qualified(model)}${whereClause(builder, where)}`,
          builder.values(),
        );
      },

      deleteMany: async ({ model, where }) => {
        const builder = new SqlBuilder();
        const result = await run<unknown>(
          `DELETE FROM ${qualified(model)}${whereClause(builder, where)}`,
          builder.values(),
        );
        return result.count;
      },
    }),
  });
}

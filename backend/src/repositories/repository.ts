import type { TypedSQL } from '@ilbertt/bun-sqlgen';

export abstract class Repository {
  protected readonly sql: TypedSQL;

  constructor(sql: TypedSQL) {
    this.sql = sql;
  }
}

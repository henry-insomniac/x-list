import pg from "pg";

export type Db = pg.Pool;

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 20
  });
}


import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";

import pg from "pg";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1)
});

async function main() {
  const envParsed = envSchema.safeParse(process.env);
  if (!envParsed.success) {
    // eslint-disable-next-line no-console
    console.error(envParsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: envParsed.data.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const migrationsDir = new URL("../migrations/", import.meta.url);
    const filenames = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const applied = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations`
    );
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    // eslint-disable-next-line no-console
    console.log(`Found ${filenames.length} migrations, applied ${appliedSet.size}`);

    for (const filename of filenames) {
      if (appliedSet.has(filename)) continue;

      const sql = await readFile(new URL(filename, migrationsDir), "utf8");
      // eslint-disable-next-line no-console
      console.log(`Applying ${filename}...`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [
          filename
        ]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


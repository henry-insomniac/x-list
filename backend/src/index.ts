import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";

import { requireApiKey } from "./auth.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { createPool } from "./db.js";
import { getEnv, parseCorsOrigins } from "./env.js";
import { extractTweetId } from "./tweetId.js";

const createTweetBodySchema = z.object({
  title: z.string().trim().min(1).max(280).optional(),
  content: z.string().trim().min(1).max(4000),
  author: z.string().trim().min(1).max(100).optional(),
  url: z.string().trim().url().max(2048)
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional()
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional()
});

function toDto(row: any) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author: row.author,
    url: row.url,
    tweetId: row.tweet_id,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at
  };
}

async function main() {
  const env = getEnv();
  const pool = createPool(env.DATABASE_URL);

  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: parseCorsOrigins(env.CORS_ORIGIN)
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute"
  });

  app.setErrorHandler((err: any, _req, reply) => {
    const statusCode = err?.statusCode ?? 500;
    const message =
      statusCode >= 500 ? "Internal Server Error" : (err?.message ?? "Error");
    reply.status(statusCode).send({
      error: {
        message
      }
    });
  });

  app.get("/health", async () => ({ ok: true }));

  app.post(
    "/api/tweets",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      requireApiKey(request, env.API_KEY);

    const parsed = createTweetBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { message: "Invalid request body", issues: parsed.error.issues }
      });
    }

    const { title, content, author, url } = parsed.data;
    const tweetId = extractTweetId(url);

    const result = await pool.query(
      `
      INSERT INTO tweets (title, content, author, url, tweet_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (url) DO UPDATE
      SET title = EXCLUDED.title,
          content = EXCLUDED.content,
          author = EXCLUDED.author,
          tweet_id = EXCLUDED.tweet_id,
          updated_at = now()
      RETURNING id, title, content, author, url, tweet_id, created_at, updated_at
      `,
      [title ?? null, content, author ?? null, url, tweetId]
    );

      return reply.status(201).send({ item: toDto(result.rows[0]) });
    }
  );

  app.get("/api/tweets", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid query" } });
    }

    const limit = parsed.data.limit ?? 20;
    const cursor = decodeCursor(parsed.data.cursor);

    const params: any[] = [];
    let where = "";
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      where = `WHERE (created_at, id) < ($1::timestamptz, $2::uuid)`;
    }
    params.push(limit);
    const limitParamIndex = params.length;

    const result = await pool.query(
      `
      SELECT id, title, content, author, url, tweet_id, created_at, updated_at
      FROM tweets
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParamIndex}
      `,
      params
    );

    const items = result.rows.map(toDto);
    const last = result.rows[result.rows.length - 1];
    const nextCursor =
      last && items.length === limit
        ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
        : null;

    return reply.send({ items, nextCursor });
  });

  app.get("/api/tweets/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid query" } });
    }

    const { q } = parsed.data;
    const limit = parsed.data.limit ?? 20;
    const cursor = decodeCursor(parsed.data.cursor);
    const qLike = `%${q}%`;

    const params: any[] = [qLike, qLike, qLike];
    let where = `WHERE (title ILIKE $1 OR content ILIKE $2 OR author ILIKE $3)`;
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      where += ` AND (created_at, id) < ($4::timestamptz, $5::uuid)`;
    }
    params.push(limit);
    const limitParamIndex = params.length;

    const result = await pool.query(
      `
      SELECT id, title, content, author, url, tweet_id, created_at, updated_at
      FROM tweets
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParamIndex}
      `,
      params
    );

    const items = result.rows.map(toDto);
    const last = result.rows[result.rows.length - 1];
    const nextCursor =
      last && items.length === limit
        ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
        : null;

    return reply.send({ items, nextCursor });
  });

  app.delete("/api/tweets/:id", async (request, reply) => {
    requireApiKey(request, env.API_KEY);

    const id = (request.params as any).id;
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Invalid id" } });
    }

    const result = await pool.query(`DELETE FROM tweets WHERE id = $1`, [
      parsed.data
    ]);

    return reply.send({ ok: true, deleted: result.rowCount });
  });

  const close = async () => {
    await pool.end();
    await app.close();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


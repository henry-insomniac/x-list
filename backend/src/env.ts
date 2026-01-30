import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_KEY: z.string().min(16).optional().default(""),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().optional().default("*"),
  NODE_ENV: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  const env = parsed.data;
  if (!env.API_KEY) {
    throw new Error("Missing API_KEY (must be set for write endpoints)");
  }
  return env;
}

export function parseCorsOrigins(corsOrigin: string): string[] | boolean {
  const trimmed = corsOrigin.trim();
  if (!trimmed || trimmed === "*") return true;
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}


import type { FastifyRequest } from "fastify";

export function requireApiKey(request: FastifyRequest, expected: string): void {
  const apiKey = request.headers["x-api-key"];
  const value = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  if (!value || value !== expected) {
    const err = new Error("Unauthorized");
    // @ts-expect-error attach statusCode for Fastify error handler
    err.statusCode = 401;
    throw err;
  }
}


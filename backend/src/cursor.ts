import { z } from "zod";

const cursorSchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().min(1)
});

export type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: unknown): Cursor | null {
  if (!raw) return null;
  if (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== "string") return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    const validated = cursorSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}


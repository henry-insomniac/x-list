export type Tweet = {
  id: string;
  title: string | null;
  content: string;
  author: string | null;
  url: string;
  tweetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TweetListResponse = {
  items: Tweet[];
  nextCursor: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return base + path.slice(1);
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return base + path;
}

function withParams(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(joinUrl(API_BASE, path), window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  const full = url.toString();
  // strip origin if API_BASE is relative (e.g. "/")
  if (!API_BASE || API_BASE.startsWith("/")) return full.replace(url.origin, "");
  return full;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (data.error?.message || data.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function listTweets(args: {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TweetListResponse> {
  const url = withParams("/api/tweets", {
    cursor: args.cursor ?? undefined,
    limit: args.limit ?? 20
  });
  return fetchJson<TweetListResponse>(url, { signal: args.signal });
}

export async function searchTweets(args: {
  q: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TweetListResponse> {
  const url = withParams("/api/tweets/search", {
    q: args.q,
    cursor: args.cursor ?? undefined,
    limit: args.limit ?? 20
  });
  return fetchJson<TweetListResponse>(url, { signal: args.signal });
}


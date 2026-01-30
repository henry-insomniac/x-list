export function extractTweetId(url: string): string | null {
  // Supports:
  // - https://x.com/<user>/status/<id>
  // - https://twitter.com/<user>/status/<id>
  // - .../status/<id>?...
  const match = url.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}


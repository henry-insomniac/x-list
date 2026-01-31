const NS = "xlist";

function key(name: string) {
  return `${NS}_${name}_v1`;
}

export function loadJson<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(name: string, value: unknown): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadString(name: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveString(name: string, value: string): void {
  try {
    localStorage.setItem(key(name), value);
  } catch {
    // ignore
  }
}


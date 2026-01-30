import { useEffect, useMemo, useRef, useState } from "react";

import { listTweets, searchTweets, type Tweet } from "./api";
import "./App.css";
import { TweetCard } from "./components/TweetCard";

const PAGE_LIMIT = 20;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function App() {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 350);

  const [items, setItems] = useState<Tweet[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mode = useMemo(() => (dq.trim() ? "search" : "list"), [dq]);

  async function loadFirstPage() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    setItems([]);
    setNextCursor(null);
    try {
      const data =
        mode === "search"
          ? await searchTweets({ q: dq.trim(), limit: PAGE_LIMIT, signal: controller.signal })
          : await listTweets({ limit: PAGE_LIMIT, signal: controller.signal });
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (e) {
      if ((e as any)?.name === "AbortError") return;
      const msg = (e as Error).message || "请求失败";
      setError(`${msg}（请确认后端已启动，且前端的 VITE_API_BASE_URL 配置正确）`);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        mode === "search"
          ? await searchTweets({ q: dq.trim(), cursor: nextCursor, limit: PAGE_LIMIT })
          : await listTweets({ cursor: nextCursor, limit: PAGE_LIMIT });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dq]);

  return (
    <div className="page">
      <div className="topBar">
        <div className="header">
          <div className="brand">
            <h1 className="title">x-list</h1>
            <p className="subtitle">推荐推文集合，适合移动端快速阅读</p>
          </div>
          <div className="badge">
            <span>●</span> 每 2 小时可更新
          </div>
        </div>
        <div className="searchRow">
          <div className="searchBox">
            <svg className="searchIcon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M10 2a8 8 0 1 1 5.293 13.707l4 4a1 1 0 0 1-1.414 1.414l-4-4A8 8 0 0 1 10 2Zm0 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12Z"
              />
            </svg>
            <input
              className="searchInput"
              placeholder="搜索标题 / 内容 / 博主（回车也可）"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
            />
          </div>
        </div>
        <div className="stats">
          <span className="statPill">
            模式：<strong>{mode === "search" ? "搜索" : "列表"}</strong>
          </span>
          <span className="statPill">
            条目：<strong>{items.length}</strong>
          </span>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      {loading && items.length === 0 ? (
        <div className="skeletonGrid" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : null}

      <div className="list">
        {items.map((t) => (
          <TweetCard key={t.id} tweet={t} />
        ))}
      </div>

      {!loading && items.length === 0 ? (
        <div className="emptyState">暂无内容。你可以用顶部搜索试试。</div>
      ) : null}

      <div className="footer">
        {nextCursor ? (
          <button className="loadMoreBtn" disabled={loading} onClick={loadMore}>
            {loading ? "加载中…" : "加载更多"}
          </button>
        ) : (
          <button className="loadMoreBtn" disabled>
            {loading ? "加载中…" : "没有更多了"}
          </button>
        )}
      </div>
    </div>
  );
}

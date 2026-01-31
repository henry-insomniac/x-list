import { useEffect, useMemo, useRef, useState } from "react";

import { listTweets, searchTweets, type Tweet } from "./api";
import "./App.css";
import { ALL_CHANNEL, type ChannelFilter } from "./channels";
import { TweetCard } from "./components/TweetCard";
import { loadJson, loadString, saveJson, saveString } from "./storage";

const PAGE_LIMIT = 20;
const SEARCH_HISTORY_LIMIT = 6;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function App() {
  const [q, setQ] = useState(loadString("search_q", ""));
  const dq = useDebouncedValue(q, 350);
  const [channel, setChannel] = useState<ChannelFilter>(ALL_CHANNEL);
  const [olderExpanded, setOlderExpanded] = useState(
    loadString("older_expanded", "0") === "1"
  );

  const [timeMode, setTimeMode] = useState<"recent24h" | "all">(
    loadString("time_mode", "recent24h") === "all" ? "all" : "recent24h"
  );
  const [onlyPreview, setOnlyPreview] = useState(loadString("only_preview", "0") === "1");
  const [onlyUnread, setOnlyUnread] = useState(loadString("only_unread", "0") === "1");
  const [density, setDensity] = useState<"comfortable" | "compact">(
    loadString("density", "comfortable") === "compact" ? "compact" : "comfortable"
  );

  const [toast, setToast] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    loadJson<string[]>("search_history", [])
  );
  const [readSet, setReadSet] = useState<Set<string>>(
    new Set(loadJson<string[]>("read_ids", []))
  );

  const [items, setItems] = useState<Tweet[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mode = useMemo(() => (dq.trim() ? "search" : "list"), [dq]);
  const channelParam = channel === ALL_CHANNEL ? null : channel;

  const filteredItems = useMemo(() => {
    let out = items;
    if (onlyPreview) out = out.filter((t) => Boolean(t.tweetId));
    if (onlyUnread) out = out.filter((t) => !readSet.has(t.id));
    return out;
  }, [items, onlyPreview, onlyUnread, readSet]);

  const now = Date.now();
  const recentBoundaryMs = now - 24 * 60 * 60 * 1000;
  const recentItems = useMemo(() => {
    if (mode !== "list") return [];
    if (timeMode !== "recent24h") return [];
    return filteredItems.filter((t) => Date.parse(t.createdAt) >= recentBoundaryMs);
  }, [filteredItems, mode, recentBoundaryMs, timeMode]);
  const olderItems = useMemo(() => {
    if (mode !== "list") return [];
    if (timeMode !== "recent24h") return [];
    return filteredItems.filter((t) => Date.parse(t.createdAt) < recentBoundaryMs);
  }, [filteredItems, mode, recentBoundaryMs, timeMode]);
  const allListItems = useMemo(() => {
    if (mode !== "list") return [];
    if (timeMode !== "all") return [];
    return filteredItems;
  }, [filteredItems, mode, timeMode]);

  function pushSearchHistory(query: string) {
    const cleaned = query.trim();
    if (!cleaned) return;
    setSearchHistory((prev) => {
      const next = [cleaned, ...prev.filter((x) => x !== cleaned)].slice(0, SEARCH_HISTORY_LIMIT);
      saveJson("search_history", next);
      return next;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 1500);
  }

  function toggleRead(id: string) {
    setReadSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveJson("read_ids", Array.from(next));
      return next;
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制链接");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("已复制链接");
      } catch {
        showToast("复制失败");
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  async function loadFirstPage() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    setItems([]);
    setNextCursor(null);
    setOlderExpanded(false);
    try {
      const data =
        mode === "search"
          ? await searchTweets({
              q: dq.trim(),
              limit: PAGE_LIMIT,
              channel: channelParam,
              signal: controller.signal
            })
          : await listTweets({ limit: PAGE_LIMIT, channel: channelParam, signal: controller.signal });
      setItems(data.items);
      setNextCursor(data.nextCursor);
      if (mode === "search") pushSearchHistory(dq.trim());
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
      if (mode === "list" && timeMode === "recent24h" && !olderExpanded) {
        setOlderExpanded(true);
      }
      const data =
        mode === "search"
          ? await searchTweets({
              q: dq.trim(),
              cursor: nextCursor,
              limit: PAGE_LIMIT,
              channel: channelParam
            })
          : await listTweets({ cursor: nextCursor, limit: PAGE_LIMIT, channel: channelParam });
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
  }, [mode, dq, channel]);

  useEffect(() => saveString("search_q", q), [q]);
  useEffect(() => saveString("density", density), [density]);
  useEffect(() => saveString("only_preview", onlyPreview ? "1" : "0"), [onlyPreview]);
  useEffect(() => saveString("only_unread", onlyUnread ? "1" : "0"), [onlyUnread]);
  useEffect(() => saveString("time_mode", timeMode), [timeMode]);
  useEffect(() => saveString("older_expanded", olderExpanded ? "1" : "0"), [olderExpanded]);

  useEffect(() => {
    const onBeforeUnload = () => saveString("scroll_y", String(window.scrollY || 0));
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (mode !== "list") return;
    const y = Number(loadString("scroll_y", "0"));
    if (Number.isFinite(y) && y > 0) {
      window.setTimeout(() => window.scrollTo(0, y), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loadMoreLabel = useMemo(() => {
    if (!nextCursor) return loading ? "加载中…" : "没有更多了";
    if (mode === "search") return loading ? "加载中…" : "加载更多结果";
    if (timeMode === "recent24h" && !olderExpanded) return loading ? "加载中…" : "加载更多（将自动展开更早）";
    if (timeMode === "recent24h" && olderExpanded) return loading ? "加载中…" : "加载更多（更早）";
    return loading ? "加载中…" : "加载更多";
  }, [loading, mode, nextCursor, olderExpanded, timeMode]);

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
          <select
            className="channelSelect"
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
            aria-label="渠道筛选"
          >
            <option value="all">全部</option>
            <option value="x">X</option>
            <option value="xhs">小红书</option>
          </select>

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
              onKeyDown={(e) => {
                if (e.key === "Enter") pushSearchHistory(q);
              }}
              inputMode="search"
            />
            {q ? (
              <button className="clearBtn" onClick={() => setQ("")} aria-label="清空搜索">
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className="stats">
          <span className="statPill">
            模式：<strong>{mode === "search" ? "搜索" : "列表"}</strong>
          </span>
          <span className="statPill">
            展示：<strong>{filteredItems.length}</strong>
          </span>
          <span className="statPill">
            渠道：<strong>{channel === "all" ? "全部" : channel}</strong>
          </span>
          <span className="statPill">
            密度：<strong>{density === "compact" ? "紧凑" : "舒适"}</strong>
          </span>
        </div>

        <div className="chipsRow" aria-label="快捷筛选">
          <div
            className={`chip ${timeMode === "recent24h" ? "chipActive" : ""}`}
            onClick={() => {
              setTimeMode((v) => (v === "recent24h" ? "all" : "recent24h"));
              setOlderExpanded(false);
            }}
          >
            <strong>{timeMode === "recent24h" ? "最近24h" : "全部时间"}</strong>
          </div>
          <div className={`chip ${onlyPreview ? "chipActive" : ""}`} onClick={() => setOnlyPreview((v) => !v)}>
            <strong>仅预览</strong>
          </div>
          <div className={`chip ${onlyUnread ? "chipActive" : ""}`} onClick={() => setOnlyUnread((v) => !v)}>
            <strong>未读</strong>
          </div>
          <div
            className={`chip ${density === "compact" ? "chipActive" : ""}`}
            onClick={() => setDensity((v) => (v === "compact" ? "comfortable" : "compact"))}
          >
            <strong>{density === "compact" ? "紧凑" : "舒适"}</strong>
          </div>
          <div
            className="chip"
            onClick={() => {
              setReadSet(new Set());
              saveJson("read_ids", []);
              showToast("已清空已读");
            }}
          >
            <strong>清空已读</strong>
          </div>
        </div>

        {searchHistory.length && !q ? (
          <div className="historyRow">
            <span className="historyHint">最近搜索：</span>
            {searchHistory.map((h) => (
              <div key={h} className="chip" onClick={() => setQ(h)} title="点击填入搜索">
                <strong>{h}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      {loading && items.length === 0 ? (
        <div className="skeletonGrid" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : null}

      {mode === "list" ? (
        <>
          {timeMode === "recent24h" ? (
            <>
              <div className="sectionHeader">
                <h2 className="sectionTitle">最近 24 小时（{recentItems.length}）</h2>
              </div>
              <div className="list">
                {recentItems.map((t) => (
                  <TweetCard
                    key={t.id}
                    tweet={t}
                    density={density}
                    isRead={readSet.has(t.id)}
                    onToggleRead={() => toggleRead(t.id)}
                    onCopyLink={() => copyToClipboard(t.url)}
                    onOpen={() => toggleRead(t.id)}
                  />
                ))}
              </div>

              <div className="sectionHeader" id="older">
                <h2 className="sectionTitle">更早（{olderItems.length}）</h2>
                <button className="sectionBtn" onClick={() => setOlderExpanded((v) => !v)}>
                  {olderExpanded ? "收起" : "展开"}
                </button>
              </div>
              {olderExpanded ? (
                <div className="list">
                  {olderItems.map((t) => (
                    <TweetCard
                      key={t.id}
                      tweet={t}
                      density={density}
                      isRead={readSet.has(t.id)}
                      onToggleRead={() => toggleRead(t.id)}
                      onCopyLink={() => copyToClipboard(t.url)}
                      onOpen={() => toggleRead(t.id)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="sectionHeader">
                <h2 className="sectionTitle">全部（{allListItems.length}）</h2>
              </div>
              <div className="list">
                {allListItems.map((t) => (
                  <TweetCard
                    key={t.id}
                    tweet={t}
                    density={density}
                    isRead={readSet.has(t.id)}
                    onToggleRead={() => toggleRead(t.id)}
                    onCopyLink={() => copyToClipboard(t.url)}
                    onOpen={() => toggleRead(t.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="list">
          {filteredItems.map((t) => (
            <TweetCard
              key={t.id}
              tweet={t}
              density={density}
              isRead={readSet.has(t.id)}
              onToggleRead={() => toggleRead(t.id)}
              onCopyLink={() => copyToClipboard(t.url)}
              onOpen={() => toggleRead(t.id)}
            />
          ))}
        </div>
      )}

      {!loading && filteredItems.length === 0 ? (
        <div className="emptyState">暂无内容。你可以用顶部搜索试试。</div>
      ) : null}

      <div className="footer">
        <button className="loadMoreBtn" disabled={!nextCursor || loading} onClick={loadMore}>
          {loadMoreLabel}
        </button>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

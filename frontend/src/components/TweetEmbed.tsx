import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./TweetEmbed.module.css";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void;
      };
    };
  }
}

let twitterScriptPromise: Promise<void> | null = null;

function ensureTwitterWidgets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.twttr?.widgets) return Promise.resolve();

  if (twitterScriptPromise) return twitterScriptPromise;

  twitterScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-x-list="twitter-widgets"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Twitter widgets 加载失败")), {
        once: true
      });
      return;
    }

    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.defer = true;
    s.dataset.xList = "twitter-widgets";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Twitter widgets 加载失败"));
    document.head.appendChild(s);
  });

  return twitterScriptPromise;
}

export function TweetEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  const normalizedUrl = useMemo(() => url.replace("twitter.com", "x.com"), [url]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    ensureTwitterWidgets()
      .then(() => {
        if (cancelled) return;
        const el = containerRef.current;
        if (!el) return;
        window.twttr?.widgets?.load(el);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      });

    // fallback: if iframe didn't appear, treat as failed (CSP/adblock/etc.)
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      const hasIframe = el.querySelector("iframe");
      if (!hasIframe) setFailed(true);
    }, 3500);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [normalizedUrl]);

  if (failed) {
    return (
      <div className={styles.fallback}>
        预览加载失败（可能被广告拦截/CSP 限制）。{" "}
        <a href={url} target="_blank" rel="noreferrer">
          点击打开
        </a>
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      <blockquote className="twitter-tweet" data-dnt="true" data-theme="dark">
        <a href={normalizedUrl} />
      </blockquote>
    </div>
  );
}


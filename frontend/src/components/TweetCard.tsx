import { useMemo, useState } from "react";

import type { Tweet } from "../api";

import { TweetEmbed } from "./TweetEmbed";
import styles from "./TweetCard.module.css";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function TweetCard({ tweet }: { tweet: Tweet }) {
  const [expanded, setExpanded] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  const createdText = useMemo(() => formatTime(tweet.createdAt), [tweet.createdAt]);

  const showToggle = tweet.content.length > 220;
  const canEmbed = Boolean(tweet.tweetId);

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.metaLeft}>
          <div className={styles.authorLine}>
            <span className={styles.avatar} aria-hidden="true" />
            <div className={styles.authorBlock}>
              <div className={styles.author}>{tweet.author ?? "未知博主"}</div>
              <time className={styles.time} dateTime={tweet.createdAt}>
                {createdText}
              </time>
            </div>
          </div>
          {tweet.title ? <div className={styles.title}>{tweet.title}</div> : null}
        </div>
        <div className={styles.actions}>
          <a className={styles.openLink} href={tweet.url} target="_blank" rel="noreferrer">
            打开原推
          </a>
        </div>
      </header>

      <div className={expanded ? styles.contentExpanded : styles.content}>{tweet.content}</div>

      <div className={styles.bottomRow}>
        {showToggle ? (
          <button className={styles.secondaryBtn} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起内容" : "展开内容"}
          </button>
        ) : (
          <span />
        )}

        {canEmbed ? (
          <button className={styles.primaryBtn} onClick={() => setShowEmbed((v) => !v)}>
            {showEmbed ? "隐藏预览" : "查看预览"}
          </button>
        ) : null}
      </div>

      {canEmbed && showEmbed ? <TweetEmbed url={tweet.url} /> : null}
    </article>
  );
}


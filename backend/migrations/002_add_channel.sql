ALTER TABLE tweets
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'x';

-- 更适合按渠道 + 时间倒序分页
CREATE INDEX IF NOT EXISTS tweets_channel_created_at_id_idx
  ON tweets (channel, created_at DESC, id DESC);


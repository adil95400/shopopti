-- Cdiscount/Octopia write idempotency guard.
-- Reuses public.publication_logs as the durable operation ledger.
CREATE UNIQUE INDEX IF NOT EXISTS idx_publication_logs_cdiscount_idempotency
  ON public.publication_logs (user_id, channel_id, action, idempotency_key)
  WHERE channel_id = 'cdiscount' AND idempotency_key IS NOT NULL;

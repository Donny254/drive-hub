-- ============================================================
-- M-PESA HARDENING
-- Additive changes; existing payment records are preserved.
-- ============================================================

ALTER TABLE mpesa_transactions
  ADD COLUMN IF NOT EXISTS dispatch_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_error text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE mpesa_callback_inbox
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

-- Callback retry/recovery indexes
CREATE INDEX IF NOT EXISTS idx_mpesa_inbox_retry
  ON mpesa_callback_inbox(
    processing_status,
    next_retry_at,
    received_at
  );

-- Pending payment lookup
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_pending
  ON mpesa_transactions(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request
  ON mpesa_transactions(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mpesa_merchant_request
  ON mpesa_transactions(merchant_request_id)
  WHERE merchant_request_id IS NOT NULL;

-- Checkout idempotency records
CREATE TABLE IF NOT EXISTS mpesa_checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  transaction_id uuid REFERENCES mpesa_transactions(id) ON DELETE SET NULL,
  response_snapshot jsonb,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_attempts_status
  ON mpesa_checkout_attempts(status, updated_at);

-- Durable STK dispatch tracking.
-- Does not authorize blind retry of ambiguous STK dispatches.
CREATE TABLE IF NOT EXISTS mpesa_dispatch_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES mpesa_transactions(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'retry', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_mpesa_dispatch_outbox_due
  ON mpesa_dispatch_outbox(status, next_retry_at);

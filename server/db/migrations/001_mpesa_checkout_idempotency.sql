CREATE TABLE IF NOT EXISTS mpesa_checkout_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES mpesa_transactions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_idempotency_created
  ON mpesa_checkout_idempotency(created_at DESC);

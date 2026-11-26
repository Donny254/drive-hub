ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_status text
  NOT NULL DEFAULT 'pending';

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (
    fulfillment_status IN (
      'pending',
      'fulfilled',
      'stock_issue',
      'refund_required'
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status
  ON orders(fulfillment_status, created_at DESC);

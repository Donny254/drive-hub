-- Prevent a Daraja CheckoutRequestID from being attached to
-- more than one payment transaction.
--
-- Run the duplicate audit before deploying this migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM mpesa_transactions
    WHERE checkout_request_id IS NOT NULL
    GROUP BY checkout_request_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate CheckoutRequestIDs exist. Resolve them before applying this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_checkout_request_id
ON mpesa_transactions (checkout_request_id)
WHERE checkout_request_id IS NOT NULL;


-- Immutable, encrypted snapshot of the Daraja configuration used for a
-- payment attempt.
CREATE TABLE IF NOT EXISTS mpesa_credential_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL
    CHECK (environment IN ('sandbox', 'production')),
  transaction_type text NOT NULL
    CHECK (transaction_type IN (
      'CustomerPayBillOnline',
      'CustomerBuyGoodsOnline'
    )),
  base_url text NOT NULL
    CHECK (base_url IN (
      'https://sandbox.safaricom.co.ke',
      'https://api.safaricom.co.ke'
    )),
  shortcode text NOT NULL,
  party_b text,
  account_reference text,
  transaction_desc text,
  consumer_key_enc text NOT NULL,
  consumer_secret_enc text NOT NULL,
  passkey_enc text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mpesa_transactions
  ADD COLUMN IF NOT EXISTS credential_profile_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mpesa_transactions_credential_profile_fk'
  ) THEN
    ALTER TABLE mpesa_transactions
      ADD CONSTRAINT mpesa_transactions_credential_profile_fk
      FOREIGN KEY (credential_profile_id)
      REFERENCES mpesa_credential_profiles(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_credential_profile
  ON mpesa_transactions (credential_profile_id)
  WHERE credential_profile_id IS NOT NULL;

-- Profiles are append-only. New settings create new profiles rather than
-- changing credentials associated with existing payment attempts.
CREATE OR REPLACE FUNCTION prevent_mpesa_credential_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'M-Pesa credential profiles are immutable';
END;
$$;

DROP TRIGGER IF EXISTS mpesa_credential_profiles_immutable
  ON mpesa_credential_profiles;

CREATE TRIGGER mpesa_credential_profiles_immutable
  BEFORE UPDATE OR DELETE ON mpesa_credential_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_mpesa_credential_profile_mutation();

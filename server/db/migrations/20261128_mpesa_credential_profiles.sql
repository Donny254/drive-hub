
-- Preserve the exact Daraja credentials/configuration used by each STK payment.
-- Secret values are encrypted by the application before insertion.

CREATE TABLE IF NOT EXISTS mpesa_credential_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  environment text NOT NULL
    CHECK (environment IN ('sandbox', 'production')),

  transaction_type text NOT NULL
    CHECK (transaction_type IN (
      'CustomerPayBillOnline',
      'CustomerBuyGoodsOnline'
    )),

  base_url text NOT NULL,
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

ALTER TABLE mpesa_transactions
  ADD CONSTRAINT mpesa_transactions_credential_profile_fk
  FOREIGN KEY (credential_profile_id)
  REFERENCES mpesa_credential_profiles(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_credential_profile
  ON mpesa_transactions(credential_profile_id)
  WHERE credential_profile_id IS NOT NULL;

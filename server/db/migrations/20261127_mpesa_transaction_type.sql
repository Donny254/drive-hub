ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS mpesa_sandbox_transaction_type text
    NOT NULL DEFAULT 'CustomerPayBillOnline',
  ADD COLUMN IF NOT EXISTS mpesa_production_transaction_type text
    NOT NULL DEFAULT 'CustomerPayBillOnline';

ALTER TABLE mpesa_transactions
  ADD COLUMN IF NOT EXISTS transaction_type text
    NOT NULL DEFAULT 'CustomerPayBillOnline';

ALTER TABLE site_settings
  DROP CONSTRAINT IF EXISTS site_settings_mpesa_sandbox_transaction_type_check,
  DROP CONSTRAINT IF EXISTS site_settings_mpesa_production_transaction_type_check;

ALTER TABLE site_settings
  ADD CONSTRAINT site_settings_mpesa_sandbox_transaction_type_check
  CHECK (mpesa_sandbox_transaction_type IN (
    'CustomerPayBillOnline',
    'CustomerBuyGoodsOnline'
  )),
  ADD CONSTRAINT site_settings_mpesa_production_transaction_type_check
  CHECK (mpesa_production_transaction_type IN (
    'CustomerPayBillOnline',
    'CustomerBuyGoodsOnline'
  ));

ALTER TABLE mpesa_transactions
  DROP CONSTRAINT IF EXISTS mpesa_transactions_transaction_type_check;

ALTER TABLE mpesa_transactions
  ADD CONSTRAINT mpesa_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'CustomerPayBillOnline',
    'CustomerBuyGoodsOnline'
  ));

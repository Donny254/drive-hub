CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  phone text,
  role text NOT NULL DEFAULT 'user',
  seller_verification_status text NOT NULL DEFAULT 'unverified' CHECK (seller_verification_status IN ('unverified', 'pending', 'verified')),
  seller_verified_at timestamptz,
  password_hash text,
  password_reset_token_hash text,
  password_reset_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  company_name text,
  support_email text,
  support_phone text,
  address text,
  social_facebook text,
  social_instagram text,
  social_twitter text,
  social_youtube text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  bank_swift text,
  bank_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  price_cents integer NOT NULL,
  year integer,
  mileage integer,
  fuel text,
  power_hp integer,
  image_url text,
  listing_type text NOT NULL CHECK (listing_type IN ('buy', 'rent', 'sell')),
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'sold', 'inactive', 'rejected')),
  description text,
  location text,
  moderation_notes text,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_score integer NOT NULL DEFAULT 0,
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  viewer_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_user_id ON listing_views(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_audit_logs_listing_id ON listing_audit_logs(listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS digest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_kind text NOT NULL,
  run_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (digest_kind, run_date)
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  features text[] DEFAULT '{}',
  price_cents integer,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  start_date date,
  end_date date,
  image_url text,
  price_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'past', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  category text,
  image_url text,
  sizes text[] DEFAULT '{}',
  stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  content text,
  image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  amount_cents integer,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  total_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid,
  name text NOT NULL,
  price_cents integer NOT NULL,
  quantity integer NOT NULL,
  size text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  contact_name text,
  contact_phone text,
  scheduled_date date,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  contact_name text,
  contact_phone text,
  tickets integer NOT NULL DEFAULT 1,
  amount_cents integer NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  paid_at timestamptz,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'checked_in', 'cancelled')),
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tickets_event_id ON event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_user_id ON event_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_registration_id ON event_tickets(registration_id);

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  inquiry_type text NOT NULL DEFAULT 'general' CHECK (inquiry_type IN ('general', 'listing', 'quote', 'service')),
  name text,
  email text,
  phone text,
  message text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled'));

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  event_registration_id uuid REFERENCES event_registrations(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  amount_cents integer NOT NULL,
  checkout_request_id text,
  merchant_request_id text,
  status text NOT NULL DEFAULT 'pending',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS amount_cents integer;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0;

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0;

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed'));

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE mpesa_transactions
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;

ALTER TABLE mpesa_transactions
  ADD COLUMN IF NOT EXISTS event_registration_id uuid REFERENCES event_registrations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_set_updated_at ON listings;
CREATE TRIGGER listings_set_updated_at
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS services_set_updated_at ON services;
CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON services
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS events_set_updated_at ON events;
CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS posts_set_updated_at ON posts;
CREATE TRIGGER posts_set_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS mpesa_transactions_set_updated_at ON mpesa_transactions;
CREATE TRIGGER mpesa_transactions_set_updated_at
BEFORE UPDATE ON mpesa_transactions
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token_hash text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS seller_verification_status text NOT NULL DEFAULT 'unverified' CHECK (seller_verification_status IN ('unverified', 'pending', 'verified'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS seller_verified_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS moderation_notes text;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE listings
  ADD CONSTRAINT listings_status_check CHECK (status IN ('pending_approval', 'active', 'sold', 'inactive', 'rejected'));

INSERT INTO site_settings (
  id,
  company_name,
  support_email,
  support_phone,
  address,
  bank_name,
  bank_account_name,
  bank_account_number,
  bank_branch,
  bank_swift,
  bank_instructions
)
VALUES (
  true,
  'WheelsnationKe',
  'info@wheelsnationke.co.ke',
  '+254700123456',
  'Westlands, Nairobi, Kenya',
  'Your Bank',
  'WheelsnationKe Limited',
  '1234567890',
  'Main Branch',
  'ABCDEXYZ',
  'Use the listing title as reference and share the transfer receipt.'
)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON site_settings;
CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

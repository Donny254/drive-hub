CREATE TABLE IF NOT EXISTS event_ticket_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL
    REFERENCES event_registrations(id) ON DELETE CASCADE,
  channel text NOT NULL
    CHECK (channel IN ('email', 'sms', 'whatsapp')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'processing',
        'retry',
        'sent',
        'failed',
        'skipped'
      )
    ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_outbox_due
  ON event_ticket_notification_outbox (next_retry_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_event_ticket_outbox_stale
  ON event_ticket_notification_outbox (locked_at)
  WHERE status = 'processing';

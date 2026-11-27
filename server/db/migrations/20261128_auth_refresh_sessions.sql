CREATE TABLE IF NOT EXISTS auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at timestamptz
);

ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active
ON auth_sessions(user_id, expires_at)
WHERE revoked_at IS NULL;

-- =====================================================================
-- V2__refresh_tokens.sql — server-side refresh tokens for HttpOnly cookie auth.
--
-- The access token is a short-lived stateless JWT held in an HttpOnly cookie.
-- The refresh token is NOT a JWT: it is an opaque random string, stored here
-- so that logout can actually revoke a session server-side. A stateless JWT
-- cannot be revoked before it expires, so a pure-JWT design would make
-- "sign out" a client-side illusion.
--
-- Only the SHA-256 hash of the token is stored. The raw value exists exactly
-- once, in the Set-Cookie header of the response that issued it. A dump of
-- this table therefore does not hand an attacker usable sessions.
--
-- The UNIQUE index on token_hash makes lookup O(1) and turns a hash collision
-- into a constraint violation rather than a wrong-user match.
-- =====================================================================

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ,
    -- created_at/updated_at mirror the other tables: RefreshToken extends
    -- BaseEntity, and ddl-auto=validate fails the context if they are absent.
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_refresh_tokens_hash CHECK (char_length(token_hash) = 64)
);

-- Serves "is this refresh token still live for this user?" on every refresh.
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Housekeeping: expired rows can be deleted without scanning the table.
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);
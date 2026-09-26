-- =====================================================================
-- V1__init.sql — Task Board initial schema (PostgreSQL 13+)
-- gen_random_uuid() is built-in since PG13; for PG12 or older run:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- UUIDs are generated application-side (Hibernate @UuidGenerator);
-- the DB defaults are a safety net for manual inserts.
-- =====================================================================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255)  NOT NULL UNIQUE,
    display_name  VARCHAR(100)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE boards (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(120) NOT NULL,
    owner_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_boards_owner ON boards (owner_id);

-- Join entity: many-to-many between users and boards, with a role per membership.
CREATE TABLE board_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id   UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'MEMBER',   -- OWNER | ADMIN | MEMBER
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_board_member UNIQUE (board_id, user_id),
    CONSTRAINT ck_board_member_role CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'))
);

CREATE INDEX idx_board_members_user ON board_members (user_id);

-- Ordered columns/lists of a board. "list" is a reserved word in SQL,
-- hence the table name board_lists.
-- Position uses fractional (gap-free-ish) ordering: a card/list moved
-- between A and B gets position = (A.position + B.position) / 2.0,
-- avoiding O(n) re-indexing of siblings on every drag.
CREATE TABLE board_lists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id   UUID           NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name       VARCHAR(120)   NOT NULL,
    position   DOUBLE PRECISION NOT NULL,
    version    BIGINT         NOT NULL DEFAULT 0,       -- optimistic lock
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_lists_board_position ON board_lists (board_id, position);

CREATE TABLE cards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id     UUID           NOT NULL REFERENCES board_lists(id) ON DELETE CASCADE,
    title       VARCHAR(200)   NOT NULL,
    description TEXT,
    priority    VARCHAR(20)    NOT NULL DEFAULT 'MEDIUM', -- LOW | MEDIUM | HIGH | URGENT
    position    DOUBLE PRECISION NOT NULL,
    version     BIGINT         NOT NULL DEFAULT 0,        -- optimistic lock
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT ck_cards_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'))
);

CREATE INDEX idx_cards_list_position ON cards (list_id, position);

-- Append-mostly audit trail; paginated per board by created_at DESC.
CREATE TABLE activity_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id   UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    actor_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id    UUID        REFERENCES cards(id) ON DELETE SET NULL,
    type       VARCHAR(30) NOT NULL,   -- see ActivityType enum
    message    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_board_created ON activity_logs (board_id, created_at DESC);

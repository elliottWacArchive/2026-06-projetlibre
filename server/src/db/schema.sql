CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 5,
    z REAL NOT NULL DEFAULT 0,
    color INTEGER,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions (expires_at);

INSERT INTO rooms (slug, name)
VALUES ('lobby', 'Lobby')
ON CONFLICT (slug) DO NOTHING;


-- SERVEURS / ROOMS

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS owner_id INTEGER
REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 20;

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'public';

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS invite_code_hash TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rooms_capacity_positive'
    ) THEN
        ALTER TABLE rooms
        ADD CONSTRAINT rooms_capacity_positive
        CHECK (capacity > 0);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rooms_visibility_valid'
    ) THEN
        ALTER TABLE rooms
        ADD CONSTRAINT rooms_visibility_valid
        CHECK (visibility IN ('public', 'private'));
    END IF;
END
$$;


-- Membres persistants d'un serveur.
CREATE TABLE IF NOT EXISTS room_members (
    room_id INTEGER NOT NULL
        REFERENCES rooms(id) ON DELETE CASCADE,

    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user
ON room_members (user_id);

CREATE INDEX IF NOT EXISTS idx_room_members_room
ON room_members (room_id);


-- Connexions actuellement présentes dans une room.
-- Cette table permet de gérer aussi les invités qui n'ont
-- pas de compte utilisateur.
CREATE TABLE IF NOT EXISTS room_connections (
    room_id INTEGER NOT NULL
        REFERENCES rooms(id) ON DELETE CASCADE,

    socket_id VARCHAR(128) PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,

    connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_connections_room
ON room_connections (room_id);

CREATE INDEX IF NOT EXISTS idx_room_connections_user
ON room_connections (user_id);
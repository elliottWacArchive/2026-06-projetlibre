CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
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
    user_id INTEGER PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    room_id INTEGER
        REFERENCES rooms(id) ON DELETE SET NULL,

    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 5,
    z REAL NOT NULL DEFAULT 0,
    color INTEGER,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions (expires_at);


-- Gestion des serveurs

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS owner_id INTEGER
REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 20;

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'public';

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS invite_code_hash TEXT;

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;


-- Le lobby est créé automatiquement au démarrage
INSERT INTO rooms (slug, name)
VALUES ('lobby', 'Lobby')
ON CONFLICT (slug) DO NOTHING;

UPDATE rooms
SET is_system = true
WHERE slug = 'lobby';


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


-- Liste des membres d'un serveur
CREATE TABLE IF NOT EXISTS room_members (
    room_id INTEGER NOT NULL
        REFERENCES rooms(id) ON DELETE CASCADE,

    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user
ON room_members(user_id);

CREATE INDEX IF NOT EXISTS idx_room_members_room
ON room_members(room_id);


-- Garde les joueurs actuellement connectés
CREATE TABLE IF NOT EXISTS room_connections (
    room_id INTEGER NOT NULL
        REFERENCES rooms(id) ON DELETE CASCADE,

    socket_id VARCHAR(128) PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,

    connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_connections_room
ON room_connections(room_id);

CREATE INDEX IF NOT EXISTS idx_room_connections_user
ON room_connections(user_id);

-- Serveur principal de l'application
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    visibility VARCHAR(10) NOT NULL DEFAULT 'public',
    invite_code_hash TEXT,
    capacity INTEGER NOT NULL DEFAULT 20,
    owner_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT servers_capacity_positive
        CHECK (capacity > 0),

    CONSTRAINT servers_visibility_valid
        CHECK (visibility IN ('public', 'private'))
);

-- Pour l'instant, un seul serveur actif à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_server
ON servers (is_active)
WHERE is_active = true;


-- Membres du serveur
CREATE TABLE IF NOT EXISTS server_members (
    server_id INTEGER NOT NULL
        REFERENCES servers(id) ON DELETE CASCADE,

    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    role VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (server_id, user_id),

    CONSTRAINT server_members_role_valid
        CHECK (role IN ('owner', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_server_members_user
ON server_members(user_id);

CREATE INDEX IF NOT EXISTS idx_server_members_server
ON server_members(server_id);

-- Bureaux
CREATE TABLE IF NOT EXISTS desks (
    id SERIAL PRIMARY KEY,

    server_id INTEGER NOT NULL
        REFERENCES rooms(id) ON DELETE CASCADE,

    owner_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desks_server
ON desks(server_id);

CREATE INDEX IF NOT EXISTS idx_desks_owner
ON desks(owner_id);


-- Fichiers déposés sur les bureaux
CREATE TABLE IF NOT EXISTS desk_files (
    id SERIAL PRIMARY KEY,

    desk_id INTEGER NOT NULL
        REFERENCES desks(id) ON DELETE CASCADE,

    uploader_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    original_name VARCHAR(255) NOT NULL,

    stored_name VARCHAR(255) NOT NULL UNIQUE,

    size BIGINT NOT NULL,

    mime_type VARCHAR(255) NOT NULL,

    is_hidden BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT desk_files_size_positive
        CHECK (size > 0),

    CONSTRAINT desk_files_original_name_not_empty
        CHECK (length(btrim(original_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_desk_files_desk
ON desk_files(desk_id);

CREATE INDEX IF NOT EXISTS idx_desk_files_uploader
ON desk_files(uploader_id);

-- Post-its sur les bureaux
CREATE TABLE IF NOT EXISTS desk_notes (
    id SERIAL PRIMARY KEY,

    desk_id INTEGER NOT NULL
        REFERENCES desks(id) ON DELETE CASCADE,

    author_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    content VARCHAR(500) NOT NULL,

    color VARCHAR(20) NOT NULL DEFAULT 'yellow',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT desk_notes_content_not_empty
        CHECK (length(btrim(content)) > 0),

    CONSTRAINT desk_notes_color_valid
        CHECK (color IN ('yellow', 'pink', 'blue', 'green'))
);

CREATE INDEX IF NOT EXISTS idx_desk_notes_desk
ON desk_notes(desk_id);

CREATE INDEX IF NOT EXISTS idx_desk_notes_author
ON desk_notes(author_id);
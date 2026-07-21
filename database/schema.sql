CREATE TABLE IF NOT EXISTS customers (
    id                SERIAL PRIMARY KEY,
    customer_name     VARCHAR(120) NOT NULL,
    email_address     VARCHAR(255) NOT NULL UNIQUE,
    phone_number      VARCHAR(30),
    newsletter_signup BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
    id            SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    time_slot     TIMESTAMP NOT NULL,
    table_number  INTEGER NOT NULL CHECK (table_number BETWEEN 1 AND 30),
    guest_count   INTEGER NOT NULL DEFAULT 1 CHECK (guest_count BETWEEN 1 AND 30),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied')),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_time_slot_table_number UNIQUE (time_slot, table_number)
);

CREATE TABLE IF NOT EXISTS menu_items (
    id            SERIAL PRIMARY KEY,
    category      VARCHAR(80) NOT NULL,
    item_name     VARCHAR(120) NOT NULL UNIQUE,
    description   TEXT NOT NULL,
    price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url     VARCHAR(500),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

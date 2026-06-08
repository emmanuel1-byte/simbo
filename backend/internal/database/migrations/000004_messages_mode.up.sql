ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS input_mode TEXT NOT NULL DEFAULT 'text'
        CHECK (input_mode IN ('text', 'voice'));

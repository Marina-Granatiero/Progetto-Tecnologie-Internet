USE concerto_db; ALTER TABLE utenti ADD COLUMN IF NOT EXISTS ruolo ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente'; UPDATE utenti SET ruolo = 'admin' WHERE email = 'admin@concerto.it';

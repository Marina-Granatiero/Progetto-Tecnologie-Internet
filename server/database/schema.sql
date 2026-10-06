-- Database: concerto_db
CREATE DATABASE IF NOT EXISTS concerto_db;
USE concerto_db;

-- 1. Struttura tabella settori
CREATE TABLE IF NOT EXISTS settori (
  id_settore int(11) NOT NULL AUTO_INCREMENT,
  nome_settore varchar(50) NOT NULL,
  prezzo decimal(10,2) NOT NULL,
  capacita_max int(11) NOT NULL,
  PRIMARY KEY (id_settore)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Struttura tabella utenti
CREATE TABLE IF NOT EXISTS utenti (
  id_utente int(11) NOT NULL AUTO_INCREMENT,
  nome varchar(50) NOT NULL,
  cognome varchar(50) NOT NULL,
  email varchar(100) NOT NULL,
  password varchar(255) NOT NULL,
  data_iscrizione timestamp NOT NULL DEFAULT current_timestamp(),
  codice_accesso varchar(20) DEFAULT NULL,
  abilitato tinyint(1) DEFAULT 0,
  ruolo enum('cliente','admin') NOT NULL DEFAULT 'cliente',
  PRIMARY KEY (id_utente),
  UNIQUE KEY email (email),
  UNIQUE KEY codice_accesso (codice_accesso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Struttura tabella ordini
CREATE TABLE IF NOT EXISTS ordini (
  id_ordine int(11) NOT NULL AUTO_INCREMENT,
  fk_utente int(11) DEFAULT NULL,
  data_ora datetime DEFAULT current_timestamp(),
  totale decimal(10,2) NOT NULL,
  PRIMARY KEY (id_ordine),
  KEY fk_utente (fk_utente),
  CONSTRAINT ordini_ibfk_1 FOREIGN KEY (fk_utente) REFERENCES utenti (id_utente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Struttura tabella biglietti
CREATE TABLE IF NOT EXISTS biglietti (
  id_biglietto int(11) NOT NULL AUTO_INCREMENT,
  fk_settore int(11) DEFAULT NULL,
  venduto tinyint(1) DEFAULT 0,
  PRIMARY KEY (id_biglietto),
  KEY fk_settore (fk_settore),
  CONSTRAINT biglietti_ibfk_1 FOREIGN KEY (fk_settore) REFERENCES settori (id_settore) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Struttura tabella dettaglio_ordini
CREATE TABLE IF NOT EXISTS dettaglio_ordini (
  fk_ordine int(11) NOT NULL,
  fk_biglietto int(11) NOT NULL,
  PRIMARY KEY (fk_ordine, fk_biglietto),
  UNIQUE KEY fk_biglietto (fk_biglietto),
  CONSTRAINT dettaglio_ordini_ibfk_1 FOREIGN KEY (fk_ordine) REFERENCES ordini (id_ordine),
  CONSTRAINT dettaglio_ordini_ibfk_2 FOREIGN KEY (fk_biglietto) REFERENCES biglietti (id_biglietto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dati iniziali settori
INSERT INTO settori (id_settore, nome_settore, prezzo, capacita_max) VALUES
(1, 'Pit Gold', 120.00, 50),
(2, 'Tribuna Numerata', 85.00, 100),
(3, 'Prato', 55.00, 200)
ON DUPLICATE KEY UPDATE id_settore=id_settore;

-- Utente Admin di test
INSERT INTO utenti (nome, cognome, email, password, codice_accesso, abilitato, ruolo) 
VALUES ('Admin', 'Concerto', 'admin@concerto.it', 'admin123', NULL, 0, 'admin')
ON DUPLICATE KEY UPDATE email=email;
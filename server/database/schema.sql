-- ============================================================================
-- Database: concerto_db  (MySQL 5.7+/8 oppure MariaDB 10.2+, es. XAMPP)
-- Piattaforma di vendita biglietti per un concerto ad alta richiesta.
--
-- Schema in Terza Forma Normale:
--   settori (1) ---< biglietti (1) ---(0..1) dettaglio_ordini >---(1) ordini >---(1) utenti
--
-- Lo script è idempotente: può essere rieseguito senza perdere dati.
-- Per un'installazione pulita:   npm run db:reset   (dentro la cartella server)
-- ============================================================================
CREATE DATABASE IF NOT EXISTS concerto_db;
USE concerto_db;

-- 1. Settori della venue
CREATE TABLE IF NOT EXISTS settori (
  id_settore int(11) NOT NULL AUTO_INCREMENT,
  nome_settore varchar(50) NOT NULL,
  prezzo decimal(10,2) NOT NULL,
  capacita_max int(11) NOT NULL,
  PRIMARY KEY (id_settore)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Utenti (clienti e amministratori)
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

-- 3. Ordini
CREATE TABLE IF NOT EXISTS ordini (
  id_ordine int(11) NOT NULL AUTO_INCREMENT,
  fk_utente int(11) DEFAULT NULL,
  data_ora datetime DEFAULT current_timestamp(),
  totale decimal(10,2) NOT NULL,
  PRIMARY KEY (id_ordine),
  KEY fk_utente (fk_utente),
  CONSTRAINT ordini_ibfk_1 FOREIGN KEY (fk_utente) REFERENCES utenti (id_utente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Biglietti: una riga per ogni singolo posto vendibile.
--    L'indice (fk_settore, venduto) rende veloci sia il conteggio delle
--    disponibilità sia il SELECT ... FOR UPDATE della transazione d'acquisto.
CREATE TABLE IF NOT EXISTS biglietti (
  id_biglietto int(11) NOT NULL AUTO_INCREMENT,
  fk_settore int(11) DEFAULT NULL,
  venduto tinyint(1) DEFAULT 0,
  PRIMARY KEY (id_biglietto),
  KEY idx_settore_venduto (fk_settore, venduto),
  CONSTRAINT biglietti_ibfk_1 FOREIGN KEY (fk_settore) REFERENCES settori (id_settore) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Dettaglio ordini: associa ogni biglietto venduto al suo ordine.
--    UNIQUE(fk_biglietto) impedisce a livello di database che lo stesso
--    biglietto finisca in due ordini (difesa contro l'overbooking).
CREATE TABLE IF NOT EXISTS dettaglio_ordini (
  fk_ordine int(11) NOT NULL,
  fk_biglietto int(11) NOT NULL,
  PRIMARY KEY (fk_ordine, fk_biglietto),
  UNIQUE KEY fk_biglietto (fk_biglietto),
  CONSTRAINT dettaglio_ordini_ibfk_1 FOREIGN KEY (fk_ordine) REFERENCES ordini (id_ordine),
  CONSTRAINT dettaglio_ordini_ibfk_2 FOREIGN KEY (fk_biglietto) REFERENCES biglietti (id_biglietto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- Dati iniziali
-- ============================================================================

-- Settori
INSERT INTO settori (id_settore, nome_settore, prezzo, capacita_max) VALUES
(1, 'Pit Gold', 120.00, 50),
(2, 'Tribuna Numerata', 85.00, 100),
(3, 'Prato', 55.00, 200)
ON DUPLICATE KEY UPDATE id_settore=id_settore;

-- Biglietti: un record per ciascun posto di ogni settore (capienza fino a 1000).
-- Viene eseguito solo se la tabella è ancora vuota.
INSERT INTO biglietti (fk_settore, venduto)
SELECT s.id_settore, 0
FROM settori s
JOIN (
  WITH RECURSIVE numeri (i) AS (
    SELECT 1 UNION ALL SELECT i + 1 FROM numeri WHERE i < 1000
  )
  SELECT i FROM numeri
) seq ON seq.i <= s.capacita_max
WHERE NOT EXISTS (SELECT 1 FROM biglietti);

-- Utente amministratore di test:  admin@concerto.it  /  admin123
-- (la password è salvata come hash bcrypt, come per tutti gli altri utenti)
INSERT INTO utenti (nome, cognome, email, password, codice_accesso, abilitato, ruolo)
VALUES ('Admin', 'Concerto', 'admin@concerto.it',
        '$2b$10$/xsQh8XS.oBXKXjGoeCD/uXm9AlGhUas7oR3FKe8jeBB97zDfGF3a', NULL, 0, 'admin')
ON DUPLICATE KEY UPDATE email=email;

-- ============================================================================
-- Controllo antiscalping a livello di database (ultima linea di difesa):
-- anche un INSERT eseguito a mano, fuori dall'applicazione, non può portare
-- un utente oltre i 4 biglietti complessivi.
-- ============================================================================
DROP TRIGGER IF EXISTS trg_limite_biglietti;

DELIMITER //
CREATE TRIGGER trg_limite_biglietti BEFORE INSERT ON dettaglio_ordini
FOR EACH ROW
BEGIN
  DECLARE v_utente INT;
  DECLARE v_totale INT;

  SELECT fk_utente INTO v_utente FROM ordini WHERE id_ordine = NEW.fk_ordine;

  SELECT COUNT(*) INTO v_totale
  FROM dettaglio_ordini d
  JOIN ordini o ON o.id_ordine = d.fk_ordine
  WHERE o.fk_utente = v_utente;

  IF v_totale >= 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Limite antiscalping: massimo 4 biglietti per utente';
  END IF;
END//
DELIMITER ;

-- ============================================================================
-- Aggiornamento OPZIONALE per un database concerto_db già esistente (XAMPP).
-- Non cancella nessun dato. Si può eseguire da phpMyAdmin (scheda "SQL")
-- oppure da terminale:   mysql -u root concerto_db < aggiornamento_giornata9.sql
--
-- Sintassi per MariaDB (quella di XAMPP). Su MySQL puro rimuovere "IF NOT EXISTS"
-- dalla riga ALTER TABLE.
-- ============================================================================
USE concerto_db;

-- 1. Colonna ruolo (già presente se hai eseguito aggiorna.sql)
ALTER TABLE utenti
  ADD COLUMN IF NOT EXISTS ruolo ENUM('cliente','admin') NOT NULL DEFAULT 'cliente';
UPDATE utenti SET ruolo = 'admin' WHERE email = 'admin@concerto.it';

-- 2. Indice composto: velocizza disponibilità e lock dei biglietti
ALTER TABLE biglietti ADD INDEX IF NOT EXISTS idx_settore_venduto (fk_settore, venduto);

-- 3. Trigger antiscalping: massimo 4 biglietti per utente anche a livello DB
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

-- 4. Password in chiaro: non serve convertirle a mano. Al primo login corretto
--    il server sostituisce automaticamente la password con il suo hash bcrypt.

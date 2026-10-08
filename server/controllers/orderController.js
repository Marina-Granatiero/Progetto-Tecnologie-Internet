const db = require('../db');

exports.creaOrdine = async (req, res) => {
  const { id_settore, quantita } = req.body;
  const id_utente = req.user.id_utente;

  if (!id_settore || !quantita || quantita < 1 || quantita > 4) {
    return res.status(400).json({ error: 'Dati ordine non validi o quantita non conforme (max 4 biglietti).' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [utenti] = await connection.query(
      'SELECT abilitato FROM utenti WHERE id_utente = ?',
      [id_utente]
    );

    if (utenti.length === 0 || !utenti[0].abilitato) {
      await connection.rollback();
      return res.status(403).json({ error: 'Utente non abilitato all\'acquisto dei biglietti.' });
    }

    const [storico] = await connection.query(
      `SELECT COUNT(d.fk_biglietto) AS totale_acquistati
       FROM ordini o
       JOIN dettaglio_ordini d ON o.id_ordine = d.fk_ordine
       WHERE o.fk_utente = ?`,
      [id_utente]
    );

    const giaAcquistati = storico[0].totale_acquistati || 0;
    if (giaAcquistati + quantita > 4) {
      await connection.rollback();
      return res.status(400).json({
        error: `Limite superato: hai gia acquistato ${giaAcquistati} biglietti. Puoi acquistarne al massimo ${4 - giaAcquistati}.`
      });
    }

    const [biglietti] = await connection.query(
      'SELECT id_biglietto FROM biglietti WHERE fk_settore = ? AND venduto = 0 LIMIT ? FOR UPDATE',
      [id_settore, quantita]
    );

    if (biglietti.length < quantita) {
      await connection.rollback();
      return res.status(400).json({ error: 'Biglietti non sufficienti o esauriti per il settore scelto.' });
    }

    const [settoreInfo] = await connection.query(
      'SELECT prezzo FROM settori WHERE id_settore = ?',
      [id_settore]
    );
    const prezzoUnitario = parseFloat(settoreInfo[0].prezzo);
    const totale = (prezzoUnitario * quantita).toFixed(2);

    const [risultatoOrdine] = await connection.query(
      'INSERT INTO ordini (fk_utente, totale) VALUES (?, ?)',
      [id_utente, totale]
    );
    const id_ordine = risultatoOrdine.insertId;

    for (const b of biglietti) {
      await connection.query(
        'INSERT INTO dettaglio_ordini (fk_ordine, fk_biglietto) VALUES (?, ?)',
        [id_ordine, b.id_biglietto]
      );
      await connection.query(
        'UPDATE biglietti SET venduto = 1 WHERE id_biglietto = ?',
        [b.id_biglietto]
      );
    }

    await connection.commit();

    return res.status(201).json({
      message: 'Ordine completato con successo!',
      id_ordine,
      totale,
      biglietti_acquistati: quantita
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Errore transazione ordine:', err);
    return res.status(500).json({ error: 'Errore interno durante l\'elaborazione dell\'ordine.' });
  } finally {
    if (connection) connection.release();
  }
};

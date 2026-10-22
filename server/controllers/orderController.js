const db = require('../db');
const config = require('../config');
const AppError = require('../utils/AppError');
const { interoPositivo } = require('../utils/validators');

const MAX_BIGLIETTI = config.business.maxBigliettiPerUtente;
const ER_LOCK_DEADLOCK = 1213;

function validaOrdine(body) {
  const idSettore = interoPositivo(body.id_settore);
  const quantita = interoPositivo(body.quantita);

  if (idSettore === null) {
    throw new AppError(400, 'Settore non valido.');
  }
  if (quantita === null || quantita > MAX_BIGLIETTI) {
    throw new AppError(
      400,
      `Quantità non valida: puoi acquistare da 1 a ${MAX_BIGLIETTI} biglietti per ordine.`
    );
  }
  return { idSettore, quantita };
}

const attesa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Transazione ACID di acquisto.
 *
 * Ordine dei lock (sempre lo stesso per tutte le richieste, quindi niente deadlock):
 *   1. riga dell'utente   -> serializza gli ordini concorrenti dello STESSO utente
 *                            (due schede/script non possono aggirare il limite dei 4)
 *   2. riga del settore   -> serializza gli ordini concorrenti sullo STESSO settore
 *   3. righe dei biglietti (SELECT ... FOR UPDATE) -> nessun biglietto venduto due volte
 *
 * NB: la prima lettura "normale" (COUNT) avviene dopo il lock sull'utente, così in
 * REPEATABLE READ lo snapshot include già gli ordini appena confermati da altri.
 */
async function eseguiOrdine(idUtente, idSettore, quantita) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    try {
      // 1. Lock sull'utente + verifica abilitazione
      const [utenti] = await conn.query(
        'SELECT abilitato FROM utenti WHERE id_utente = ? FOR UPDATE',
        [idUtente]
      );
      if (utenti.length === 0) {
        throw new AppError(401, 'Account non più esistente.');
      }
      if (!utenti[0].abilitato) {
        throw new AppError(403, "Utente non abilitato all'acquisto dei biglietti.");
      }

      // Controllo antiscalping: massimo storico di biglietti per utente
      const [storico] = await conn.query(
        `SELECT COUNT(d.fk_biglietto) AS totale
         FROM ordini o
         JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
         WHERE o.fk_utente = ?`,
        [idUtente]
      );
      const giaAcquistati = Number(storico[0].totale);
      if (giaAcquistati + quantita > MAX_BIGLIETTI) {
        const residui = Math.max(0, MAX_BIGLIETTI - giaAcquistati);
        throw new AppError(
          409,
          residui === 0
            ? `Limite raggiunto: hai già acquistato ${giaAcquistati} biglietti su un massimo di ${MAX_BIGLIETTI}.`
            : `Limite superato: hai già acquistato ${giaAcquistati} biglietti. Puoi acquistarne al massimo ${residui}.`
        );
      }

      // 2. Lock sul settore (e lettura del prezzo)
      const [settori] = await conn.query(
        'SELECT prezzo FROM settori WHERE id_settore = ? FOR UPDATE',
        [idSettore]
      );
      if (settori.length === 0) {
        throw new AppError(404, 'Settore inesistente.');
      }

      // 3. Lock sui biglietti da vendere
      const [biglietti] = await conn.query(
        `SELECT id_biglietto FROM biglietti
         WHERE fk_settore = ? AND venduto = 0
         ORDER BY id_biglietto
         LIMIT ? FOR UPDATE`,
        [idSettore, quantita]
      );
      if (biglietti.length < quantita) {
        throw new AppError(
          409,
          biglietti.length === 0
            ? 'Settore esaurito.'
            : `Biglietti non sufficienti: nel settore ne restano solo ${biglietti.length}.`
        );
      }

      // Importo calcolato in centesimi interi (niente errori di arrotondamento)
      const centesimi = Math.round(Number(settori[0].prezzo) * 100) * quantita;
      const totale = (centesimi / 100).toFixed(2);

      const [ordine] = await conn.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, ?)', [
        idUtente,
        totale,
      ]);
      const idOrdine = ordine.insertId;
      const idBiglietti = biglietti.map((b) => b.id_biglietto);

      await conn.query('INSERT INTO dettaglio_ordini (fk_ordine, fk_biglietto) VALUES ?', [
        idBiglietti.map((idBiglietto) => [idOrdine, idBiglietto]),
      ]);
      const [aggiornati] = await conn.query(
        'UPDATE biglietti SET venduto = 1 WHERE id_biglietto IN (?) AND venduto = 0',
        [idBiglietti]
      );
      if (aggiornati.affectedRows !== quantita) {
        // non dovrebbe mai succedere (righe già bloccate): rete di sicurezza
        throw new Error('Incoerenza durante la prenotazione dei biglietti.');
      }

      await conn.commit();
      return {
        id_ordine: idOrdine,
        totale,
        biglietti_acquistati: quantita,
        biglietti_totali_utente: giaAcquistati + quantita,
        biglietti_rimanenti_utente: MAX_BIGLIETTI - giaAcquistati - quantita,
      };
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    }
  } finally {
    conn.release();
  }
}

// Un deadlock è un evento normale in un DBMS concorrente: MySQL annulla una delle
// due transazioni e la sua gestione corretta è semplicemente riprovare.
async function conRiprova(operazione, tentativi = 4) {
  for (let i = 1; ; i++) {
    try {
      return await operazione();
    } catch (err) {
      if (err.errno === ER_LOCK_DEADLOCK && i < tentativi) {
        await attesa(15 * i + Math.random() * 25);
        continue;
      }
      throw err;
    }
  }
}

// ==========================================================
// POST /api/ordini   { id_settore, quantita }
// ==========================================================
exports.creaOrdine = async (req, res) => {
  const { idSettore, quantita } = validaOrdine(req.body ?? {});
  const esito = await conRiprova(() => eseguiOrdine(req.user.id_utente, idSettore, quantita));
  res.status(201).json({ message: 'Ordine completato con successo!', ...esito });
};

// ==========================================================
// GET /api/ordini/miei  ->  storico ordini e limite residuo dell'utente
// ==========================================================
exports.mieiOrdini = async (req, res) => {
  const [righe] = await db.query(
    `SELECT o.id_ordine, o.data_ora, o.totale, s.id_settore, s.nome_settore,
            COUNT(d.fk_biglietto) AS quantita
     FROM ordini o
     JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
     JOIN biglietti b ON b.id_biglietto = d.fk_biglietto
     JOIN settori s ON s.id_settore = b.fk_settore
     WHERE o.fk_utente = ?
     GROUP BY o.id_ordine, o.data_ora, o.totale, s.id_settore, s.nome_settore
     ORDER BY o.id_ordine DESC`,
    [req.user.id_utente]
  );

  const ordini = righe.map((r) => ({
    id_ordine: r.id_ordine,
    data_ora: r.data_ora,
    totale: r.totale,
    id_settore: r.id_settore,
    nome_settore: r.nome_settore,
    quantita: Number(r.quantita),
  }));
  const acquistati = ordini.reduce((somma, o) => somma + o.quantita, 0);

  res.json({
    limite: MAX_BIGLIETTI,
    acquistati,
    rimanenti: Math.max(0, MAX_BIGLIETTI - acquistati),
    ordini,
  });
};

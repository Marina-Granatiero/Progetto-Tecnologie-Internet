const db = require('../db');
const config = require('../config');

const MAX_BIGLIETTI = config.business.maxBigliettiPerUtente;
const n = (valore) => Number(valore ?? 0);

// Sotto-query riutilizzata: quanti biglietti ha acquistato ciascun acquirente
const BIGLIETTI_PER_ACQUIRENTE = `
  SELECT o.fk_utente, COUNT(d.fk_biglietto) AS biglietti
  FROM ordini o
  JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
  GROUP BY o.fk_utente
`;

// ==========================================================
// GET /api/admin/statistiche   (JWT + ruolo admin)
// Statistiche aggregate e "sentinella" di audit.
// ==========================================================
exports.statistiche = async (req, res) => {
  const [
    [rapporto],
    [distribuzione],
    [nonAutorizzati],
    [oltreLimite],
    [incoerenti],
    [overbooking],
    [perSettore],
    [utentiStats],
    [incasso],
    [ordiniRecenti],
    [elencoUtenti],
  ] = await Promise.all([
    // 1. Biglietti "per sé" vs "accompagnatori".
    //    Regola: ogni acquirente intesta a sé un biglietto, gli altri sono per accompagnatori.
    db.query(`
      SELECT COUNT(*) AS acquirenti, COALESCE(SUM(biglietti), 0) AS totale_venduti
      FROM (${BIGLIETTI_PER_ACQUIRENTE}) t
    `),

    // 1b. Quanti acquirenti hanno comprato 1, 2, 3, 4 biglietti
    db.query(`
      SELECT biglietti, COUNT(*) AS acquirenti
      FROM (${BIGLIETTI_PER_ACQUIRENTE}) t
      GROUP BY biglietti
      ORDER BY biglietti
    `),

    // 2. Sentinella: biglietti venduti a chi NON aveva diritto di acquistare (deve essere 0)
    db.query(`
      SELECT COUNT(d.fk_biglietto) AS totale
      FROM ordini o
      JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
      JOIN utenti u ON u.id_utente = o.fk_utente
      WHERE u.abilitato = 0 OR u.codice_accesso IS NULL
    `),

    // 2b. Sentinella: utenti che hanno superato il limite antiscalping (deve essere 0)
    db.query(
      `SELECT COUNT(*) AS totale FROM (${BIGLIETTI_PER_ACQUIRENTE}) t WHERE biglietti > ?`,
      [MAX_BIGLIETTI]
    ),

    // 2c. Sentinella: stato "venduto" incoerente con gli ordini (deve essere 0)
    db.query(`
      SELECT COUNT(*) AS totale
      FROM biglietti b
      LEFT JOIN dettaglio_ordini d ON d.fk_biglietto = b.id_biglietto
      WHERE (b.venduto = 1 AND d.fk_biglietto IS NULL)
         OR (b.venduto = 0 AND d.fk_biglietto IS NOT NULL)
    `),

    // 2d. Sentinella: settori con più biglietti venduti della capienza (overbooking, deve essere 0)
    db.query(`
      SELECT COUNT(*) AS totale FROM (
        SELECT s.id_settore
        FROM settori s
        JOIN biglietti b ON b.fk_settore = s.id_settore AND b.venduto = 1
        GROUP BY s.id_settore, s.capacita_max
        HAVING COUNT(*) > s.capacita_max
      ) t
    `),

    // 3. Vendite e incassi per settore
    db.query(`
      SELECT
        s.id_settore,
        s.nome_settore,
        s.prezzo,
        s.capacita_max,
        COUNT(CASE WHEN b.venduto = 1 THEN 1 END) AS biglietti_venduti,
        COUNT(CASE WHEN b.venduto = 0 THEN 1 END) AS biglietti_rimasti,
        COALESCE(SUM(CASE WHEN b.venduto = 1 THEN s.prezzo ELSE 0 END), 0) AS incasso_settore
      FROM settori s
      LEFT JOIN biglietti b ON b.fk_settore = s.id_settore
      GROUP BY s.id_settore, s.nome_settore, s.prezzo, s.capacita_max
      ORDER BY s.id_settore ASC
    `),

    // 4. Iscritti totali vs abilitati
    db.query(`
      SELECT COUNT(*) AS totale_iscritti,
             COUNT(CASE WHEN abilitato = 1 THEN 1 END) AS utenti_abilitati
      FROM utenti
      WHERE ruolo = 'cliente'
    `),

    // 5. Incasso complessivo e numero ordini
    db.query('SELECT COUNT(*) AS ordini, COALESCE(SUM(totale), 0) AS incasso FROM ordini'),

    // 6. Ultimi ordini
    db.query(`
      SELECT o.id_ordine, o.data_ora, o.totale, u.nome, u.cognome, u.email,
             COUNT(d.fk_biglietto) AS quantita,
             GROUP_CONCAT(DISTINCT s.nome_settore ORDER BY s.nome_settore SEPARATOR ', ') AS settore
      FROM ordini o
      JOIN utenti u ON u.id_utente = o.fk_utente
      JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
      JOIN biglietti b ON b.id_biglietto = d.fk_biglietto
      JOIN settori s ON s.id_settore = b.fk_settore
      GROUP BY o.id_ordine, o.data_ora, o.totale, u.nome, u.cognome, u.email
      ORDER BY o.id_ordine DESC
      LIMIT 10
    `),

    // 7. Elenco clienti con codice e biglietti acquistati (per l'audit manuale)
    db.query(`
      SELECT u.id_utente, u.nome, u.cognome, u.email, u.abilitato, u.codice_accesso,
             u.data_iscrizione, COUNT(d.fk_biglietto) AS biglietti
      FROM utenti u
      LEFT JOIN ordini o ON o.fk_utente = u.id_utente
      LEFT JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
      WHERE u.ruolo = 'cliente'
      GROUP BY u.id_utente, u.nome, u.cognome, u.email, u.abilitato, u.codice_accesso, u.data_iscrizione
      ORDER BY u.id_utente
      LIMIT 200
    `),
  ]);

  const acquirenti = n(rapporto[0].acquirenti);
  const totaleVenduti = n(rapporto[0].totale_venduti);

  const acquistiNonAutorizzati = n(nonAutorizzati[0].totale);
  const utentiOltreLimite = n(oltreLimite[0].totale);
  const bigliettiIncoerenti = n(incoerenti[0].totale);
  const settoriOverbooking = n(overbooking[0].totale);
  const anomalie =
    acquistiNonAutorizzati + utentiOltreLimite + bigliettiIncoerenti + settoriOverbooking;

  // istogramma completo: 1..MAX biglietti, anche con 0 acquirenti
  const perQuantita = Array.from({ length: MAX_BIGLIETTI }, (_, i) => {
    const riga = distribuzione.find((r) => n(r.biglietti) === i + 1);
    return { biglietti: i + 1, acquirenti: riga ? n(riga.acquirenti) : 0 };
  });

  res.set('Cache-Control', 'no-store');
  res.json({
    biglietti: {
      biglietti_per_se: acquirenti,
      biglietti_per_altri: totaleVenduti - acquirenti,
      totale_venduti: totaleVenduti,
      acquirenti_per_quantita: perQuantita,
    },
    // compatibilità: numero di biglietti venduti senza diritto (sentinella principale)
    audit_sentinella: acquistiNonAutorizzati,
    audit: {
      acquisti_non_autorizzati: acquistiNonAutorizzati,
      utenti_oltre_limite: utentiOltreLimite,
      biglietti_incoerenti: bigliettiIncoerenti,
      settori_overbooking: settoriOverbooking,
      anomalie_totali: anomalie,
      integro: anomalie === 0,
    },
    settori: perSettore.map((s) => ({
      ...s,
      biglietti_venduti: n(s.biglietti_venduti),
      biglietti_rimasti: n(s.biglietti_rimasti),
    })),
    utenti: {
      totale_iscritti: n(utentiStats[0].totale_iscritti),
      utenti_abilitati: n(utentiStats[0].utenti_abilitati),
    },
    incasso: { ordini: n(incasso[0].ordini), totale: Number(incasso[0].incasso ?? 0).toFixed(2) },
    ordini_recenti: ordiniRecenti.map((o) => ({ ...o, quantita: n(o.quantita) })),
    elenco_utenti: elencoUtenti.map((u) => ({
      ...u,
      abilitato: Boolean(u.abilitato),
      biglietti: n(u.biglietti),
    })),
    max_biglietti_per_utente: MAX_BIGLIETTI,
    generato_il: new Date().toISOString(),
  });
};

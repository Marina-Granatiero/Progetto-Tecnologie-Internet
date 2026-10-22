const db = require('../db');
const config = require('../config');

// GET /api/settori  ->  settori con disponibilità aggiornata in tempo reale
exports.elenco = async (req, res) => {
  const [righe] = await db.query(`
    SELECT
      s.id_settore,
      s.nome_settore,
      s.prezzo,
      s.capacita_max,
      COUNT(CASE WHEN b.venduto = 0 THEN 1 END) AS biglietti_disponibili,
      COUNT(CASE WHEN b.venduto = 1 THEN 1 END) AS biglietti_venduti
    FROM settori s
    LEFT JOIN biglietti b ON b.fk_settore = s.id_settore
    GROUP BY s.id_settore, s.nome_settore, s.prezzo, s.capacita_max
    ORDER BY s.id_settore ASC
  `);

  res.set('Cache-Control', 'no-store');
  res.json(
    righe.map((r) => ({
      ...r,
      biglietti_disponibili: Number(r.biglietti_disponibili),
      biglietti_venduti: Number(r.biglietti_venduti),
    }))
  );
};

// GET /api/regole  ->  regole di business (il client non duplica le costanti)
// e quanti codici di prelazione sono già stati assegnati.
exports.regole = async (req, res) => {
  const [righe] = await db.query(
    "SELECT COUNT(*) AS assegnati FROM utenti WHERE ruolo = 'cliente' AND abilitato = 1"
  );
  res.set('Cache-Control', 'no-store');
  res.json({
    soglia_primi_iscritti: config.business.sogliaPrimiIscritti,
    max_biglietti_per_utente: config.business.maxBigliettiPerUtente,
    codici_assegnati: Number(righe[0].assegnati),
  });
};

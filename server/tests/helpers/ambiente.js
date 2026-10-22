// Ambiente di test condiviso: database dedicato, server in ascolto su porta casuale
// e piccole funzioni di utilità. NON tocca mai il database di produzione.
//
// Variabili utili:  TEST_DB_NAME (default "concerto_test")
const nomeDbTest = process.env.TEST_DB_NAME || 'concerto_test';
if (!/test/i.test(nomeDbTest)) {
  throw new Error(
    `Per sicurezza il database di test deve contenere "test" nel nome (trovato "${nomeDbTest}").`
  );
}
// Le variabili d'ambiente hanno la precedenza sul file .env (vedi config/index.js)
process.env.DB_NAME = nomeDbTest;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segreto-usato-solo-nei-test';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../db');
const app = require('../../app');
const { inizializzaDatabase } = require('../../scripts/init-db');

const PASSWORD_TEST = 'Password123';
const HASH_TEST = bcrypt.hashSync(PASSWORD_TEST, 4); // costo basso: i test restano veloci
let contatore = 0;

/** Ricrea da zero il database di test ed avvia il server su una porta libera. */
async function avvia() {
  await inizializzaDatabase({ reset: true, nomeDb: nomeDbTest, silenzioso: true });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  /** Chiamata HTTP all'API: restituisce { status, body }. */
  async function chiama(metodo, percorso, { token, body, intestazioni, grezzo } = {}) {
    const headers = { ...(intestazioni || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (grezzo !== undefined) {
      payload = grezzo;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const risposta = await fetch(base + percorso, { method: metodo, headers, body: payload });
    const testo = await risposta.text();
    let json = null;
    try {
      json = testo ? JSON.parse(testo) : null;
    } catch {
      json = { _nonJson: testo };
    }
    return { status: risposta.status, body: json, headers: risposta.headers };
  }

  async function chiudi() {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  }

  return { base, chiama, chiudi };
}

let inventarioModificato = false;

/** Riporta il database allo stato "vendite aperte, nessun cliente, inventario completo". */
async function pulisci() {
  await db.query('DELETE FROM dettaglio_ordini');
  await db.query('DELETE FROM ordini');
  await db.query("DELETE FROM utenti WHERE ruolo = 'cliente'");
  if (inventarioModificato) {
    // ricrea i biglietti esattamente come fa lo schema (uno per posto)
    await db.query('DELETE FROM biglietti');
    await db.query('ALTER TABLE biglietti AUTO_INCREMENT = 1');
    await db.query(`
      INSERT INTO biglietti (fk_settore, venduto)
      SELECT s.id_settore, 0 FROM settori s
      JOIN (WITH RECURSIVE numeri (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM numeri WHERE i < 1000)
            SELECT i FROM numeri) seq ON seq.i <= s.capacita_max`);
    await db.query('UPDATE settori SET capacita_max = 50 WHERE id_settore = 1');
    inventarioModificato = false;
  }
  await db.query('UPDATE biglietti SET venduto = 0');
}

function tokenPer(utente, opzioni = {}, segreto = config.jwt.secret) {
  return jwt.sign(
    { id_utente: utente.id_utente, email: utente.email, ruolo: utente.ruolo },
    segreto,
    { expiresIn: '1h', ...opzioni }
  );
}

/** Inserisce direttamente un cliente nel DB (senza passare dalla regola dei primi 5). */
async function creaUtente({ abilitato = true, ruolo = 'cliente', password = HASH_TEST } = {}) {
  const n = ++contatore;
  const email = `utente${n}.${Date.now()}@test.it`;
  const codice = abilitato ? `TEST-${Date.now().toString(36)}${n}`.toUpperCase().slice(0, 20) : null;
  const [r] = await db.query(
    `INSERT INTO utenti (nome, cognome, email, password, codice_accesso, abilitato, ruolo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`Nome${n}`, `Cognome${n}`, email, password, codice, abilitato ? 1 : 0, ruolo]
  );
  const utente = { id_utente: r.insertId, email, ruolo, password: PASSWORD_TEST };
  utente.token = tokenPer(utente);
  return utente;
}

/**
 * Riduce l'inventario di un settore a `rimasti` biglietti vendibili (gli altri vengono
 * eliminati, NON marcati come venduti: così i controlli di coerenza restano validi).
 */
async function limitaDisponibilita(idSettore, rimasti) {
  inventarioModificato = true;
  await db.query(
    `DELETE FROM biglietti WHERE fk_settore = ? AND id_biglietto NOT IN (
       SELECT id_biglietto FROM (
         SELECT id_biglietto FROM biglietti WHERE fk_settore = ? ORDER BY id_biglietto LIMIT ?
       ) t)`,
    [idSettore, idSettore, rimasti]
  );
}

async function contaVenduti(idSettore) {
  const [r] = await db.query(
    'SELECT COUNT(*) AS n FROM biglietti WHERE fk_settore = ? AND venduto = 1',
    [idSettore]
  );
  return Number(r[0].n);
}

async function bigliettiDi(idUtente) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM dettaglio_ordini d
     JOIN ordini o ON o.id_ordine = d.fk_ordine WHERE o.fk_utente = ?`,
    [idUtente]
  );
  return Number(r[0].n);
}

async function loginAdmin(chiama) {
  const r = await chiama('POST', '/auth/login', {
    body: { email: 'admin@concerto.it', password: 'admin123' },
  });
  return r.body.token;
}

module.exports = {
  avvia,
  pulisci,
  creaUtente,
  tokenPer,
  limitaDisponibilita,
  contaVenduti,
  bigliettiDi,
  loginAdmin,
  db,
  config,
  PASSWORD_TEST,
};

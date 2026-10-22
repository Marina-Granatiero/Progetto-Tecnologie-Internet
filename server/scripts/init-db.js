#!/usr/bin/env node
// Crea (o ricrea) il database eseguendo database/schema.sql.
//
//   node scripts/init-db.js            -> crea tabelle e dati iniziali se mancano
//   node scripts/init-db.js --reset    -> CANCELLA il database e lo ricrea da zero
//
// Il nome del database arriva da DB_NAME (.env o variabile d'ambiente).
// Il parser supporta la direttiva DELIMITER usata dal trigger.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

/** Spezza lo script SQL in singole istruzioni rispettando le direttive DELIMITER. */
function dividiIstruzioni(sql) {
  const istruzioni = [];
  let delimitatore = ';';
  let corrente = [];

  for (const riga of sql.replace(/\r\n/g, '\n').split('\n')) {
    const pulita = riga.trim();
    const mDelim = /^DELIMITER\s+(\S+)\s*$/i.exec(pulita);
    if (mDelim) {
      delimitatore = mDelim[1];
      continue;
    }
    if (corrente.length === 0 && (pulita === '' || pulita.startsWith('--'))) continue;

    corrente.push(riga);
    if (pulita.endsWith(delimitatore)) {
      const testo = corrente.join('\n').trim();
      istruzioni.push(testo.slice(0, testo.length - delimitatore.length).trim());
      corrente = [];
    }
  }
  if (corrente.join('').trim()) istruzioni.push(corrente.join('\n').trim());
  return istruzioni;
}

async function inizializzaDatabase({ reset = false, nomeDb = config.db.database, silenzioso = false } = {}) {
  const log = silenzioso ? () => {} : (m) => console.log(m);
  if (!/^[A-Za-z0-9_]+$/.test(nomeDb)) throw new Error(`Nome database non valido: ${nomeDb}`);

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: 'utf8mb4',
  });

  try {
    if (reset) {
      log(`› Elimino il database "${nomeDb}"...`);
      await conn.query(`DROP DATABASE IF EXISTS \`${nomeDb}\``);
    }
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${nomeDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await conn.query(`USE \`${nomeDb}\``);

    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    // CREATE DATABASE / USE dello script sono sostituiti da quelli sopra (nome configurabile)
    const istruzioni = dividiIstruzioni(sql).filter(
      (s) => !/^(CREATE\s+DATABASE|USE)\b/i.test(s)
    );
    for (const istruzione of istruzioni) {
      await conn.query(istruzione);
    }
    log(`✔ Database "${nomeDb}" pronto (${istruzioni.length} istruzioni eseguite).`);
  } finally {
    await conn.end();
  }
}

module.exports = { inizializzaDatabase, dividiIstruzioni };

if (require.main === module) {
  inizializzaDatabase({ reset: process.argv.includes('--reset') }).catch((err) => {
    // Con Node >= 20, se localhost non risponde né su IPv4 né su IPv6 l'errore è un AggregateError
    // con message vuoto: il codice (ECONNREFUSED...) sta nell'errore stesso o nei suoi sotto-errori.
    const codice = err.code || (err.errors && err.errors[0] && err.errors[0].code) || '';
    const dettaglio = err.message || codice || 'errore sconosciuto';
    console.error(`✖ Inizializzazione fallita: ${dettaglio}${codice && err.message ? ` (${codice})` : ''}`);
    if (codice === 'ECONNREFUSED' || codice === 'ETIMEDOUT' || codice === 'ENOTFOUND') {
      console.error(
        `  Il database non risponde su ${config.db.host}:${config.db.port}. ` +
          'Avvia MySQL dal pannello di XAMPP (deve essere verde) e controlla DB_HOST e DB_PORT in server/.env.'
      );
    } else if (codice === 'ER_ACCESS_DENIED_ERROR') {
      console.error('  Utente o password errati: controlla DB_USER e DB_PASSWORD in server/.env.');
    }
    process.exit(1);
  });
}

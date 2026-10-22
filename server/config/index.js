// Configurazione centralizzata del server.
// Il file .env viene cercato accanto a /server, quindi `node index.js`
// funziona a prescindere dalla cartella da cui viene lanciato.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function interoDaEnv(nome, predefinito) {
  const valore = Number.parseInt(process.env[nome], 10);
  return Number.isInteger(valore) && valore > 0 ? valore : predefinito;
}

const config = {
  port: interoDaEnv('PORT', 5000),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: interoDaEnv('DB_PORT', 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'concerto_db',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Regole di business (Giornata 1)
  business: {
    // i primi N iscritti (clienti) ottengono abilitazione + codice prioritario
    sogliaPrimiIscritti: interoDaEnv('SOGLIA_PRIMI_ISCRITTI', 5),
    // tetto massimo storico di biglietti acquistabili da un singolo utente
    maxBigliettiPerUtente: interoDaEnv('MAX_BIGLIETTI_PER_UTENTE', 4),
  },

  // Origine consentita per il CORS (vuoto = qualsiasi origine, comodo in sviluppo)
  clientOrigin: process.env.CLIENT_ORIGIN || '',
};

if (!config.jwt.secret) {
  throw new Error(
    'JWT_SECRET non impostato: aggiungilo al file server/.env (vedi server/.env.example).'
  );
}

module.exports = config;

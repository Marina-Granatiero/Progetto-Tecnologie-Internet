// Punto di ingresso: avvia il server HTTP sulla porta configurata.
let app;
let config;
let db;
let verificaSchema;
try {
  config = require('./config');
  db = require('./db');
  app = require('./app');
  verificaSchema = require('./utils/verificaSchema').verificaSchema;
} catch (err) {
  console.error(`\n✖ Avvio non riuscito: ${err.message}\n`);
  process.exit(1);
}

const server = app.listen(config.port, async () => {
  console.log(`✔ Server HTTP in ascolto sulla porta ${config.port}`);
  try {
    await db.query('SELECT 1');
    console.log(`✔ Database "${config.db.database}" raggiungibile su ${config.db.host}:${config.db.port}`);
    const problemi = await verificaSchema(db);
    if (problemi.length === 0) {
      console.log('✔ Struttura del database corretta');
    } else {
      console.error(
        `✖ Il database "${config.db.database}" è raggiungibile ma la struttura non è quella prevista:\n` +
          problemi.map((p) => `   - ${p}`).join('\n') +
          '\n  Finché non lo sistemi il sito mostra "Errore interno del server".' +
          '\n  Rimedio: ferma il server (Ctrl+C), esegui "npm run db:reset" (ricrea il database da zero) e riavvia con "npm start".'
      );
    }
  } catch (err) {
    console.error(
      `✖ Database non raggiungibile (${err.code || err.message}). ` +
        'Controlla che MySQL/MariaDB (XAMPP) sia avviato e che i dati in server/.env siano corretti.'
    );
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n✖ La porta ${config.port} è già occupata (un altro "node index.js" è ancora in esecuzione?).` +
        '\n  Chiudi il processo precedente oppure cambia PORT in server/.env.\n'
    );
  } else {
    console.error('Errore del server:', err);
  }
  process.exit(1);
});

// Chiusura ordinata (Ctrl+C)
for (const segnale of ['SIGINT', 'SIGTERM']) {
  process.on(segnale, () => {
    server.close(() => db.end().finally(() => process.exit(0)));
  });
}

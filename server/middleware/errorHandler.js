const AppError = require('../utils/AppError');

// 404 in JSON per qualsiasi rotta /api inesistente
function notFound(req, res) {
  res.status(404).json({ error: `Risorsa non trovata: ${req.method} ${req.originalUrl}` });
}

// Gestore globale degli errori: risposte sempre in JSON, mai stack trace al client.
// (Express 5 inoltra qui anche le eccezioni dei gestori async.)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo della richiesta non valido (JSON malformato).' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo della richiesta troppo grande.' });
  }

  if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_DB_ERROR'].includes(err.code)) {
    console.error(
      `✖ Struttura del database non adatta (${err.code}: ${err.sqlMessage || err.message}).\n` +
        '  Ferma il server, esegui "npm run db:reset" nella cartella server e riavvialo con "npm start".'
    );
  }
  console.error('Errore non gestito:', err);
  res.status(500).json({ error: 'Errore interno del server.' });
}

module.exports = { notFound, errorHandler };

const jwt = require('jsonwebtoken');
const config = require('../config');

// Verifica il token JWT inviato come "Authorization: Bearer <token>".
// 401 = non autenticato (token assente, scaduto o manomesso).
module.exports = (req, res, next) => {
  const intestazione = req.headers['authorization'] || '';
  const [schema, token] = intestazione.split(' ');

  if (!token || !/^Bearer$/i.test(schema)) {
    return res.status(401).json({ error: 'Accesso negato: token mancante.' });
  }

  try {
    const { id_utente, email, ruolo } = jwt.verify(token, config.jwt.secret);
    req.user = { id_utente, email, ruolo };
    next();
  } catch {
    return res.status(401).json({ error: 'Token non valido o scaduto.' });
  }
};

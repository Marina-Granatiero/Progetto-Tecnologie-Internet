const db = require('../db');

// Da usare DOPO authMiddleware.
// Il ruolo viene riletto dal database a ogni richiesta (non ci si fida solo del
// token): se un amministratore viene retrocesso perde subito l'accesso.
module.exports = async (req, res, next) => {
  try {
    const [righe] = await db.query('SELECT ruolo FROM utenti WHERE id_utente = ?', [
      req.user?.id_utente,
    ]);
    if (righe.length === 0 || righe[0].ruolo !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Accesso negato: privilegi di amministratore richiesti.' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

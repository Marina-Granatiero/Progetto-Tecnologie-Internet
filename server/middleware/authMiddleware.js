const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Accesso negato: token mancante.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'CHIAVE_SEGRETA_PROGETTO_2026');
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token non valido o scaduto.' });
  }
};

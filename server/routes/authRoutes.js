const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Registrazione
router.post('/register', async (req, res) => {
  try {
    const { nome, cognome, email, password } = req.body;
    if (!nome || !cognome || !email || !password) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    const [esistente] = await db.query('SELECT id_utente FROM utenti WHERE email = ?', [email]);
    if (esistente.length > 0) {
      return res.status(400).json({ error: 'Email già registrata.' });
    }

    const [conteggio] = await db.query('SELECT COUNT(*) AS totale FROM utenti');
    const isAbilitato = conteggio[0].totale < 5 ? 1 : 0;
    const codice = isAbilitato ? 'TICKET-' + Math.random().toString(36).substring(2, 8).toUpperCase() : null;

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO utenti (nome, cognome, email, password, abilitato, codice_accesso) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, cognome, email, hashedPassword, isAbilitato, codice]
    );

    res.status(201).json({
      message: 'Registrazione completata con successo!',
      utente: { id_utente: result.insertId, nome, cognome, email, abilitato: isAbilitato, codice_accesso: codice }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [righe] = await db.query('SELECT * FROM utenti WHERE email = ?', [email]);
    if (righe.length === 0) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    const utente = righe[0];
    const passwordValida = await bcrypt.compare(password, utente.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    const token = jwt.sign(
      { id_utente: utente.id_utente, email: utente.email, ruolo: utente.ruolo, abilitato: utente.abilitato },
      process.env.JWT_SECRET || 'CHIAVE_SEGRETA_PROGETTO_2026',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login effettuato con successo!',
      token,
      utente: {
        id_utente: utente.id_utente,
        nome: utente.nome,
        cognome: utente.cognome,
        email: utente.email,
        ruolo: utente.ruolo,
        abilitato: utente.abilitato,
        codice_accesso: utente.codice_accesso
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

module.exports = router;

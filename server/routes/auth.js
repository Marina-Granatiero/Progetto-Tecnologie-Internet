const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');

// Soglia dei primi N iscritti con diritto di prelazione (impostata a 5 come da specifica)
const SOGLIA_PRIMI_ISCRITTI = 5;

// ==========================================
// 1. ENDPOINT REGISTRAZIONE UTENTE
// POST /api/auth/register
// ==========================================
router.post('/register', async (req, res) => {
  const { nome, cognome, email, password } = req.body;

  // Controllo presenza campi obbligatori
  if (!nome || !cognome || !email || !password) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
  }

  try {
    // Verifica unicità email
    const [existingUsers] = await db.query('SELECT id_utente FROM utenti WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email già registrata.' });
    }

    // Conteggio degli utenti registrati con ruolo 'cliente'
    const [countResult] = await db.query("SELECT COUNT(*) AS totale FROM utenti WHERE ruolo = 'cliente'");
    const totaleIscritti = countResult[0].totale;

    let codiceAccesso = null;
    let abilitato = 0;

    // Regola dei primi N: se sotto soglia, abilita e assegna codice casuale
    if (totaleIscritti < SOGLIA_PRIMI_ISCRITTI) {
      abilitato = 1;
      // Codice alfanumerico univoco generico (es. TICKET-A1B2C3)
      codiceAccesso = 'TICKET-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    // Hashing unidirezionale della password con bcrypt (10 round di salt)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Inserimento utente nel database MySQL
    const insertQuery = `
      INSERT INTO utenti (nome, cognome, email, password, codice_accesso, abilitato, ruolo)
      VALUES (?, ?, ?, ?, ?, ?, 'cliente')
    `;
    const [result] = await db.query(insertQuery, [
      nome,
      cognome,
      email,
      hashedPassword,
      codiceAccesso,
      abilitato
    ]);

    res.status(201).json({
      message: 'Registrazione completata con successo!',
      utente: {
        id_utente: result.insertId,
        nome,
        cognome,
        email,
        abilitato: Boolean(abilitato),
        codice_accesso: codiceAccesso
      }
    });

  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server durante la registrazione.' });
  }
});

// ==========================================
// 2. ENDPOINT LOGIN UTENTE
// POST /api/auth/login
// ==========================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatorie.' });
  }

  try {
    // Ricerca dell'utente tramite email
    const [users] = await db.query('SELECT * FROM utenti WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    const user = users[0];

    // Verifica crittografica password
    let isMatch = false;
    if (user.password === password) {
      // Compatibilità transitoria per record con password inserite in chiaro nei test precedenti
      isMatch = true;
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    // Payload del token JWT
    const payload = {
      id_utente: user.id_utente,
      email: user.email,
      ruolo: user.ruolo,
      abilitato: user.abilitato,
      codice_accesso: user.codice_accesso
    };

    // Firma del token con scadenza 24 ore
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'chiave_segreta_generica', {
      expiresIn: '24h'
    });

    res.json({
      message: 'Login effettuato con successo!',
      token,
      utente: {
        id_utente: user.id_utente,
        nome: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo,
        abilitato: Boolean(user.abilitato),
        codice_accesso: user.codice_accesso
      }
    });

  } catch (error) {
    console.error('Errore durante il login:', error);
    res.status(500).json({ error: 'Errore interno del server durante il login.' });
  }
});

module.exports = router;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const AppError = require('../utils/AppError');
const { pulisci, normalizzaEmail, emailValida } = require('../utils/validators');

const BCRYPT_ROUNDS = 10;
const LUNGHEZZA_MIN_PASSWORD = 8;
const BYTE_MAX_PASSWORD = 72; // limite intrinseco di bcrypt
// Nome del lock applicativo che serializza le registrazioni (vedi register)
const LOCK_REGISTRAZIONE = 'concerto:registrazione';
// Hash "civetta": usato quando l'email non esiste, così login riuscito/fallito
// impiegano lo stesso tempo e non si possono enumerare gli account.
const HASH_CIVETTA = bcrypt.hashSync('password-civetta', BCRYPT_ROUNDS);

function serializzaUtente(u) {
  return {
    id_utente: u.id_utente,
    nome: u.nome,
    cognome: u.cognome,
    email: u.email,
    ruolo: u.ruolo || 'cliente',
    abilitato: Boolean(u.abilitato),
    codice_accesso: u.codice_accesso || null,
  };
}

function generaCodiceAccesso() {
  return 'TICKET-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function validaRegistrazione(body) {
  const nome = pulisci(body.nome);
  const cognome = pulisci(body.cognome);
  const email = normalizzaEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!nome || !cognome || !email || !password) {
    throw new AppError(400, 'Tutti i campi sono obbligatori.');
  }
  if (nome.length > 50 || cognome.length > 50) {
    throw new AppError(400, 'Nome e cognome possono avere al massimo 50 caratteri.');
  }
  if (!emailValida(email)) {
    throw new AppError(400, 'Indirizzo email non valido.');
  }
  if (password.length < LUNGHEZZA_MIN_PASSWORD) {
    throw new AppError(400, `La password deve contenere almeno ${LUNGHEZZA_MIN_PASSWORD} caratteri.`);
  }
  if (Buffer.byteLength(password, 'utf8') > BYTE_MAX_PASSWORD) {
    throw new AppError(400, `La password non può superare ${BYTE_MAX_PASSWORD} byte.`);
  }
  return { nome, cognome, email, password };
}

// ==========================================================
// POST /api/auth/register
// Registra un cliente. I primi N iscritti (N = soglia, 5) sono abilitati
// all'acquisto e ricevono un codice di prelazione univoco.
// ==========================================================
exports.register = async (req, res) => {
  const dati = validaRegistrazione(req.body ?? {});
  // L'hashing è lento di proposito: lo si fa PRIMA di prendere il lock,
  // per non tenere bloccate le altre registrazioni.
  const hash = await bcrypt.hash(dati.password, BCRYPT_ROUNDS);

  const conn = await db.getConnection();
  let lockPreso = false;
  try {
    // Sezione critica "conta gli iscritti -> decidi l'abilitazione -> inserisci":
    // senza lock due registrazioni simultanee leggerebbero lo stesso conteggio
    // e supererebbero entrambe la soglia. GET_LOCK la rende atomica.
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 10) AS ottenuto', [LOCK_REGISTRAZIONE]);
    if (Number(lock.ottenuto) !== 1) {
      throw new AppError(503, 'Server momentaneamente occupato, riprova tra qualche istante.');
    }
    lockPreso = true;

    const [esistente] = await conn.query('SELECT 1 FROM utenti WHERE email = ? LIMIT 1', [dati.email]);
    if (esistente.length > 0) {
      throw new AppError(409, 'Email già registrata.');
    }

    // Il conteggio riguarda solo i clienti: l'amministratore non occupa un posto
    const [[{ totale }]] = await conn.query(
      "SELECT COUNT(*) AS totale FROM utenti WHERE ruolo = 'cliente'"
    );
    const abilitato = Number(totale) < config.business.sogliaPrimiIscritti;

    let risultato;
    let codice = null;
    for (let tentativo = 0; tentativo < 5; tentativo++) {
      codice = abilitato ? generaCodiceAccesso() : null;
      try {
        [risultato] = await conn.query(
          `INSERT INTO utenti (nome, cognome, email, password, codice_accesso, abilitato, ruolo)
           VALUES (?, ?, ?, ?, ?, ?, 'cliente')`,
          [dati.nome, dati.cognome, dati.email, hash, codice, abilitato ? 1 : 0]
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
        if (String(err.sqlMessage).includes('email')) {
          throw new AppError(409, 'Email già registrata.');
        }
        // collisione (rarissima) sul codice: se ne genera un altro
        if (tentativo === 4) throw err;
      }
    }

    res.status(201).json({
      message: 'Registrazione completata con successo!',
      utente: {
        id_utente: risultato.insertId,
        nome: dati.nome,
        cognome: dati.cognome,
        email: dati.email,
        ruolo: 'cliente',
        abilitato,
        codice_accesso: codice,
      },
    });
  } finally {
    if (lockPreso) {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_REGISTRAZIONE]).catch(() => {});
    }
    conn.release();
  }
};

// Verifica la password. Gli account creati nelle prime giornate possono avere
// ancora la password in chiaro: in quel caso il confronto avviene a tempo
// costante e, se corretta, viene subito convertita in hash bcrypt.
async function passwordCorretta(utente, password) {
  if (!utente) {
    await bcrypt.compare(password, HASH_CIVETTA);
    return false;
  }

  if (utente.password.startsWith('$2')) {
    try {
      return await bcrypt.compare(password, utente.password);
    } catch {
      return false;
    }
  }

  const a = Buffer.from(utente.password);
  const b = Buffer.from(password);
  const uguali = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (uguali) {
    const nuovoHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.query('UPDATE utenti SET password = ? WHERE id_utente = ?', [
      nuovoHash,
      utente.id_utente,
    ]);
  }
  return uguali;
}

// ==========================================================
// POST /api/auth/login  ->  { token, utente }
// ==========================================================
exports.login = async (req, res) => {
  const body = req.body ?? {};
  const email = normalizzaEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    throw new AppError(400, 'Email e password sono obbligatorie.');
  }

  const [righe] = await db.query('SELECT * FROM utenti WHERE email = ?', [email]);
  const utente = righe[0];

  if (!(await passwordCorretta(utente, password))) {
    throw new AppError(401, 'Credenziali non valide.');
  }

  const token = jwt.sign(
    { id_utente: utente.id_utente, email: utente.email, ruolo: utente.ruolo },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.json({
    message: 'Login effettuato con successo!',
    token,
    utente: serializzaUtente(utente),
  });
};

// ==========================================================
// GET /api/auth/me  ->  dati aggiornati dell'utente del token
// Il client lo usa per riallineare la sessione (abilitazione, ruolo)
// con lo stato reale presente nel database.
// ==========================================================
exports.me = async (req, res) => {
  const [righe] = await db.query(
    `SELECT id_utente, nome, cognome, email, ruolo, abilitato, codice_accesso
     FROM utenti WHERE id_utente = ?`,
    [req.user.id_utente]
  );
  if (righe.length === 0) {
    throw new AppError(401, 'Account non più esistente.');
  }
  res.json({ utente: serializzaUtente(righe[0]) });
};

// Giornata 3 - Registrazione, regola dei primi N iscritti, login e JWT.
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const T = require('./helpers/ambiente');

let ctx;
before(async () => {
  ctx = await T.avvia();
});
after(async () => {
  await ctx.chiudi();
});
beforeEach(async () => {
  await T.pulisci();
});

const reg = (i, extra = {}) => ({
  nome: `Nome${i}`,
  cognome: `Cognome${i}`,
  email: `Utente${i}@Esempio.it`,
  password: 'password-lunga-1',
  ...extra,
});

describe('registrazione - validazione', () => {
  it('rifiuta campi mancanti', async () => {
    const r = await ctx.chiama('POST', '/auth/register', { body: { nome: 'Solo nome' } });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /obbligatori/);
  });

  it('non va in errore 500 se il body non è JSON (req.body undefined in Express 5)', async () => {
    const r = await ctx.chiama('POST', '/auth/register', {
      grezzo: 'nome=Mario',
      intestazioni: { 'Content-Type': 'text/plain' },
    });
    assert.equal(r.status, 400);
  });

  it('JSON malformato -> 400 in JSON', async () => {
    const r = await ctx.chiama('POST', '/auth/register', {
      grezzo: '{"nome": ',
      intestazioni: { 'Content-Type': 'application/json' },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /JSON/);
  });

  it('rifiuta email non valida, password corta o troppo lunga, nomi eccessivi', async () => {
    const casi = [
      [{ email: 'non-una-email' }, /email/i],
      [{ password: 'corta' }, /almeno 8/],
      [{ password: 'x'.repeat(73) }, /72/],
      [{ nome: 'N'.repeat(51) }, /50/],
      [{ nome: { $ne: null } }, /obbligatori/], // tipo errato (oggetto)
      [{ password: 12345678 }, /obbligatori/], // tipo errato (numero)
    ];
    for (const [extra, atteso] of casi) {
      const r = await ctx.chiama('POST', '/auth/register', { body: reg(1, extra) });
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.match(r.body.error, atteso);
    }
  });
});

describe('registrazione - regola dei primi 5 iscritti', () => {
  it('abilita e assegna un codice univoco ai primi 5 CLIENTI (l\'admin non conta)', async () => {
    const codici = new Set();
    for (let i = 1; i <= 5; i++) {
      const r = await ctx.chiama('POST', '/auth/register', { body: reg(i) });
      assert.equal(r.status, 201);
      assert.equal(r.body.utente.abilitato, true, `iscritto ${i} deve essere abilitato`);
      assert.match(r.body.utente.codice_accesso, /^TICKET-[0-9A-F]{6}$/);
      assert.equal(r.body.utente.ruolo, 'cliente');
      assert.equal(r.body.utente.password, undefined, 'la password non deve mai tornare al client');
      codici.add(r.body.utente.codice_accesso);
    }
    assert.equal(codici.size, 5, 'i codici devono essere tutti diversi');

    const sesto = await ctx.chiama('POST', '/auth/register', { body: reg(6) });
    assert.equal(sesto.status, 201);
    assert.equal(sesto.body.utente.abilitato, false);
    assert.equal(sesto.body.utente.codice_accesso, null);
  });

  it('con 12 registrazioni SIMULTANEE gli abilitati sono esattamente 5', async () => {
    const risposte = await Promise.all(
      Array.from({ length: 12 }, (_, i) => ctx.chiama('POST', '/auth/register', { body: reg(i + 1) }))
    );
    assert.ok(risposte.every((r) => r.status === 201), 'tutte le registrazioni devono riuscire');
    const abilitati = risposte.filter((r) => r.body.utente.abilitato);
    assert.equal(abilitati.length, 5);
    const codici = new Set(abilitati.map((r) => r.body.utente.codice_accesso));
    assert.equal(codici.size, 5);

    const [righe] = await T.db.query(
      "SELECT COUNT(*) AS n FROM utenti WHERE ruolo='cliente' AND abilitato=1 AND codice_accesso IS NOT NULL"
    );
    assert.equal(Number(righe[0].n), 5);
  });

  it('rifiuta email duplicata (anche con maiuscole diverse) con 409', async () => {
    assert.equal((await ctx.chiama('POST', '/auth/register', { body: reg(1) })).status, 201);
    const r = await ctx.chiama('POST', '/auth/register', {
      body: reg(1, { email: 'UTENTE1@esempio.IT' }),
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /già registrata/);
  });

  it('non permette di registrarsi con l\'email dell\'admin né di auto-assegnarsi privilegi', async () => {
    const dup = await ctx.chiama('POST', '/auth/register', {
      body: reg(1, { email: 'admin@concerto.it' }),
    });
    assert.equal(dup.status, 409);

    // mass assignment: i campi extra vengono ignorati
    for (let i = 1; i <= 5; i++) await ctx.chiama('POST', '/auth/register', { body: reg(i) });
    const r = await ctx.chiama('POST', '/auth/register', {
      body: reg(99, { ruolo: 'admin', abilitato: true, codice_accesso: 'TICKET-HACK00' }),
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.utente.ruolo, 'cliente');
    assert.equal(r.body.utente.abilitato, false);
    assert.equal(r.body.utente.codice_accesso, null);
  });

  it('salva la password con hash bcrypt', async () => {
    await ctx.chiama('POST', '/auth/register', { body: reg(1) });
    const [righe] = await T.db.query('SELECT password FROM utenti WHERE email = ?', ['utente1@esempio.it']);
    assert.match(righe[0].password, /^\$2[aby]\$10\$/);
    assert.notEqual(righe[0].password, 'password-lunga-1');
  });
});

describe('login', () => {
  it('accetta credenziali corrette (email case-insensitive) e restituisce token + utente', async () => {
    await ctx.chiama('POST', '/auth/register', { body: reg(1) });
    const r = await ctx.chiama('POST', '/auth/login', {
      body: { email: '  UTENTE1@esempio.it ', password: 'password-lunga-1' },
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.utente.email, 'utente1@esempio.it');
    assert.equal(r.body.utente.abilitato, true);
    assert.equal(r.body.utente.password, undefined);

    const payload = jwt.verify(r.body.token, T.config.jwt.secret);
    assert.equal(payload.ruolo, 'cliente');
    assert.ok(payload.exp - payload.iat <= 24 * 3600);
  });

  it('rifiuta password errata ed email inesistente con lo stesso messaggio', async () => {
    await ctx.chiama('POST', '/auth/register', { body: reg(1) });
    const a = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'utente1@esempio.it', password: 'sbagliata!!' },
    });
    const b = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'nessuno@esempio.it', password: 'password-lunga-1' },
    });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error);
  });

  it('campi mancanti o di tipo errato -> 400', async () => {
    assert.equal((await ctx.chiama('POST', '/auth/login', { body: {} })).status, 400);
    assert.equal(
      (await ctx.chiama('POST', '/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } })).status,
      400
    );
  });

  it('resiste ai tentativi di SQL injection', async () => {
    await ctx.chiama('POST', '/auth/register', { body: reg(1) });
    const tentativi = [
      { email: "' OR '1'='1", password: "' OR '1'='1" },
      { email: "utente1@esempio.it' --", password: 'x' },
      { email: "x'; DROP TABLE utenti; --", password: 'x' },
    ];
    for (const body of tentativi) {
      const r = await ctx.chiama('POST', '/auth/login', { body });
      assert.ok([400, 401].includes(r.status), `status inatteso ${r.status} per ${body.email}`);
      assert.equal(r.body.token, undefined);
    }
    const [righe] = await T.db.query('SELECT COUNT(*) AS n FROM utenti');
    assert.ok(Number(righe[0].n) >= 2, 'la tabella utenti deve essere integra');
  });

  it('converte in hash le password salvate in chiaro (account delle prime giornate)', async () => {
    const [r1] = await T.db.query(
      `INSERT INTO utenti (nome, cognome, email, password, abilitato, ruolo)
       VALUES ('Vecchio','Account','vecchio@test.it','in-chiaro-123',0,'cliente')`
    );
    const ko = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'vecchio@test.it', password: 'in-chiaro-124' },
    });
    assert.equal(ko.status, 401);

    const ok = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'vecchio@test.it', password: 'in-chiaro-123' },
    });
    assert.equal(ok.status, 200);
    const [righe] = await T.db.query('SELECT password FROM utenti WHERE id_utente = ?', [r1.insertId]);
    assert.match(righe[0].password, /^\$2[aby]\$/);

    // dopo l'upgrade il login continua a funzionare
    const ancora = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'vecchio@test.it', password: 'in-chiaro-123' },
    });
    assert.equal(ancora.status, 200);
  });

  it("l'admin di test (hash bcrypt nello schema) può accedere ed ha ruolo admin", async () => {
    const r = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'admin@concerto.it', password: 'admin123' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.utente.ruolo, 'admin');
    assert.equal(r.body.utente.abilitato, false);
  });
});

describe('token JWT e /auth/me', () => {
  it('senza token -> 401; token manomesso, scaduto o firmato con altra chiave -> 401', async () => {
    const u = await T.creaUtente();
    assert.equal((await ctx.chiama('GET', '/auth/me')).status, 401);
    assert.equal((await ctx.chiama('GET', '/auth/me', { token: 'abc.def.ghi' })).status, 401);

    const scaduto = T.tokenPer(u, { expiresIn: -10 });
    assert.equal((await ctx.chiama('GET', '/auth/me', { token: scaduto })).status, 401);

    const altraChiave = T.tokenPer(u, {}, 'un-altro-segreto');
    assert.equal((await ctx.chiama('GET', '/auth/me', { token: altraChiave })).status, 401);

    // token con alg "none" (attacco classico)
    const intestazione = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const corpo = Buffer.from(JSON.stringify({ id_utente: u.id_utente, ruolo: 'admin' })).toString('base64url');
    assert.equal(
      (await ctx.chiama('GET', '/auth/me', { token: `${intestazione}.${corpo}.` })).status,
      401
    );

    // manomissione del payload: la firma non corrisponde più
    const [h, , s] = u.token.split('.');
    const falso = Buffer.from(JSON.stringify({ id_utente: u.id_utente, ruolo: 'admin' })).toString('base64url');
    assert.equal((await ctx.chiama('GET', '/auth/me', { token: `${h}.${falso}.${s}` })).status, 401);
  });

  it('/auth/me restituisce lo stato reale del database', async () => {
    const u = await T.creaUtente({ abilitato: false });
    let r = await ctx.chiama('GET', '/auth/me', { token: u.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.utente.abilitato, false);

    await T.db.query('UPDATE utenti SET abilitato = 1, codice_accesso = ? WHERE id_utente = ?', [
      'TICKET-ABC123',
      u.id_utente,
    ]);
    r = await ctx.chiama('GET', '/auth/me', { token: u.token });
    assert.equal(r.body.utente.abilitato, true);
    assert.equal(r.body.utente.codice_accesso, 'TICKET-ABC123');
  });

  it('/auth/me con utente cancellato -> 401', async () => {
    const u = await T.creaUtente();
    await T.db.query('DELETE FROM utenti WHERE id_utente = ?', [u.id_utente]);
    assert.equal((await ctx.chiama('GET', '/auth/me', { token: u.token })).status, 401);
  });
});

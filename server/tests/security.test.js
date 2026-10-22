// Giornata 9 - Test di sicurezza: bypass degli URL protetti, input ostili, intestazioni.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const T = require('./helpers/ambiente');

let ctx;
before(async () => {
  ctx = await T.avvia();
  await T.pulisci();
});
after(async () => {
  await ctx.chiudi();
});

describe('accesso diretto alle rotte protette (bypass URL)', () => {
  const protette = [
    ['GET', '/auth/me'],
    ['POST', '/ordini'],
    ['GET', '/ordini/miei'],
    ['GET', '/admin/statistiche'],
  ];

  for (const [metodo, percorso] of protette) {
    it(`${metodo} /api${percorso} senza credenziali -> 401`, async () => {
      const r = await ctx.chiama(metodo, percorso, metodo === 'POST' ? { body: {} } : {});
      assert.equal(r.status, 401);
    });
  }

  it('intestazioni Authorization malformate non passano', async () => {
    const u = await T.creaUtente();
    for (const valore of ['', 'Bearer', 'Bearer ', 'Basic ' + u.token, u.token, 'Bearer a b c']) {
      const r = await ctx.chiama('GET', '/auth/me', { intestazioni: { Authorization: valore } });
      assert.equal(r.status, 401, `Authorization: "${valore.slice(0, 20)}"`);
    }
  });

  it('schema "bearer" in minuscolo è accettato (RFC 7235: case-insensitive)', async () => {
    const u = await T.creaUtente();
    const r = await ctx.chiama('GET', '/auth/me', { intestazioni: { Authorization: `bearer ${u.token}` } });
    assert.equal(r.status, 200);
  });
});

describe('input ostili', () => {
  it('payload di injection non causano errori 500 né modificano i dati', async () => {
    const veleni = [
      "'; DROP TABLE utenti; --",
      '" OR ""="',
      '<script>alert(1)</script>',
      '\u0000',
      '${7*7}',
      '{"$ne": null}',
    ];
    for (const v of veleni) {
      const r = await ctx.chiama('POST', '/auth/register', {
        body: { nome: v, cognome: v, email: `x${Math.random()}@t.it`, password: 'password-lunga-1' },
      });
      assert.ok([201, 400].includes(r.status), `status ${r.status} per ${JSON.stringify(v)}`);
    }
    const [righe] = await T.db.query('SELECT COUNT(*) AS n FROM utenti');
    assert.ok(Number(righe[0].n) >= 1, 'tabella utenti ancora presente');
    // il testo ostile viene salvato come semplice testo (l'escaping HTML spetta a React)
    const [nomi] = await T.db.query("SELECT nome FROM utenti WHERE nome LIKE '%DROP TABLE%'");
    assert.ok(nomi.length >= 1);
  });

  it('body oltre il limite di 10 KB -> 413', async () => {
    const r = await ctx.chiama('POST', '/auth/login', {
      body: { email: 'a@b.it', password: 'x'.repeat(20000) },
    });
    assert.equal(r.status, 413);
  });

  it('la password non compare mai nelle risposte', async () => {
    const u = await T.creaUtente();
    const r = await ctx.chiama('GET', '/auth/me', { token: u.token });
    assert.doesNotMatch(JSON.stringify(r.body), /password|\$2[aby]\$/i);
    const l = await ctx.chiama('POST', '/auth/login', {
      body: { email: u.email, password: u.password },
    });
    assert.doesNotMatch(JSON.stringify(l.body), /\$2[aby]\$/);
  });
});

describe('intestazioni e CORS', () => {
  it('invia intestazioni di sicurezza e non rivela Express', async () => {
    const r = await ctx.chiama('GET', '/settori');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-powered-by'), null);
  });

  it('risponde alla preflight CORS dal client di sviluppo', async () => {
    const r = await ctx.chiama('OPTIONS', '/ordini', {
      intestazioni: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.ok(r.status === 204 || r.status === 200);
    assert.ok(r.headers.get('access-control-allow-origin'));
    assert.match(r.headers.get('access-control-allow-headers') || '', /authorization/i);
  });
});

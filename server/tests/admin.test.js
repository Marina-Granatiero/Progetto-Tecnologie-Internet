// Giornata 7/9 - Dashboard amministratore: protezione degli endpoint e correttezza delle statistiche.
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
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

const ordina = (utente, id_settore, quantita) =>
  ctx.chiama('POST', '/ordini', { token: utente.token, body: { id_settore, quantita } });
const statistiche = async () => {
  const token = await T.loginAdmin(ctx.chiama);
  return ctx.chiama('GET', '/admin/statistiche', { token });
};

describe('protezione di /api/admin', () => {
  it('senza token -> 401', async () => {
    assert.equal((await ctx.chiama('GET', '/admin/statistiche')).status, 401);
  });

  it('un cliente (anche abilitato) -> 403', async () => {
    const u = await T.creaUtente({ abilitato: true });
    const r = await ctx.chiama('GET', '/admin/statistiche', { token: u.token });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /amministratore/);
  });

  it('un token che si dichiara admin ma appartiene a un cliente viene respinto (ruolo riletto dal DB)', async () => {
    const u = await T.creaUtente();
    const finto = T.tokenPer({ ...u, ruolo: 'admin' }); // firmato col segreto giusto, ma il DB dice "cliente"
    const r = await ctx.chiama('GET', '/admin/statistiche', { token: finto });
    assert.equal(r.status, 403);
  });

  it('token firmato con un altro segreto -> 401', async () => {
    const finto = T.tokenPer({ id_utente: 1, email: 'admin@concerto.it', ruolo: 'admin' }, {}, 'altro');
    assert.equal((await ctx.chiama('GET', '/admin/statistiche', { token: finto })).status, 401);
  });

  it('un admin retrocesso perde subito l\'accesso anche con un token ancora valido', async () => {
    const token = await T.loginAdmin(ctx.chiama);
    assert.equal((await ctx.chiama('GET', '/admin/statistiche', { token })).status, 200);
    await T.db.query("UPDATE utenti SET ruolo = 'cliente' WHERE email = 'admin@concerto.it'");
    try {
      assert.equal((await ctx.chiama('GET', '/admin/statistiche', { token })).status, 403);
    } finally {
      await T.db.query("UPDATE utenti SET ruolo = 'admin' WHERE email = 'admin@concerto.it'");
    }
  });

  it('rotte admin inesistenti non rivelano nulla ai non autorizzati', async () => {
    const u = await T.creaUtente();
    assert.equal((await ctx.chiama('GET', '/admin/qualcosa', { token: u.token })).status, 403);
  });
});

describe('statistiche', () => {
  it('a database vuoto restituisce zeri e sistema integro', async () => {
    const r = await statistiche();
    assert.equal(r.status, 200);
    assert.deepEqual(
      [r.body.biglietti.biglietti_per_se, r.body.biglietti.biglietti_per_altri, r.body.biglietti.totale_venduti],
      [0, 0, 0]
    );
    assert.equal(r.body.audit_sentinella, 0);
    assert.equal(r.body.audit.integro, true);
    assert.equal(r.body.utenti.totale_iscritti, 0);
    assert.equal(r.body.settori.length, 3);
    assert.equal(r.body.incasso.totale, '0.00');
    assert.deepEqual(r.body.ordini_recenti, []);
    assert.equal(r.body.biglietti.acquirenti_per_quantita.length, 4);
  });

  it('calcola correttamente per sé vs accompagnatori, incassi e abilitati', async () => {
    const a = await T.creaUtente(); // compra 4 (1 per sé + 3 accompagnatori)
    const b = await T.creaUtente(); // compra 2 (1 + 1)
    const c = await T.creaUtente(); // compra 1 (1 + 0)
    await T.creaUtente({ abilitato: false }); // iscritto non abilitato

    assert.equal((await ordina(a, 1, 4)).status, 201); // 4 x 120 = 480
    assert.equal((await ordina(b, 2, 1)).status, 201);
    assert.equal((await ordina(b, 3, 1)).status, 201); // 85 + 55
    assert.equal((await ordina(c, 3, 1)).status, 201); // 55

    const r = await statistiche();
    const s = r.body;
    assert.equal(s.biglietti.totale_venduti, 7);
    assert.equal(s.biglietti.biglietti_per_se, 3);
    assert.equal(s.biglietti.biglietti_per_altri, 4);
    assert.deepEqual(
      s.biglietti.acquirenti_per_quantita.map((x) => x.acquirenti),
      [1, 1, 0, 1] // un acquirente con 1, uno con 2, nessuno con 3, uno con 4
    );

    const pit = s.settori.find((x) => x.id_settore === 1);
    assert.equal(pit.biglietti_venduti, 4);
    assert.equal(pit.biglietti_rimasti, 46);
    assert.equal(Number(pit.incasso_settore), 480);
    assert.equal(s.incasso.totale, '675.00'); // 480 + 85 + 55 + 55
    assert.equal(s.incasso.ordini, 4);

    assert.equal(s.utenti.totale_iscritti, 4);
    assert.equal(s.utenti.utenti_abilitati, 3);
    assert.equal(s.audit.integro, true);

    assert.equal(s.ordini_recenti.length, 4);
    assert.equal(s.ordini_recenti[0].quantita, 1); // il più recente è quello di "c"
    assert.equal(s.elenco_utenti.length, 4);
    assert.equal(s.elenco_utenti.find((u) => u.email === a.email).biglietti, 4);
  });
});

describe('sentinella di audit', () => {
  it('rileva biglietti venduti a un utente NON abilitato (inserimento fuori dall\'applicazione)', async () => {
    const abusivo = await T.creaUtente({ abilitato: false });
    const [o] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 120)', [abusivo.id_utente]);
    await T.db.query('INSERT INTO dettaglio_ordini VALUES (?, 1)', [o.insertId]);
    await T.db.query('UPDATE biglietti SET venduto = 1 WHERE id_biglietto = 1');

    const r = await statistiche();
    assert.equal(r.body.audit_sentinella, 1);
    assert.equal(r.body.audit.acquisti_non_autorizzati, 1);
    assert.equal(r.body.audit.integro, false);
  });

  it('rileva biglietti "venduti" senza ordine e ordini su biglietti rimasti invenduti', async () => {
    const u = await T.creaUtente();
    await T.db.query('UPDATE biglietti SET venduto = 1 WHERE id_biglietto IN (1, 2)'); // senza ordine
    const [o] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 120)', [u.id_utente]);
    await T.db.query('INSERT INTO dettaglio_ordini VALUES (?, 3)', [o.insertId]); // venduto resta 0

    const r = await statistiche();
    assert.equal(r.body.audit.biglietti_incoerenti, 3);
    assert.equal(r.body.audit.integro, false);
  });

  it('rileva overbooking e utenti oltre il limite (se il trigger fosse stato rimosso)', async () => {
    await T.db.query('DROP TRIGGER IF EXISTS trg_limite_biglietti');
    const u = await T.creaUtente();
    const [o] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 600)', [u.id_utente]);
    for (let id = 1; id <= 5; id++) {
      await T.db.query('INSERT INTO dettaglio_ordini VALUES (?, ?)', [o.insertId, id]);
      await T.db.query('UPDATE biglietti SET venduto = 1 WHERE id_biglietto = ?', [id]);
    }
    await T.db.query('UPDATE settori SET capacita_max = 4 WHERE id_settore = 1');

    const r = await statistiche();
    assert.equal(r.body.audit.utenti_oltre_limite, 1);
    assert.equal(r.body.audit.settori_overbooking, 1);
    assert.equal(r.body.audit.integro, false);
    // questo è l'ultimo test del file: il database di test viene ricreato al prossimo avvio
  });
});

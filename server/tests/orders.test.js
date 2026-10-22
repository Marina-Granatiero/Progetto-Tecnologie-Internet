// Giornata 4/6/9 - Acquisto biglietti: validazione, limite antiscalping, esaurimento,
// atomicità della transazione e difese a livello di database.
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

describe('accesso alla rotta di acquisto (tentativi di bypass)', () => {
  it('senza token -> 401', async () => {
    const r = await ctx.chiama('POST', '/ordini', { body: { id_settore: 1, quantita: 1 } });
    assert.equal(r.status, 401);
  });

  it('token non valido -> 401', async () => {
    const r = await ctx.chiama('POST', '/ordini', { token: 'x.y.z', body: { id_settore: 1, quantita: 1 } });
    assert.equal(r.status, 401);
  });

  it('utente registrato ma NON abilitato -> 403 e nessun biglietto venduto', async () => {
    const u = await T.creaUtente({ abilitato: false });
    const r = await ordina(u, 1, 1);
    assert.equal(r.status, 403);
    assert.equal(await T.contaVenduti(1), 0);
  });

  it("l'abilitazione è letta dal database, non dal token: un token 'vecchio' non basta", async () => {
    const u = await T.creaUtente({ abilitato: true });
    await T.db.query('UPDATE utenti SET abilitato = 0 WHERE id_utente = ?', [u.id_utente]);
    assert.equal((await ordina(u, 1, 1)).status, 403);
  });

  it("l'amministratore non può acquistare", async () => {
    const admin = await T.creaUtente({ abilitato: false, ruolo: 'admin' });
    assert.equal((await ordina(admin, 1, 1)).status, 403);
  });

  it('utente cancellato con token ancora valido -> 401', async () => {
    const u = await T.creaUtente();
    await T.db.query('DELETE FROM utenti WHERE id_utente = ?', [u.id_utente]);
    assert.equal((await ordina(u, 1, 1)).status, 401);
  });
});

describe('validazione del payload', () => {
  it('rifiuta quantità e settori non validi (senza errori 500)', async () => {
    const u = await T.creaUtente();
    const casi = [
      { id_settore: 1 }, // manca la quantità
      { quantita: 1 }, // manca il settore
      { id_settore: 1, quantita: 0 },
      { id_settore: 1, quantita: -2 },
      { id_settore: 1, quantita: 5 },
      { id_settore: 1, quantita: 1.5 },
      { id_settore: 1, quantita: 'abc' },
      { id_settore: 1, quantita: '2; DROP TABLE biglietti' },
      { id_settore: 1, quantita: null },
      { id_settore: 1, quantita: [1] },
      { id_settore: 1, quantita: true },
      { id_settore: 0, quantita: 1 },
      { id_settore: -1, quantita: 1 },
      { id_settore: 'uno', quantita: 1 },
      { id_settore: { id_settore: 1 }, quantita: 1 }, // object injection di mysql2
      { id_settore: [1, 2], quantita: 1 },
      { id_settore: '1 OR 1=1', quantita: 1 },
    ];
    for (const body of casi) {
      const r = await ctx.chiama('POST', '/ordini', { token: u.token, body });
      assert.equal(r.status, 400, `atteso 400 per ${JSON.stringify(body)}, ricevuto ${r.status}`);
    }
    assert.equal(await T.contaVenduti(1), 0);
  });

  it('settore inesistente -> 404', async () => {
    const u = await T.creaUtente();
    assert.equal((await ordina(u, 999, 1)).status, 404);
  });

  it('body non JSON -> 400', async () => {
    const u = await T.creaUtente();
    const r = await ctx.chiama('POST', '/ordini', {
      token: u.token,
      grezzo: 'id_settore=1&quantita=1',
      intestazioni: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(r.status, 400);
  });
});

describe('acquisto riuscito', () => {
  it('scala le disponibilità, calcola il totale e registra l\'ordine', async () => {
    const u = await T.creaUtente();
    const prima = await ctx.chiama('GET', '/settori');
    const pit = prima.body.find((s) => s.id_settore === 1);
    assert.equal(pit.biglietti_disponibili, 50);

    const r = await ordina(u, 1, 2);
    assert.equal(r.status, 201);
    assert.equal(r.body.totale, '240.00');
    assert.equal(r.body.biglietti_acquistati, 2);
    assert.equal(r.body.biglietti_rimanenti_utente, 2);

    const dopo = await ctx.chiama('GET', '/settori');
    assert.equal(dopo.body.find((s) => s.id_settore === 1).biglietti_disponibili, 48);
    assert.equal(dopo.body.find((s) => s.id_settore === 2).biglietti_disponibili, 100);

    const miei = await ctx.chiama('GET', '/ordini/miei', { token: u.token });
    assert.equal(miei.body.acquistati, 2);
    assert.equal(miei.body.rimanenti, 2);
    assert.equal(miei.body.limite, 4);
    assert.equal(miei.body.ordini.length, 1);
    assert.equal(miei.body.ordini[0].nome_settore, 'Pit Gold');
    assert.equal(miei.body.ordini[0].quantita, 2);
  });

  it('accetta anche la quantità come stringa numerica (client non-JS)', async () => {
    const u = await T.creaUtente();
    const r = await ordina(u, '3', '2');
    assert.equal(r.status, 201);
    assert.equal(r.body.totale, '110.00');
  });

  it('/ordini/miei richiede autenticazione', async () => {
    assert.equal((await ctx.chiama('GET', '/ordini/miei')).status, 401);
  });
});

describe('limite antiscalping di 4 biglietti per utente', () => {
  it('blocca il superamento cumulativo (3 + 2) e permette il completamento fino a 4', async () => {
    const u = await T.creaUtente();
    assert.equal((await ordina(u, 3, 3)).status, 201);

    const troppi = await ordina(u, 2, 2);
    assert.equal(troppi.status, 409);
    assert.match(troppi.body.error, /al massimo 1/);
    assert.equal(await T.bigliettiDi(u.id_utente), 3, 'l\'ordine respinto non deve lasciare tracce');

    assert.equal((await ordina(u, 1, 1)).status, 201);
    const pieno = await ordina(u, 1, 1);
    assert.equal(pieno.status, 409);
    assert.match(pieno.body.error, /Limite raggiunto/);
    assert.equal(await T.bigliettiDi(u.id_utente), 4);
  });

  it('il limite vale su tutti i settori insieme e per utente (non è globale)', async () => {
    const a = await T.creaUtente();
    const b = await T.creaUtente();
    assert.equal((await ordina(a, 1, 2)).status, 201);
    assert.equal((await ordina(a, 2, 2)).status, 201);
    assert.equal((await ordina(a, 3, 1)).status, 409);
    assert.equal((await ordina(b, 3, 4)).status, 201); // l'altro utente non è influenzato
  });

  it('un acquisto singolo da 5 non passa nemmeno con la quantità spezzata a mano', async () => {
    const u = await T.creaUtente();
    assert.equal((await ordina(u, 1, 5)).status, 400);
    for (let i = 0; i < 4; i++) assert.equal((await ordina(u, 1, 1)).status, 201);
    assert.equal((await ordina(u, 1, 1)).status, 409);
  });
});

describe('disponibilità limitata', () => {
  it('non vende più dei biglietti rimasti e segnala settore esaurito', async () => {
    await T.limitaDisponibilita(2, 1);
    const a = await T.creaUtente();
    const b = await T.creaUtente();

    const due = await ordina(a, 2, 2);
    assert.equal(due.status, 409);
    assert.match(due.body.error, /ne restano solo 1/);

    assert.equal((await ordina(a, 2, 1)).status, 201);
    const esaurito = await ordina(b, 2, 1);
    assert.equal(esaurito.status, 409);
    assert.match(esaurito.body.error, /esaurito/i);
    assert.equal(await T.bigliettiDi(b.id_utente), 0);
  });
});

describe('integrità a livello di database', () => {
  it('atomicità: se un passo della transazione fallisce, NIENTE viene salvato (rollback)', async () => {
    // Situazione incoerente creata ad arte: un biglietto "invenduto" risulta già
    // collegato a un ordine. L'INSERT in dettaglio_ordini fallirà a metà transazione.
    const altro = await T.creaUtente();
    const [o] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 0)', [altro.id_utente]);
    await T.db.query('INSERT INTO dettaglio_ordini (fk_ordine, fk_biglietto) VALUES (?, 1)', [o.insertId]);
    const [primo] = await T.db.query('SELECT venduto FROM biglietti WHERE id_biglietto = 1');
    assert.equal(primo[0].venduto, 0);

    const u = await T.creaUtente();
    const ordiniPrima = (await T.db.query('SELECT COUNT(*) AS n FROM ordini'))[0][0].n;
    const r = await ordina(u, 1, 2); // seleziona i biglietti 1 e 2 -> conflitto sul biglietto 1
    assert.equal(r.status, 500);
    assert.doesNotMatch(JSON.stringify(r.body), /dettaglio_ordini|SQL|Duplicate/i, 'nessun dettaglio interno');

    const ordiniDopo = (await T.db.query('SELECT COUNT(*) AS n FROM ordini'))[0][0].n;
    assert.equal(ordiniDopo, ordiniPrima, "l'ordine parziale deve essere annullato");
    assert.equal(await T.bigliettiDi(u.id_utente), 0);
    const [b2] = await T.db.query('SELECT venduto FROM biglietti WHERE id_biglietto = 2');
    assert.equal(b2[0].venduto, 0, 'il biglietto 2 non deve risultare venduto');
  });

  it('UNIQUE(fk_biglietto): lo stesso biglietto non può stare in due ordini', async () => {
    const u = await T.creaUtente();
    const [o1] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 1)', [u.id_utente]);
    const [o2] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 1)', [u.id_utente]);
    await T.db.query('INSERT INTO dettaglio_ordini VALUES (?, 10)', [o1.insertId]);
    await assert.rejects(T.db.query('INSERT INTO dettaglio_ordini VALUES (?, 10)', [o2.insertId]), {
      code: 'ER_DUP_ENTRY',
    });
  });

  it('trigger antiscalping: nemmeno un INSERT diretto può superare i 4 biglietti', async () => {
    const u = await T.creaUtente();
    const [o] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 1)', [u.id_utente]);
    for (let id = 1; id <= 4; id++) {
      await T.db.query('INSERT INTO dettaglio_ordini VALUES (?, ?)', [o.insertId, id]);
    }
    await assert.rejects(T.db.query('INSERT INTO dettaglio_ordini VALUES (?, 5)', [o.insertId]), {
      sqlState: '45000',
      message: /Limite antiscalping/,
    });
    // vale anche spezzando su un secondo ordine
    const [o2] = await T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (?, 1)', [u.id_utente]);
    await assert.rejects(T.db.query('INSERT INTO dettaglio_ordini VALUES (?, 6)', [o2.insertId]), {
      sqlState: '45000',
    });
  });

  it('vincolo FK: ordine per utente inesistente rifiutato', async () => {
    await assert.rejects(T.db.query('INSERT INTO ordini (fk_utente, totale) VALUES (987654, 1)'), {
      code: 'ER_NO_REFERENCED_ROW_2',
    });
  });
});

describe('settori e regole pubbliche', () => {
  it('/settori espone disponibilità e prezzi', async () => {
    const r = await ctx.chiama('GET', '/settori');
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.body.map((s) => [s.nome_settore, Number(s.prezzo), s.capacita_max, s.biglietti_disponibili]),
      [
        ['Pit Gold', 120, 50, 50],
        ['Tribuna Numerata', 85, 100, 100],
        ['Prato', 55, 200, 200],
      ]
    );
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });

  it('/regole espone soglia, limite e codici già assegnati', async () => {
    let r = await ctx.chiama('GET', '/regole');
    assert.deepEqual(r.body, { soglia_primi_iscritti: 5, max_biglietti_per_utente: 4, codici_assegnati: 0 });
    await T.creaUtente();
    await T.creaUtente();
    await T.creaUtente({ abilitato: false });
    r = await ctx.chiama('GET', '/regole');
    assert.equal(r.body.codici_assegnati, 2);
  });

  it('/health e rotta inesistente in JSON', async () => {
    const h = await ctx.chiama('GET', '/health');
    assert.equal(h.status, 200);
    assert.equal(h.body.status, 'ok');
    const nf = await ctx.chiama('GET', '/non-esiste');
    assert.equal(nf.status, 404);
    assert.ok(nf.body.error);
  });
});

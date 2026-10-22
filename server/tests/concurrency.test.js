// Giornata 9 - Simulazione di acquisti simultanei (race condition, overbooking, antiscalping).
// Le richieste partono tutte insieme con Promise.all: se i lock di MySQL non funzionassero
// queste verifiche fallirebbero (più di 4 biglietti per utente, biglietti venduti due volte...).
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

const conta = (risposte, status) => risposte.filter((r) => r.status === status).length;

async function controllaInvarianti() {
  // 1. nessun utente oltre il limite
  const [oltre] = await T.db.query(
    `SELECT o.fk_utente, COUNT(*) AS n FROM ordini o
     JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
     GROUP BY o.fk_utente HAVING n > 4`
  );
  assert.equal(oltre.length, 0, 'un utente ha più di 4 biglietti');

  // 2. i biglietti marcati come venduti coincidono con quelli presenti negli ordini
  const [[{ venduti }]] = await T.db.query('SELECT COUNT(*) AS venduti FROM biglietti WHERE venduto = 1');
  const [[{ nelDettaglio }]] = await T.db.query('SELECT COUNT(*) AS nelDettaglio FROM dettaglio_ordini');
  assert.equal(Number(venduti), Number(nelDettaglio), 'venduto=1 non coerente con dettaglio_ordini');

  // 3. nessun ordine "vuoto" né totale incoerente
  const [vuoti] = await T.db.query(
    `SELECT o.id_ordine FROM ordini o LEFT JOIN dettaglio_ordini d ON d.fk_ordine = o.id_ordine
     WHERE d.fk_ordine IS NULL`
  );
  assert.equal(vuoti.length, 0, 'ordini senza biglietti');

  // 4. la sentinella dell'admin concorda
  const token = await T.loginAdmin(ctx.chiama);
  const stat = await ctx.chiama('GET', '/admin/statistiche', { token });
  assert.equal(stat.status, 200);
  assert.equal(stat.body.audit.integro, true, JSON.stringify(stat.body.audit));
}

describe('stesso utente, richieste simultanee (antiscalping)', () => {
  it('12 ordini da 1 biglietto lanciati insieme su settori diversi -> ne passano esattamente 4', async () => {
    const u = await T.creaUtente();
    const risposte = await Promise.all(
      Array.from({ length: 12 }, (_, i) => ordina(u, (i % 3) + 1, 1))
    );
    assert.equal(conta(risposte, 201), 4, risposte.map((r) => r.status).join(','));
    assert.equal(conta(risposte, 409), 8);
    assert.equal(await T.bigliettiDi(u.id_utente), 4);
    await controllaInvarianti();
  });

  it('6 ordini da 2 biglietti insieme -> ne passano esattamente 2 (4 biglietti totali)', async () => {
    const u = await T.creaUtente();
    const risposte = await Promise.all(Array.from({ length: 6 }, () => ordina(u, 1, 2)));
    assert.equal(conta(risposte, 201), 2);
    assert.equal(conta(risposte, 409), 4);
    assert.equal(await T.bigliettiDi(u.id_utente), 4);
    await controllaInvarianti();
  });

  it('5 ordini da 4 biglietti insieme -> ne passa uno solo', async () => {
    const u = await T.creaUtente();
    const risposte = await Promise.all(Array.from({ length: 5 }, () => ordina(u, 2, 4)));
    assert.equal(conta(risposte, 201), 1);
    assert.equal(await T.bigliettiDi(u.id_utente), 4);
    await controllaInvarianti();
  });
});

describe('utenti diversi, stessa disponibilità (overbooking)', () => {
  it('20 utenti si contendono gli ultimi 10 biglietti: ne vengono venduti esattamente 10', async () => {
    await T.limitaDisponibilita(1, 10);
    const utenti = await Promise.all(Array.from({ length: 20 }, () => T.creaUtente()));
    const risposte = await Promise.all(utenti.map((u) => ordina(u, 1, 1)));

    assert.equal(conta(risposte, 201), 10, risposte.map((r) => r.status).join(','));
    assert.equal(conta(risposte, 409), 10);
    assert.equal(risposte.filter((r) => ![201, 409].includes(r.status)).length, 0, 'errori inattesi');
    assert.equal(await T.contaVenduti(1), 10);
    const settori = await ctx.chiama('GET', '/settori');
    assert.equal(settori.body.find((s) => s.id_settore === 1).biglietti_disponibili, 0);
    await controllaInvarianti();
  });

  it('8 utenti chiedono 2 biglietti, ne restano 5: ne passano 2 ordini (4 biglietti), mai oltre la capienza', async () => {
    await T.limitaDisponibilita(3, 5);
    const utenti = await Promise.all(Array.from({ length: 8 }, () => T.creaUtente()));
    const risposte = await Promise.all(utenti.map((u) => ordina(u, 3, 2)));

    assert.equal(conta(risposte, 201), 2);
    assert.equal(conta(risposte, 409), 6);
    const [[{ liberi }]] = await T.db.query(
      'SELECT COUNT(*) AS liberi FROM biglietti WHERE fk_settore = 3 AND venduto = 0'
    );
    assert.equal(Number(liberi), 1);
    await controllaInvarianti();
  });

  it('nessun biglietto viene assegnato a due ordini diversi', async () => {
    const utenti = await Promise.all(Array.from({ length: 25 }, () => T.creaUtente()));
    const risposte = await Promise.all(utenti.map((u) => ordina(u, 1, 2)));
    assert.equal(conta(risposte, 201), 25);
    const [dup] = await T.db.query(
      'SELECT fk_biglietto FROM dettaglio_ordini GROUP BY fk_biglietto HAVING COUNT(*) > 1'
    );
    assert.equal(dup.length, 0);
    assert.equal(await T.contaVenduti(1), 50);
    await controllaInvarianti();
  });
});

describe('stress misto', () => {
  it('60 utenti, ordini casuali ripetuti e simultanei: gli invarianti restano veri', async () => {
    await T.limitaDisponibilita(1, 30); // il Pit Gold si esaurisce durante il test
    const utenti = await Promise.all(Array.from({ length: 60 }, () => T.creaUtente()));

    // ogni utente lancia 3 ordini in parallelo con settore e quantità casuali
    const richieste = utenti.flatMap((u) =>
      Array.from({ length: 3 }, () => {
        const settore = 1 + Math.floor(Math.random() * 3);
        const quantita = 1 + Math.floor(Math.random() * 4);
        return ordina(u, settore, quantita).then((r) => ({ utente: u, settore, quantita, r }));
      })
    );
    const esiti = await Promise.all(richieste);

    const imprevisti = esiti.filter(({ r }) => ![201, 409].includes(r.status));
    assert.equal(imprevisti.length, 0, `risposte inattese: ${JSON.stringify(imprevisti.slice(0, 3))}`);

    // quanto dichiarato venduto dalle API coincide con il database
    const attesiPerSettore = { 1: 0, 2: 0, 3: 0 };
    for (const { settore, quantita, r } of esiti) if (r.status === 201) attesiPerSettore[settore] += quantita;
    assert.equal(await T.contaVenduti(1), attesiPerSettore[1]);
    assert.equal(await T.contaVenduti(2), attesiPerSettore[2]);
    assert.equal(await T.contaVenduti(3), attesiPerSettore[3]);

    // nessun utente oltre 4, sempre il numero giusto di biglietti per chi ha comprato
    for (const u of utenti) assert.ok((await T.bigliettiDi(u.id_utente)) <= 4);
    await controllaInvarianti();
  });
});

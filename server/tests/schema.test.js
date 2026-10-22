// Controllo della struttura del database (segnala database vecchi o incompleti all'avvio).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const T = require('./helpers/ambiente');
const { verificaSchema } = require('../utils/verificaSchema');

let ctx;
before(async () => {
  ctx = await T.avvia(); // database appena ricreato da schema.sql
});
after(async () => {
  await ctx.chiudi();
});

describe('verificaSchema', () => {
  it('database creato da schema.sql: nessun problema', async () => {
    assert.deepEqual(await verificaSchema(T.db), []);
  });

  it('segnala una colonna mancante (vecchio database senza "ruolo")', async () => {
    await T.db.query('ALTER TABLE utenti DROP COLUMN ruolo');
    const problemi = await verificaSchema(T.db);
    assert.deepEqual(problemi, ['manca la colonna "utenti.ruolo"']);
  });

  it('segnala una tabella mancante', async () => {
    await T.db.query('RENAME TABLE dettaglio_ordini TO dettaglio_ordini_x');
    const problemi = await verificaSchema(T.db);
    assert.ok(problemi.includes('manca la tabella "dettaglio_ordini"'), problemi.join(' | '));
  });

  it('segnala il trigger mancante', async () => {
    await T.db.query('RENAME TABLE dettaglio_ordini_x TO dettaglio_ordini');
    await T.db.query('DROP TRIGGER trg_limite_biglietti');
    const problemi = await verificaSchema(T.db);
    assert.equal(problemi.length, 2); // anche "ruolo" è ancora mancante
    assert.ok(problemi.some((p) => p.includes('trg_limite_biglietti')));
  });
});

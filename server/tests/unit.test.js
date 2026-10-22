// Test unitari delle funzioni pure (nessun database necessario).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'segreto-test';
const { interoPositivo, emailValida, normalizzaEmail, pulisci } = require('../utils/validators');
const { dividiIstruzioni } = require('../scripts/init-db');

describe('validators', () => {
  it('interoPositivo accetta solo interi positivi (numero o stringa di cifre)', () => {
    assert.equal(interoPositivo(3), 3);
    assert.equal(interoPositivo('12'), 12);
    for (const v of [0, -1, 1.5, '0', '-3', '1.5', '1e3', ' 2', 'abc', null, undefined, true, [], [1], {}, NaN, Infinity, '1234567890']) {
      assert.equal(interoPositivo(v), null, String(JSON.stringify(v)));
    }
  });

  it('email: formato e lunghezza', () => {
    assert.equal(emailValida('mario.rossi@esempio.it'), true);
    for (const e of ['', 'mario', 'mario@', '@esempio.it', 'ma rio@esempio.it', 'a@b', 'a'.repeat(96) + '@x.it']) {
      assert.equal(emailValida(e), false, e);
    }
    assert.equal(normalizzaEmail('  Mario@Esempio.IT '), 'mario@esempio.it');
    assert.equal(normalizzaEmail({}), '');
  });

  it('pulisci ignora i valori non stringa', () => {
    assert.equal(pulisci('  ciao '), 'ciao');
    assert.equal(pulisci(5), '');
    assert.equal(pulisci(null), '');
  });
});

describe('parser dello script SQL', () => {
  it('rispetta DELIMITER e salta i commenti', () => {
    const sql = [
      '-- commento',
      'CREATE TABLE a (x int);',
      '',
      'INSERT INTO a VALUES (1),',
      '(2);',
      'DELIMITER //',
      'CREATE TRIGGER t BEFORE INSERT ON a FOR EACH ROW',
      'BEGIN',
      '  SET @x = 1;',
      '  SET @y = 2;',
      'END//',
      'DELIMITER ;',
      'SELECT 1;',
    ].join('\n');
    const r = dividiIstruzioni(sql);
    assert.equal(r.length, 4);
    assert.match(r[1], /^INSERT INTO a VALUES \(1\),\n\(2\)$/);
    assert.match(r[2], /^CREATE TRIGGER t[\s\S]*SET @y = 2;\nEND$/);
    assert.equal(r[3], 'SELECT 1');
  });
});

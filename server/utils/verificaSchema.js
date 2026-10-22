// Controlla che il database contenga la struttura prevista da database/schema.sql.
// Serve a distinguere "MySQL spento" da "database presente ma vecchio o incompleto":
// in quest'ultimo caso ogni query fallisce e il client mostra soltanto "Errore interno del server".

const COLONNE_ATTESE = {
  settori: ['id_settore', 'nome_settore', 'prezzo', 'capacita_max'],
  utenti: ['id_utente', 'nome', 'cognome', 'email', 'password', 'codice_accesso', 'abilitato', 'ruolo'],
  ordini: ['id_ordine', 'fk_utente', 'data_ora', 'totale'],
  biglietti: ['id_biglietto', 'fk_settore', 'venduto'],
  dettaglio_ordini: ['fk_ordine', 'fk_biglietto'],
};
const TRIGGER_ATTESO = 'trg_limite_biglietti';

/**
 * @param {import('mysql2/promise').Pool} db
 * @returns {Promise<string[]>} elenco dei problemi trovati (vuoto = struttura corretta)
 */
async function verificaSchema(db) {
  const [colonne] = await db.query(
    `SELECT table_name AS tabella, column_name AS colonna
       FROM information_schema.columns WHERE table_schema = DATABASE()`
  );
  const presenti = new Map();
  for (const { tabella, colonna } of colonne) {
    const nome = String(tabella).toLowerCase();
    if (!presenti.has(nome)) presenti.set(nome, new Set());
    presenti.get(nome).add(String(colonna).toLowerCase());
  }

  const problemi = [];
  for (const [tabella, attese] of Object.entries(COLONNE_ATTESE)) {
    const trovate = presenti.get(tabella);
    if (!trovate) {
      problemi.push(`manca la tabella "${tabella}"`);
      continue;
    }
    for (const colonna of attese) {
      if (!trovate.has(colonna)) problemi.push(`manca la colonna "${tabella}.${colonna}"`);
    }
  }

  const [trigger] = await db.query(
    `SELECT trigger_name AS nome FROM information_schema.triggers WHERE trigger_schema = DATABASE()`
  );
  if (!trigger.some((t) => String(t.nome).toLowerCase() === TRIGGER_ATTESO)) {
    problemi.push(`manca il trigger "${TRIGGER_ATTESO}" (limite di 4 biglietti nel database)`);
  }
  return problemi;
}

module.exports = { verificaSchema, COLONNE_ATTESE, TRIGGER_ATTESO };

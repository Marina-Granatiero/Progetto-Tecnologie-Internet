// Funzioni di validazione/sanitizzazione degli input provenienti dal client.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Restituisce la stringa "pulita" (trim) oppure '' se il valore non è una stringa. */
function pulisci(valore) {
  return typeof valore === 'string' ? valore.trim() : '';
}

function normalizzaEmail(valore) {
  return pulisci(valore).toLowerCase();
}

function emailValida(email) {
  return email.length <= 100 && EMAIL_REGEX.test(email);
}

/**
 * Converte in intero positivo un numero JSON o una stringa di sole cifre.
 * Tutto il resto (decimali, oggetti, array, booleani, null...) viene rifiutato
 * restituendo null: in questo modo nelle query arrivano solo interi sicuri.
 */
function interoPositivo(valore) {
  if (typeof valore === 'number') {
    return Number.isSafeInteger(valore) && valore > 0 ? valore : null;
  }
  if (typeof valore === 'string' && /^\d{1,9}$/.test(valore)) {
    const n = Number(valore);
    return n > 0 ? n : null;
  }
  return null;
}

module.exports = { pulisci, normalizzaEmail, emailValida, interoPositivo };

// localStorage "sicuro": in navigazione privata o con i dati del sito bloccati
// può lanciare eccezioni, quindi ogni accesso è protetto.
export function leggi(chiave) {
  try {
    return window.localStorage.getItem(chiave);
  } catch {
    return null;
  }
}

export function scrivi(chiave, valore) {
  try {
    window.localStorage.setItem(chiave, valore);
  } catch {
    /* ignorato: la sessione resterà valida solo finché la pagina è aperta */
  }
}

export function rimuovi(chiave) {
  try {
    window.localStorage.removeItem(chiave);
  } catch {
    /* ignorato */
  }
}

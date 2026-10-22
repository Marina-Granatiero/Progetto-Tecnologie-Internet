import axios from 'axios';
import { leggi } from './storage';

// L'indirizzo del server si può cambiare con VITE_API_URL (file client/.env).
// In assenza usa lo stesso host della pagina sulla porta 5000: funziona sia con
// "localhost" sia aprendo il sito da un altro dispositivo della rete locale.
const BASE_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

const API = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Interceptor di richiesta: allega il token JWT a ogni chiamata
API.interceptors.request.use((config) => {
  const token = leggi('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor di risposta: se il server dice 401 (token scaduto o non valido)
// su una chiamata autenticata, l'AuthProvider chiude la sessione.
let gestoreNonAutorizzato = null;
export function impostaGestoreNonAutorizzato(funzione) {
  gestoreNonAutorizzato = funzione;
}

API.interceptors.response.use(
  (risposta) => risposta,
  (errore) => {
    const url = errore.config?.url ?? '';
    const chiamataDiAccesso = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    if (
      errore.response?.status === 401 &&
      !chiamataDiAccesso &&
      leggi('token') &&
      gestoreNonAutorizzato
    ) {
      gestoreNonAutorizzato();
    }
    return Promise.reject(errore);
  }
);

/** Estrae un messaggio leggibile da un errore di Axios. */
export function messaggioErrore(errore, predefinito = 'Si è verificato un errore. Riprova.') {
  if (errore?.response?.data?.error) return errore.response.data.error;
  if (errore?.code === 'ERR_NETWORK' || errore?.code === 'ECONNABORTED') {
    return 'Impossibile contattare il server. Controlla che sia avviato (porta 5000) e riprova.';
  }
  return predefinito;
}

export default API;

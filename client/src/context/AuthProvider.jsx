import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { impostaGestoreNonAutorizzato } from '../services/api';
import { leggi, rimuovi, scrivi } from '../services/storage';
import { AuthContext } from './authContext';

function leggiUtenteSalvato() {
  if (!leggi('token')) return null;
  try {
    return JSON.parse(leggi('user'));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(leggiUtenteSalvato);
  // true finché la sessione salvata non è stata riconfermata dal server
  const [loading, setLoading] = useState(() => Boolean(leggi('token')));
  const [sessioneScaduta, setSessioneScaduta] = useState(false);

  const logout = useCallback(() => {
    rimuovi('token');
    rimuovi('user');
    setUser(null);
  }, []);

  const login = useCallback((datiUtente, token) => {
    scrivi('token', token);
    scrivi('user', JSON.stringify(datiUtente));
    setSessioneScaduta(false);
    setUser(datiUtente);
  }, []);

  // Riallinea i dati dell'utente con il database (abilitazione, ruolo, codice)
  const aggiornaUtente = useCallback(async () => {
    const res = await API.get('/auth/me');
    scrivi('user', JSON.stringify(res.data.utente));
    setUser(res.data.utente);
    return res.data.utente;
  }, []);

  // All'avvio: se esiste una sessione salvata la si verifica col server.
  // I dati in localStorage non sono mai considerati affidabili.
  useEffect(() => {
    if (!leggi('token')) return undefined;
    let attivo = true;
    API.get('/auth/me')
      .then((res) => {
        if (!attivo) return;
        scrivi('user', JSON.stringify(res.data.utente));
        setUser(res.data.utente);
      })
      .catch(() => {
        // 401: ci pensa il gestore globale. Errore di rete: si mantiene la sessione salvata.
      })
      .finally(() => {
        if (attivo) setLoading(false);
      });
    return () => {
      attivo = false;
    };
  }, []);

  // Token scaduto/non valido durante l'uso: chiude la sessione e porta al login
  useEffect(() => {
    impostaGestoreNonAutorizzato(() => {
      logout();
      setSessioneScaduta(true);
      navigate('/login', { replace: true, state: { scaduta: true } });
    });
    return () => impostaGestoreNonAutorizzato(null);
  }, [logout, navigate]);

  const valore = useMemo(
    () => ({ user, loading, login, logout, aggiornaUtente, sessioneScaduta }),
    [user, loading, login, logout, aggiornaUtente, sessioneScaduta]
  );

  return <AuthContext.Provider value={valore}>{children}</AuthContext.Provider>;
}

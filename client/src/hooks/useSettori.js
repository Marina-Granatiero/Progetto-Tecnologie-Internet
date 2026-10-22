import { useCallback, useEffect, useRef, useState } from 'react';
import API, { messaggioErrore } from '../services/api';

/**
 * Elenco dei settori con disponibilità in tempo reale.
 * Si riaggiorna da solo ogni `intervallo` ms (solo se la scheda è visibile)
 * e subito quando l'utente torna sulla scheda.
 */
export function useSettori({ intervallo = 8000 } = {}) {
  const [stato, setStato] = useState({
    settori: [],
    caricamento: true,
    errore: null,
    aggiornatoAlle: null,
  });
  const montato = useRef(true);

  const ricarica = useCallback(async () => {
    try {
      const res = await API.get('/settori');
      if (montato.current) {
        setStato({ settori: res.data, caricamento: false, errore: null, aggiornatoAlle: new Date() });
      }
    } catch (err) {
      if (montato.current) {
        setStato((s) => ({
          ...s,
          caricamento: false,
          errore: messaggioErrore(err, 'Impossibile recuperare i settori dal database.'),
        }));
      }
    }
  }, []);

  useEffect(() => {
    montato.current = true;
    ricarica();
    const timer = setInterval(() => {
      if (!document.hidden) ricarica();
    }, intervallo);
    const alRitorno = () => {
      if (!document.hidden) ricarica();
    };
    document.addEventListener('visibilitychange', alRitorno);
    return () => {
      montato.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', alRitorno);
    };
  }, [ricarica, intervallo]);

  return { ...stato, ricarica };
}

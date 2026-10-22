import { useEffect, useState } from 'react';
import API from '../services/api';

// Valori di ripiego finché il server non risponde (coincidono con le regole del progetto)
const PREDEFINITE = {
  soglia_primi_iscritti: 5,
  max_biglietti_per_utente: 4,
  codici_assegnati: 0,
  caricate: false,
};

/** Regole di business (soglia dei primi iscritti, limite biglietti) lette dal server. */
export function useRegole() {
  const [regole, setRegole] = useState(PREDEFINITE);

  useEffect(() => {
    let attivo = true;
    API.get('/regole')
      .then((res) => {
        if (attivo) setRegole({ ...PREDEFINITE, ...res.data, caricate: true });
      })
      .catch(() => {
        /* si resta sui valori predefiniti */
      });
    return () => {
      attivo = false;
    };
  }, []);

  return regole;
}

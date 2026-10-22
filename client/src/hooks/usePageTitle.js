import { useEffect } from 'react';

/** Imposta il titolo della scheda del browser (utile anche per i lettori di schermo). */
export function usePageTitle(titolo) {
  useEffect(() => {
    document.title = titolo ? `${titolo} – Concerto` : 'Concerto – Biglietti';
  }, [titolo]);
}

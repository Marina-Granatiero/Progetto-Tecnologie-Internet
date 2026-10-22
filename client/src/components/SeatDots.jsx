import { useRef, useState } from 'react';
import { useInView } from '../hooks/useInView';

/**
 * Matrice di puntini: uno per ogni posto del settore.
 * Pieno = libero, vuoto = venduto. Quando durante l'aggiornamento in tempo reale
 * alcuni posti si vendono, quei puntini "scoppiano" prima di svuotarsi.
 */
export default function SeatDots({ totale, venduti }) {
  const ref = useRef(null);
  const visibile = useInView(ref, { soglia: 0.1 });

  // Confronto col valore precedente (pattern "stato derivato dalle props")
  const [precedente, setPrecedente] = useState(venduti);
  const [flashDa, setFlashDa] = useState(null);
  if (venduti !== precedente) {
    setPrecedente(venduti);
    setFlashDa(venduti > precedente ? precedente : null);
  }

  return (
    <div
      ref={ref}
      className={`punti${visibile ? ' punti--visibili' : ''}`}
      role="img"
      aria-label={`${totale - venduti} posti liberi e ${venduti} venduti su ${totale}`}
    >
      {Array.from({ length: totale }, (_, i) => {
        const venduto = i < venduti;
        const flash = flashDa !== null && i >= flashDa && i < venduti;
        return (
          <i
            key={i}
            className={`punto${venduto ? ' punto--venduto' : ''}${flash ? ' punto--flash' : ''}`}
            style={{ '--i': i }}
          />
        );
      })}
    </div>
  );
}

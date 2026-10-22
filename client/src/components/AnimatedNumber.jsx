import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const arrotonda = (n) => String(Math.round(n));

/**
 * Numero che "scorre" fino al nuovo valore quando cambia (es. posti liberi che scendono).
 * Con `da` il conteggio parte da quel valore anche al primo caricamento.
 */
export default function AnimatedNumber({ value, da, durata = 800, format = arrotonda }) {
  const ridotto = useReducedMotion();
  const [mostrato, setMostrato] = useState(da ?? value);
  const corrente = useRef(da ?? value);

  useEffect(() => {
    if (ridotto) return undefined;
    const partenza = corrente.current;
    const arrivo = Number(value) || 0;
    if (partenza === arrivo) return undefined;

    let frame;
    let inizio;
    const passo = (t) => {
      inizio ??= t;
      const p = Math.min(1, (t - inizio) / durata);
      const morbido = 1 - Math.pow(1 - p, 3); // ease-out cubico
      corrente.current = partenza + (arrivo - partenza) * morbido;
      setMostrato(corrente.current);
      if (p < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [value, durata, ridotto]);

  return <span className="numero">{format(ridotto ? Number(value) || 0 : mostrato)}</span>;
}

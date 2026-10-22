import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Equalizer from './Equalizer';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Colore di sfondo (e del sipario) associato a ogni pagina
function tonoDi(pathname) {
  if (pathname.startsWith('/login')) return 'peach';
  if (pathname.startsWith('/register')) return 'mint';
  if (pathname.startsWith('/acquista')) return 'sky';
  if (pathname.startsWith('/admin')) return 'butter';
  return 'lilac';
}

const DURATA_COPRI = 300;
const DURATA_SCOPRI = 420;

/**
 * Transizione fra pagine "a sipario": un pannello pastello sale e copre la pagina uscente,
 * a sipario chiuso si cambia pagina e il pannello continua a salire scoprendo la nuova.
 * `children` è una funzione che riceve la posizione da mostrare.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const ridotto = useReducedMotion();
  const [mostrata, setMostrata] = useState(location);
  const [fase, setFase] = useState('fermo'); // fermo | copre | scopre
  const ultima = useRef(location);

  useEffect(() => {
    ultima.current = location;
  }, [location]);

  // Il tono dello sfondo segue la pagina effettivamente mostrata
  useEffect(() => {
    document.body.dataset.tono = tonoDi(mostrata.pathname);
  }, [mostrata.pathname]);

  // Cambio di pagina richiesto: si parte (senza animazioni se l'utente le ha disattivate)
  // (stessa pagina con parametri diversi, es. /acquista?settore=2: si aggiorna senza sipario)
  if (location.key !== mostrata.key && fase === 'fermo') {
    if (ridotto || location.pathname === mostrata.pathname) setMostrata(location);
    else setFase('copre');
  }

  useEffect(() => {
    if (fase === 'copre') {
      const t = setTimeout(() => {
        setMostrata(ultima.current);
        window.scrollTo(0, 0);
        setFase('scopre');
      }, DURATA_COPRI);
      return () => clearTimeout(t);
    }
    if (fase === 'scopre') {
      const t = setTimeout(() => setFase('fermo'), DURATA_SCOPRI);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [fase]);

  // Dopo il cambio pagina il focus passa al contenuto (accessibilità da tastiera/lettori)
  const principale = useRef(null);
  useEffect(() => {
    if (fase === 'scopre') principale.current?.focus({ preventScroll: true });
  }, [fase]);

  return (
    <>
      <main id="contenuto" ref={principale} tabIndex={-1} className="principale">
        {children(mostrata)}
      </main>
      <div
        className={`sipario sipario--${fase}`}
        data-tono={tonoDi(location.pathname)}
        aria-hidden="true"
      >
        <Equalizer className="eq--grande" />
      </div>
    </>
  );
}

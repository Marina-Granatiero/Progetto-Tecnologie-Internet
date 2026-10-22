import { useRef } from 'react';
import Equalizer from './Equalizer';
import { useReducedMotion } from '../hooks/useReducedMotion';

const CODICE_FINTO = 'TICKET-••••••';

/**
 * Il biglietto della home. Per un utente abilitato mostra il suo vero codice di prelazione,
 * per tutti gli altri è un esempio. Segue il puntatore con una leggera inclinazione.
 */
export default function HeroTicket({ user, soglia }) {
  const ref = useRef(null);
  const ridotto = useReducedMotion();
  // Solo chi possiede davvero un codice di prelazione vede il proprio biglietto: per tutti gli altri è un esempio
  const codice = user?.abilitato ? user.codice_accesso : null;

  const muovi = (e) => {
    if (ridotto || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    ref.current.style.setProperty('--ry', `${x * 10}deg`);
    ref.current.style.setProperty('--rx', `${-y * 8}deg`);
  };
  const esci = () => {
    ref.current?.style.setProperty('--ry', '0deg');
    ref.current?.style.setProperty('--rx', '0deg');
  };

  return (
    <div className="biglietto-hero" onPointerMove={muovi} onPointerLeave={esci} aria-hidden="true">
      <div className="biglietto-hero__inclina" ref={ref}>
        <div className="biglietto-hero__forma">
          <div className="biglietto-hero__principale">
            <p className="biglietto-hero__marchio">
              <Equalizer /> concerto
            </p>
            <p className="biglietto-hero__etichetta">Codice di prelazione</p>
            <p className="biglietto-hero__codice">{codice || CODICE_FINTO}</p>
            <p className="biglietto-hero__nome">
              {codice ? `${user.nome} ${user.cognome}` : `Solo per i primi ${soglia} iscritti`}
            </p>
          </div>
          <div className="biglietto-hero__tagliando">
            <span className="biglietto-hero__barre" />
            <span className="biglietto-hero__serie">N° 0001</span>
          </div>
        </div>
      </div>
    </div>
  );
}

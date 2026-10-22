import { useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { iniziali } from '../services/format';
import Equalizer from './Equalizer';
import Icon from './Icon';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const listaRef = useRef(null);
  const indicatoreRef = useRef(null);
  const [copiato, setCopiato] = useState(false);
  // Il menu mobile "appartiene" alla pagina in cui è stato aperto: cambiando pagina si chiude da solo
  const [menuAperturaPath, setMenuAperturaPath] = useState(null);
  const menuAperto = menuAperturaPath === location.pathname;

  // Indicatore a pillola che scorre sotto la voce attiva
  useLayoutEffect(() => {
    const lista = listaRef.current;
    const indicatore = indicatoreRef.current;
    if (!lista || !indicatore) return undefined;

    const posiziona = () => {
      const attiva = lista.querySelector('a[aria-current="page"]');
      if (!attiva) {
        indicatore.style.opacity = '0';
        return;
      }
      indicatore.style.opacity = '1';
      indicatore.style.width = `${attiva.offsetWidth}px`;
      indicatore.style.height = `${attiva.offsetHeight}px`;
      indicatore.style.transform = `translate(${attiva.offsetLeft}px, ${attiva.offsetTop}px)`;
    };

    posiziona();
    const osservatore = new ResizeObserver(posiziona);
    osservatore.observe(lista);
    document.fonts?.ready.then(posiziona);
    return () => osservatore.disconnect();
  }, [location.pathname, user?.abilitato, user?.ruolo]);

  const esci = () => {
    logout();
    navigate('/login');
  };

  const copiaCodice = async () => {
    try {
      await navigator.clipboard.writeText(user.codice_accesso);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 1800);
    } catch {
      /* clipboard non disponibile (es. http): non è un errore grave */
    }
  };

  return (
    <header className="barra">
      <div className="barra__interno">
        <Link to="/" className="marchio" aria-label="Concerto, vai alla home">
          <Equalizer />
          <span className="marchio__nome">concerto</span>
        </Link>

        <button
          type="button"
          className="barra__menu-btn"
          aria-expanded={menuAperto}
          aria-controls="menu-principale"
          onClick={() => setMenuAperturaPath(menuAperto ? null : location.pathname)}
        >
          <Icon nome={menuAperto ? 'chiudi' : 'menu'} />
          <span className="solo-lettori">{menuAperto ? 'Chiudi il menu' : 'Apri il menu'}</span>
        </button>

        <div id="menu-principale" className={`barra__menu${menuAperto ? ' barra__menu--aperto' : ''}`}>
          <nav aria-label="Principale">
            <ul className="barra__lista" ref={listaRef}>
              <li className="barra__indicatore" ref={indicatoreRef} aria-hidden="true" />
              <li>
                <NavLink to="/" end>
                  Settori
                </NavLink>
              </li>
              {user?.abilitato && (
                <li>
                  <NavLink to="/acquista">Acquista</NavLink>
                </li>
              )}
              {user?.ruolo === 'admin' && (
                <li>
                  <NavLink to="/admin">Dashboard</NavLink>
                </li>
              )}
            </ul>
          </nav>

          <div className="barra__utente">
            {!user && (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Accedi
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Registrati
                </Link>
              </>
            )}

            {user && (
              <>
                {user.codice_accesso && (
                  <button
                    type="button"
                    className="codice-chip"
                    onClick={copiaCodice}
                    title="Copia il codice di prelazione"
                  >
                    <span className="codice-chip__testo">{user.codice_accesso}</span>
                    <Icon nome={copiato ? 'spunta' : 'copia'} dimensione={16} />
                    <span className="solo-lettori" aria-live="polite">
                      {copiato ? 'Codice copiato' : 'Copia il codice di prelazione'}
                    </span>
                  </button>
                )}
                {!user.abilitato && user.ruolo !== 'admin' && (
                  <span className="stato-chip" title="I codici di prelazione sono stati assegnati ai primi iscritti">
                    Senza prelazione
                  </span>
                )}
                <span className="profilo">
                  <span className="profilo__avatar" aria-hidden="true">
                    {iniziali(user.nome, user.cognome)}
                  </span>
                  <span className="profilo__nome">
                    {user.nome} {user.cognome}
                  </span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={esci}>
                  <Icon nome="esci" dimensione={18} />
                  Esci
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Loader from './Loader';

// Gli oggetti `state` passati a <Navigate> devono essere STABILI fra un rendering e l'altro:
// <Navigate> esegue la navigazione in un effetto che dipende da `state`, quindi un oggetto nuovo a
// ogni rendering (con la vecchia pagina ancora montata durante il sipario) la ripeterebbe all'infinito.
const STATO_SOLO_ADMIN = { avviso: 'La dashboard è riservata agli amministratori.' };
const STATO_SENZA_PRELAZIONE = {
  avviso:
    "L'acquisto è riservato agli utenti con codice di prelazione, assegnato ai primi iscritti. Puoi comunque consultare i settori.",
};

/**
 * Sentinella delle rotte riservate (lato client).
 *  - richiede="abilitato": solo utenti con codice di prelazione (pagina di acquisto)
 *  - richiede="admin":     solo amministratori (dashboard)
 *
 * NB: è un controllo di comodità per l'interfaccia. La sicurezza vera è sul server,
 * che verifica token, abilitazione e ruolo a ogni chiamata API.
 */
export default function ProtectedRoute({ children, richiede = 'abilitato' }) {
  const { user, loading, sessioneScaduta } = useAuth();
  const location = useLocation();
  const paginaRichiesta = location.pathname + location.search;
  const statoLogin = useMemo(
    () => ({ da: paginaRichiesta, scaduta: sessioneScaduta }),
    [paginaRichiesta, sessioneScaduta]
  );

  if (loading) return <Loader testo="Verifico le autorizzazioni…" />;

  if (!user) {
    return <Navigate to="/login" replace state={statoLogin} />;
  }

  if (richiede === 'admin' && user.ruolo !== 'admin') {
    return <Navigate to="/" replace state={STATO_SOLO_ADMIN} />;
  }

  if (richiede === 'abilitato' && !user.abilitato) {
    return <Navigate to="/" replace state={STATO_SENZA_PRELAZIONE} />;
  }

  return children;
}

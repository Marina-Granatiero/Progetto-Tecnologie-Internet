import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Alert from '../components/Alert';
import AnimatedNumber from '../components/AnimatedNumber';
import HeroTicket from '../components/HeroTicket';
import Icon from '../components/Icon';
import LiveBadge from '../components/LiveBadge';
import SectorCard from '../components/SectorCard';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useRegole } from '../hooks/useRegole';
import { useSettori } from '../hooks/useSettori';

function AzioniHero({ user, soglia }) {
  if (!user) {
    return (
      <div className="hero__azioni">
        <Link to="/register" className="btn btn--primary btn--grande">
          Crea il tuo account
        </Link>
        <Link to="/login" className="btn btn--grande">
          Accedi
        </Link>
      </div>
    );
  }
  if (user.ruolo === 'admin') {
    return (
      <div className="hero__azioni">
        <Link to="/admin" className="btn btn--primary btn--grande">
          <Icon nome="scudo" /> Apri la dashboard
        </Link>
      </div>
    );
  }
  if (user.abilitato) {
    return (
      <div className="hero__azioni">
        <Link to="/acquista" className="btn btn--primary btn--grande">
          <Icon nome="biglietto" /> Scegli i biglietti
        </Link>
      </div>
    );
  }
  return (
    <p className="hero__nota">
      Il tuo account è attivo, ma i {soglia} codici di prelazione sono già stati assegnati: puoi consultare i
      settori, l&rsquo;acquisto è riservato a chi li possiede.
    </p>
  );
}

export default function Home() {
  usePageTitle('Settori e disponibilità');
  const { user } = useAuth();
  const location = useLocation();
  const regole = useRegole();
  const { settori, caricamento, errore, aggiornatoAlle, ricarica } = useSettori();
  const [avvisoChiuso, setAvvisoChiuso] = useState(false);
  const avviso = avvisoChiuso ? null : location.state?.avviso;

  const soglia = regole.soglia_primi_iscritti;
  const massimo = regole.max_biglietti_per_utente;
  const puoAcquistare = Boolean(user?.abilitato);

  return (
    <div className="pagina pagina--home">
      {avviso && (
        <Alert tipo="attenzione" onChiudi={() => setAvvisoChiuso(true)}>
          {avviso}
        </Alert>
      )}

      <section className="hero" aria-labelledby="titolo-hero">
        <div className="hero__testo">
          <h1 id="titolo-hero" className="hero__titolo">
            Un posto sotto il palco, senza bagarini.
          </h1>
          <p className="hero__lead">
            Solo i primi {soglia} iscritti ricevono il codice di prelazione e ogni persona può prendere al massimo{' '}
            {massimo} biglietti. I posti qui sotto si aggiornano in tempo reale.
          </p>
          <AzioniHero user={user} soglia={soglia} />
          <ul className="regole">
            <li>
              <Icon nome="utenti" />
              <span>
                <strong>
                  <AnimatedNumber value={regole.codici_assegnati} da={0} /> su {soglia}
                </strong>{' '}
                codici di prelazione assegnati
              </span>
            </li>
            <li>
              <Icon nome="biglietto" />
              <span>
                <strong>Massimo {massimo}</strong> biglietti a persona
              </span>
            </li>
            <li>
              <Icon nome="scudo" />
              <span>
                <strong>Mai venduto due volte:</strong> ogni ordine è una transazione
              </span>
            </li>
          </ul>
        </div>
        <HeroTicket user={user} soglia={soglia} />
      </section>

      <section className="sezione" aria-labelledby="titolo-settori">
        <header className="sezione__testa">
          <h2 id="titolo-settori">Scegli il tuo settore</h2>
          <LiveBadge aggiornatoAlle={aggiornatoAlle} onRicarica={ricarica} />
        </header>

        {errore && (
          <Alert tipo="errore">
            {errore}{' '}
            <button type="button" className="link-btn" onClick={ricarica}>
              Riprova
            </button>
          </Alert>
        )}

        {caricamento && !errore && (
          <div className="griglia-settori" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="scheletro scheletro--stub" />
            ))}
          </div>
        )}

        {!caricamento && settori.length === 0 && !errore && (
          <p className="vuoto">Nessun settore in vendita al momento. Ricontrolla più tardi.</p>
        )}

        <div className="griglia-settori">
          {settori.map((s) => (
            <SectorCard
              key={s.id_settore}
              settore={s}
              azione={
                puoAcquistare && Number(s.biglietti_disponibili) > 0 ? (
                  <Link to={`/acquista?settore=${s.id_settore}`} className="btn btn--sm">
                    Scegli questo settore <Icon nome="freccia" dimensione={16} />
                  </Link>
                ) : null
              }
            />
          ))}
        </div>
      </section>

      <section className="sezione" aria-labelledby="titolo-come">
        <header className="sezione__testa">
          <h2 id="titolo-come">Come funziona</h2>
        </header>
        <ol className="passi">
          <li>
            <h3>Crea il tuo account</h3>
            <p>
              I primi {soglia} iscritti vengono abilitati subito e ricevono un codice di prelazione personale.
            </p>
          </li>
          <li>
            <h3>Scegli settore e quantità</h3>
            <p>
              Puoi avere fino a {massimo} biglietti in totale: un contatore ti mostra quanti te ne restano.
            </p>
          </li>
          <li>
            <h3>Conferma l&rsquo;ordine</h3>
            <p>
              L&rsquo;acquisto è un&rsquo;unica transazione: o ricevi tutti i biglietti o nessuno, e nessun posto
              viene venduto due volte.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}

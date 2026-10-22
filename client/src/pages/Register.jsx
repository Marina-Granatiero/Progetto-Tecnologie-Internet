import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import Equalizer from '../components/Equalizer';
import Field from '../components/Field';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useRegole } from '../hooks/useRegole';
import API, { messaggioErrore } from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LUNGHEZZA_MIN = 8;

// Valutazione semplice della password: lunghezza + varietà di caratteri
function forzaPassword(p) {
  if (!p) return 0;
  let punti = 0;
  if (p.length >= LUNGHEZZA_MIN) punti++;
  if (p.length >= 12) punti++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) punti++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) punti++;
  return Math.max(1, punti);
}
const ETICHETTE_FORZA = ['', 'Debole', 'Discreta', 'Buona', 'Ottima'];

function CodiceRivelato({ codice }) {
  const [copiato, setCopiato] = useState(false);
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(codice);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 1800);
    } catch {
      /* clipboard non disponibile */
    }
  };
  return (
    <div className="codice-rivelato">
      <p className="codice-rivelato__etichetta">Il tuo codice di prelazione</p>
      <p className="codice-rivelato__codice" aria-label={codice}>
        {[...codice].map((c, i) => (
          <span key={i} aria-hidden="true" style={{ '--i': i }}>
            {c}
          </span>
        ))}
      </p>
      <button type="button" className="btn btn--sm" onClick={copia}>
        <Icon nome={copiato ? 'spunta' : 'copia'} dimensione={16} />
        {copiato ? 'Copiato' : 'Copia il codice'}
      </button>
    </div>
  );
}

export default function Register() {
  usePageTitle('Registrati');
  const { login } = useAuth();
  const navigate = useNavigate();
  const regole = useRegole();
  const [dati, setDati] = useState({ nome: '', cognome: '', email: '', password: '' });
  const [errori, setErrori] = useState({});
  const [errore, setErrore] = useState(null);
  const [inInvio, setInInvio] = useState(false);
  const [esito, setEsito] = useState(null);

  const imposta = (campo) => (e) => setDati((d) => ({ ...d, [campo]: e.target.value }));

  const valida = () => {
    const e = {};
    if (!dati.nome.trim()) e.nome = 'Inserisci il nome.';
    else if (dati.nome.trim().length > 50) e.nome = 'Massimo 50 caratteri.';
    if (!dati.cognome.trim()) e.cognome = 'Inserisci il cognome.';
    else if (dati.cognome.trim().length > 50) e.cognome = 'Massimo 50 caratteri.';
    if (!dati.email.trim()) e.email = "Inserisci l'email.";
    else if (!EMAIL_RE.test(dati.email.trim())) e.email = "Controlla l'indirizzo: manca qualcosa (es. nome@dominio.it).";
    if (!dati.password) e.password = 'Scegli una password.';
    else if (dati.password.length < LUNGHEZZA_MIN) e.password = `Servono almeno ${LUNGHEZZA_MIN} caratteri.`;
    return e;
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setErrore(null);
    const e = valida();
    setErrori(e);
    if (Object.keys(e).length > 0) return;

    setInInvio(true);
    try {
      const res = await API.post('/auth/register', {
        nome: dati.nome.trim(),
        cognome: dati.cognome.trim(),
        email: dati.email.trim(),
        password: dati.password,
      });
      // Accesso automatico con le stesse credenziali: l'utente entra subito
      let connesso = false;
      try {
        const accesso = await API.post('/auth/login', { email: dati.email.trim(), password: dati.password });
        login(accesso.data.utente, accesso.data.token);
        connesso = true;
      } catch {
        /* se fallisce si propone il login manuale */
      }
      setEsito({ utente: res.data.utente, connesso });
    } catch (err) {
      setErrore(messaggioErrore(err, 'Registrazione non riuscita. Riprova.'));
    } finally {
      setInInvio(false);
    }
  };

  const forza = forzaPassword(dati.password);

  if (esito) {
    const { utente, connesso } = esito;
    return (
      <div className="pagina pagina--auth">
        <div className="auth auth--singola">
          <section className="auth__scheda auth__scheda--esito" aria-live="polite" aria-labelledby="titolo-esito">
            <h1 id="titolo-esito">{utente.abilitato ? 'Sei dentro!' : 'Account creato'}</h1>
            {utente.abilitato ? (
              <>
                <p className="auth__intro">
                  Sei tra i primi {regole.soglia_primi_iscritti} iscritti: puoi acquistare fino a{' '}
                  {regole.max_biglietti_per_utente} biglietti.
                </p>
                <CodiceRivelato codice={utente.codice_accesso} />
              </>
            ) : (
              <Alert tipo="info">
                I {regole.soglia_primi_iscritti} codici di prelazione sono già stati assegnati. Il tuo account è
                attivo e puoi consultare i settori, ma non puoi acquistare.
              </Alert>
            )}
            <div className="auth__azioni">
              {connesso ? (
                <button
                  type="button"
                  className="btn btn--primary btn--grande"
                  onClick={() => navigate(utente.abilitato ? '/acquista' : '/')}
                >
                  {utente.abilitato ? 'Scegli i biglietti' : 'Vai ai settori'}
                </button>
              ) : (
                <Link to="/login" className="btn btn--primary btn--grande">
                  Vai al login
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina pagina--auth">
      <div className="auth auth--inversa">
        <aside className="auth__pannello tema-mint" aria-hidden="true">
          <Equalizer className="eq--grande" />
          <p className="auth__slogan">Prima arrivi, meglio è.</p>
          <p className="auth__sotto-slogan">
            I primi {regole.soglia_primi_iscritti} iscritti ricevono il codice di prelazione per acquistare.
            Finora ne sono stati assegnati {regole.codici_assegnati}.
          </p>
          <span className="auth__forma auth__forma--a" />
          <span className="auth__forma auth__forma--b" />
        </aside>

        <section className="auth__scheda" aria-labelledby="titolo-registrazione">
          <h1 id="titolo-registrazione">Crea il tuo account</h1>
          <p className="auth__intro">Ci vogliono meno di un minuto.</p>

          {errore && <Alert tipo="errore">{errore}</Alert>}

          <form onSubmit={handleSubmit} noValidate className="modulo">
            <div className="modulo__coppia">
              <Field
                id="nome"
                label="Nome"
                valore={dati.nome}
                onChange={imposta('nome')}
                errore={errori.nome}
                autoComplete="given-name"
              />
              <Field
                id="cognome"
                label="Cognome"
                valore={dati.cognome}
                onChange={imposta('cognome')}
                errore={errori.cognome}
                autoComplete="family-name"
              />
            </div>
            <Field
              id="email"
              label="Email"
              tipo="email"
              valore={dati.email}
              onChange={imposta('email')}
              errore={errori.email}
              autoComplete="email"
              inputMode="email"
              placeholder="nome@esempio.it"
            />
            <Field
              id="password"
              label="Password"
              tipo="password"
              valore={dati.password}
              onChange={imposta('password')}
              errore={errori.password}
              aiuto={`Almeno ${LUNGHEZZA_MIN} caratteri.`}
              autoComplete="new-password"
              mostraToggle
            >
              <div className="forza" data-livello={forza} aria-hidden={forza === 0}>
                <span className="forza__barre">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="forza__testo">{ETICHETTE_FORZA[forza]}</span>
              </div>
            </Field>
            <button type="submit" className="btn btn--primary btn--blocco btn--grande" disabled={inInvio}>
              {inInvio ? (
                <>
                  <Equalizer /> Creazione in corso…
                </>
              ) : (
                'Registrati'
              )}
            </button>
          </form>

          <p className="auth__alt">
            Hai già un account? <Link to="/login">Accedi</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

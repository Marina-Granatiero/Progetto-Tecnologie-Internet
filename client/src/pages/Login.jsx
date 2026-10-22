import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import Equalizer from '../components/Equalizer';
import Field from '../components/Field';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import API, { messaggioErrore } from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  usePageTitle('Accedi');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errori, setErrori] = useState({});
  const [errore, setErrore] = useState(null);
  const [inInvio, setInInvio] = useState(false);

  const valida = () => {
    const e = {};
    if (!email.trim()) e.email = "Inserisci l'email con cui ti sei registrato.";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Controlla l'indirizzo: manca qualcosa (es. nome@dominio.it).";
    if (!password) e.password = 'Inserisci la password.';
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
      const res = await API.post('/auth/login', { email: email.trim(), password });
      login(res.data.utente, res.data.token);
      navigate(location.state?.da || '/');
    } catch (err) {
      setErrore(messaggioErrore(err, 'Accesso non riuscito. Riprova.'));
      setInInvio(false);
    }
  };

  return (
    <div className="pagina pagina--auth">
      <div className="auth">
        <aside className="auth__pannello tema-peach" aria-hidden="true">
          <Equalizer className="eq--grande" />
          <p className="auth__slogan">Rieccoti.</p>
          <p className="auth__sotto-slogan">Accedi per vedere il tuo codice di prelazione e prenotare i biglietti.</p>
          <span className="auth__forma auth__forma--a" />
          <span className="auth__forma auth__forma--b" />
        </aside>

        <section className="auth__scheda" aria-labelledby="titolo-login">
          <h1 id="titolo-login">Accedi</h1>
          <p className="auth__intro">Usa l&rsquo;email con cui ti sei registrato.</p>

          {location.state?.scaduta && !errore && (
            <Alert tipo="attenzione">La sessione è scaduta: accedi di nuovo per continuare.</Alert>
          )}
          {location.state?.da && !location.state?.scaduta && !errore && (
            <Alert tipo="info">Per aprire quella pagina devi prima accedere.</Alert>
          )}
          {errore && <Alert tipo="errore">{errore}</Alert>}

          <form onSubmit={handleSubmit} noValidate className="modulo">
            <Field
              id="email"
              label="Email"
              tipo="email"
              valore={email}
              onChange={(e) => setEmail(e.target.value)}
              errore={errori.email}
              autoComplete="email"
              inputMode="email"
              placeholder="nome@esempio.it"
            />
            <Field
              id="password"
              label="Password"
              tipo="password"
              valore={password}
              onChange={(e) => setPassword(e.target.value)}
              errore={errori.password}
              autoComplete="current-password"
              mostraToggle
            />
            <button type="submit" className="btn btn--primary btn--blocco btn--grande" disabled={inInvio}>
              {inInvio ? (
                <>
                  <Equalizer /> Accesso in corso…
                </>
              ) : (
                'Accedi'
              )}
            </button>
          </form>

          <p className="auth__alt">
            Non hai ancora un account? <Link to="/register">Registrati</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

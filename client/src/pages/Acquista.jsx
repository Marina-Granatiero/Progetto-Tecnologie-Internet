import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert';
import AnimatedNumber from '../components/AnimatedNumber';
import Confetti from '../components/Confetti';
import Equalizer from '../components/Equalizer';
import Icon from '../components/Icon';
import LiveBadge from '../components/LiveBadge';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSettori } from '../hooks/useSettori';
import API, { messaggioErrore } from '../services/api';
import { dataOra, euro, euroPreciso, temaSettore } from '../services/format';

// Limite predefinito finché il server non comunica quello reale
const LIMITE_PREDEFINITO = 4;

export default function Acquista() {
  usePageTitle('Acquista biglietti');
  const { user } = useAuth();
  const [parametri] = useSearchParams();
  const { settori, caricamento, errore: erroreSettori, aggiornatoAlle, ricarica: ricaricaSettori } =
    useSettori({ intervallo: 6000 });

  const [miei, setMiei] = useState({ limite: LIMITE_PREDEFINITO, acquistati: 0, rimanenti: LIMITE_PREDEFINITO, ordini: [] });
  const [mieiPronti, setMieiPronti] = useState(false);
  const [scelta, setScelta] = useState(null); // id settore scelto dall'utente
  const [quantita, setQuantita] = useState(1);
  const [inInvio, setInInvio] = useState(false);
  const [errore, setErrore] = useState(null);
  const [conferma, setConferma] = useState(null);

  const ricaricaMiei = useCallback(async () => {
    try {
      const res = await API.get('/ordini/miei');
      setMiei(res.data);
    } catch (err) {
      setErrore(messaggioErrore(err, 'Impossibile leggere i tuoi ordini.'));
    } finally {
      setMieiPronti(true);
    }
  }, []);

  // Primo caricamento del limite personale (gli aggiornamenti successivi passano da ricaricaMiei)
  useEffect(() => {
    let attivo = true;
    API.get('/ordini/miei')
      .then((res) => {
        if (attivo) setMiei(res.data);
      })
      .catch((err) => {
        if (attivo) setErrore(messaggioErrore(err, 'Impossibile leggere i tuoi ordini.'));
      })
      .finally(() => {
        if (attivo) setMieiPronti(true);
      });
    return () => {
      attivo = false;
    };
  }, []);

  // Settore selezionato: scelta dell'utente > parametro ?settore= > primo con posti liberi
  const daUrl = Number(parametri.get('settore')) || null;
  const idEffettivo =
    [scelta, daUrl].find((id) => id && settori.some((s) => s.id_settore === id)) ??
    settori.find((s) => Number(s.biglietti_disponibili) > 0)?.id_settore ??
    settori[0]?.id_settore ??
    null;
  const settore = settori.find((s) => s.id_settore === idEffettivo) ?? null;

  const disponibili = Number(settore?.biglietti_disponibili ?? 0);
  const massimo = Math.max(0, Math.min(miei.rimanenti, disponibili));
  const q = massimo === 0 ? 0 : Math.min(Math.max(1, quantita), massimo);
  const prezzo = Number(settore?.prezzo ?? 0);
  const totale = prezzo * q;
  const tema = settore ? temaSettore(settore.nome_settore, settore.id_settore) : 'lilac';
  const limiteRaggiunto = mieiPronti && miei.rimanenti === 0;
  const pronto = Boolean(settore) && q >= 1 && !inInvio && !limiteRaggiunto;

  const handleAcquisto = async (evento) => {
    evento.preventDefault();
    if (!pronto) return;
    setErrore(null);
    setInInvio(true);
    try {
      const res = await API.post('/ordini', { id_settore: settore.id_settore, quantita: q });
      setConferma({
        id_ordine: res.data.id_ordine,
        totale: res.data.totale,
        quantita: res.data.biglietti_acquistati,
        nome_settore: settore.nome_settore,
        tema,
      });
      setQuantita(1);
    } catch (err) {
      setErrore(messaggioErrore(err, "Errore durante l'elaborazione dell'ordine."));
    } finally {
      // in ogni caso si riallineano disponibilità e limite con il database
      await Promise.all([ricaricaSettori(), ricaricaMiei()]);
      setInInvio(false);
    }
  };

  const nuovoAcquisto = () => {
    setConferma(null);
    setErrore(null);
  };

  return (
    <div className="pagina pagina--acquista">
      <header className="intestazione">
        <div>
          <h1>Prenota i tuoi biglietti</h1>
          <p className="intestazione__sotto">
            {user?.nome}, il tuo codice di prelazione è <code className="codice">{user?.codice_accesso}</code>.
          </p>
        </div>
        <LiveBadge aggiornatoAlle={aggiornatoAlle} onRicarica={ricaricaSettori} />
      </header>

      <div className="limite" aria-live="polite">
        <div className="limite__pip" aria-hidden="true">
          {Array.from({ length: miei.limite }, (_, i) => {
            const tipo = i < miei.acquistati ? 'tuo' : i < miei.acquistati + q ? 'ordine' : 'libero';
            return <span key={i} className={`pip pip--${tipo}`} />;
          })}
        </div>
        <p>
          {mieiPronti ? (
            <>
              Hai già <strong>{miei.acquistati}</strong> {miei.acquistati === 1 ? 'biglietto' : 'biglietti'} su{' '}
              {miei.limite}.{' '}
              {miei.rimanenti > 0
                ? `Te ne restano ${miei.rimanenti} da acquistare.`
                : 'Hai raggiunto il limite per persona.'}
            </>
          ) : (
            'Controllo il tuo limite di acquisto…'
          )}
        </p>
      </div>

      {erroreSettori && <Alert tipo="errore">{erroreSettori}</Alert>}
      {errore && (
        <Alert tipo="errore" className="avviso--scuoti" onChiudi={() => setErrore(null)}>
          {errore}
        </Alert>
      )}
      {limiteRaggiunto && !conferma && (
        <Alert tipo="info">
          Hai raggiunto il massimo di {miei.limite} biglietti a persona. Non puoi effettuare altri acquisti.
        </Alert>
      )}

      <div className="acquisto">
        <form id="modulo-acquisto" className="acquisto__form" onSubmit={handleAcquisto} aria-busy={inInvio}>
          <fieldset className="scelta" disabled={limiteRaggiunto || inInvio}>
            <legend>
              <span className="scelta__n">1</span> Scegli il settore
            </legend>
            {caricamento && <div className="scheletro scheletro--opzione" />}
            <div className="opzioni" role="radiogroup" aria-label="Settore">
              {settori.map((s) => {
                const liberi = Number(s.biglietti_disponibili);
                const esaurito = liberi <= 0;
                const t = temaSettore(s.nome_settore, s.id_settore);
                return (
                  <label key={s.id_settore} className={`opzione tema-${t}${esaurito ? ' opzione--esaurita' : ''}`}>
                    <input
                      type="radio"
                      name="settore"
                      value={s.id_settore}
                      checked={s.id_settore === idEffettivo}
                      disabled={esaurito}
                      onChange={() => setScelta(s.id_settore)}
                    />
                    <span className="opzione__corpo">
                      <span className="opzione__nome">{s.nome_settore}</span>
                      <span className="opzione__prezzo">{euro(s.prezzo)}</span>
                      <span className="opzione__disp">
                        {esaurito ? 'Esaurito' : `${liberi} liberi su ${Number(s.capacita_max)}`}
                      </span>
                      <span className="opzione__barra" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (liberi / Number(s.capacita_max || 1)) * 100)}%` }} />
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="scelta" disabled={limiteRaggiunto || inInvio || !settore}>
            <legend>
              <span className="scelta__n">2</span> Quanti biglietti?
            </legend>
            <div className="stepper" role="group" aria-label="Quantità di biglietti">
              <button
                type="button"
                className="stepper__btn"
                onClick={() => setQuantita(q - 1)}
                disabled={q <= 1}
                aria-label="Un biglietto in meno"
              >
                <Icon nome="meno" />
              </button>
              <output className="stepper__valore" aria-live="polite">
                <AnimatedNumber value={q} durata={250} />
              </output>
              <button
                type="button"
                className="stepper__btn"
                onClick={() => setQuantita(q + 1)}
                disabled={q >= massimo}
                aria-label="Un biglietto in più"
              >
                <Icon nome="piu" />
              </button>
              <p className="stepper__nota">
                {massimo > 0
                  ? `Puoi sceglierne fino a ${massimo} in questo ordine.`
                  : limiteRaggiunto
                    ? 'Limite per persona raggiunto.'
                    : 'Settore esaurito: scegline un altro.'}
              </p>
            </div>
          </fieldset>
        </form>

        <aside className="acquisto__riepilogo" aria-label="Riepilogo ordine">
          {conferma ? (
            <div className={`stub-verticale stub-verticale--conferma tema-${conferma.tema}`}>
              <Confetti />
              <div className="stub-verticale__forma">
                <div className="stub-verticale__testa">
                  <span className="timbro-conferma">Confermato</span>
                  <h2>Ordine n° {conferma.id_ordine}</h2>
                </div>
                <div className="stub-verticale__corpo">
                  <p className="conferma__riga">
                    {conferma.quantita} × {conferma.nome_settore}
                  </p>
                  <p className="conferma__totale">{euroPreciso(conferma.totale)}</p>
                  <p className="conferma__nota">
                    I biglietti sono tuoi: li trovi nell&rsquo;elenco ordini qui sotto.
                  </p>
                  <div className="conferma__azioni">
                    {miei.rimanenti > 0 ? (
                      <button type="button" className="btn btn--primary" onClick={nuovoAcquisto}>
                        Acquista ancora
                      </button>
                    ) : (
                      <Link to="/" className="btn btn--primary">
                        Torna ai settori
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`stub-verticale tema-${tema}`}>
              <div className="stub-verticale__forma">
                <div className="stub-verticale__testa">
                  <p className="stub-verticale__piccolo">Il tuo ordine</p>
                  <h2>{settore?.nome_settore ?? '—'}</h2>
                </div>
                <div className="stub-verticale__corpo">
                  <dl className="riepilogo">
                    <div>
                      <dt>Prezzo a biglietto</dt>
                      <dd>{euro(prezzo)}</dd>
                    </div>
                    <div>
                      <dt>Quantità</dt>
                      <dd>{q}</dd>
                    </div>
                    <div>
                      <dt>Intestatario</dt>
                      <dd>
                        {user?.nome} {user?.cognome}
                      </dd>
                    </div>
                  </dl>
                  <p className="riepilogo__totale">
                    <span>Totale</span>
                    <strong>
                      <AnimatedNumber value={totale} format={(n) => euroPreciso(n)} durata={450} />
                    </strong>
                  </p>
                  <button
                    type="submit"
                    form="modulo-acquisto"
                    className="btn btn--primary btn--blocco btn--grande"
                    disabled={!pronto}
                  >
                    {inInvio ? (
                      <>
                        <Equalizer /> Elaborazione…
                      </>
                    ) : (
                      'Conferma e acquista'
                    )}
                  </button>
                  <p className="riepilogo__nota">Vendita simulata: non viene addebitato nulla.</p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <section className="sezione" aria-labelledby="titolo-ordini">
        <header className="sezione__testa">
          <h2 id="titolo-ordini">I tuoi ordini</h2>
        </header>
        {mieiPronti && miei.ordini.length === 0 ? (
          <p className="vuoto">Non hai ancora ordini. Scegli un settore e prenota: i tuoi biglietti compariranno qui.</p>
        ) : (
          <ul className="ordini">
            {miei.ordini.map((o) => (
              <li key={o.id_ordine} className={`ordine tema-${temaSettore(o.nome_settore, o.id_settore)}`}>
                <span className="ordine__fascia" aria-hidden="true" />
                <div className="ordine__info">
                  <strong>Ordine n° {o.id_ordine}</strong>
                  <span>{dataOra(o.data_ora)}</span>
                </div>
                <div className="ordine__info">
                  <strong>
                    {o.quantita} × {o.nome_settore}
                  </strong>
                  <span>{euro(o.totale)} in totale</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import Alert from '../components/Alert';
import AnimatedNumber from '../components/AnimatedNumber';
import Icon from '../components/Icon';
import Loader from '../components/Loader';
import { usePageTitle } from '../hooks/usePageTitle';
import API, { messaggioErrore } from '../services/api';
import { dataOra, euro, euroPreciso, oraEsatta, temaSettore } from '../services/format';

const CONTROLLI = [
  ['acquisti_non_autorizzati', 'Biglietti venduti a chi non aveva diritto', 'Utenti non abilitati o senza codice che risultano aver acquistato.'],
  ['utenti_oltre_limite', 'Utenti oltre il limite antiscalping', 'Persone con più biglietti del massimo consentito.'],
  ['biglietti_incoerenti', 'Biglietti con stato incoerente', 'Segnati come venduti senza ordine, o in un ordine ma risultanti liberi.'],
  ['settori_overbooking', 'Settori in overbooking', 'Più biglietti venduti della capienza del settore.'],
];

/** Anello che mostra la quota di un valore sul totale (SVG, con animazione di tracciamento). */
function Anello({ parte, totale, etichetta, colore = 'var(--accento)' }) {
  const r = 52;
  const circonferenza = 2 * Math.PI * r;
  const quota = totale > 0 ? Math.min(1, parte / totale) : 0;
  return (
    <svg className="anello" viewBox="0 0 140 140" role="img" aria-label={etichetta}>
      <circle cx="70" cy="70" r={r} className="anello__base" />
      <circle
        cx="70"
        cy="70"
        r={r}
        className="anello__valore"
        style={{ stroke: colore, strokeDasharray: `${circonferenza * quota} ${circonferenza}` }}
        transform="rotate(-90 70 70)"
      />
    </svg>
  );
}

export default function Admin() {
  usePageTitle('Dashboard amministratore');
  const [stats, setStats] = useState(null);
  const [errore, setErrore] = useState(null);
  const [aggiornando, setAggiornando] = useState(false);
  const [aggiornatoAlle, setAggiornatoAlle] = useState(null);
  const [richiesta, setRichiesta] = useState(0); // cresce a ogni richiesta di aggiornamento

  useEffect(() => {
    let attivo = true;
    API.get('/admin/statistiche')
      .then((res) => {
        if (!attivo) return;
        setStats(res.data);
        setErrore(null);
        setAggiornatoAlle(new Date());
      })
      .catch((err) => {
        if (attivo) setErrore(messaggioErrore(err, 'Impossibile caricare le statistiche amministrative.'));
      })
      .finally(() => {
        if (attivo) setAggiornando(false);
      });
    return () => {
      attivo = false;
    };
  }, [richiesta]);

  const carica = () => {
    setAggiornando(true);
    setRichiesta((n) => n + 1);
  };

  if (!stats && !errore) return <Loader testo="Calcolo le statistiche…" />;

  const intestazione = (
    <header className="intestazione">
      <div>
        <h1>Dashboard amministratore</h1>
        <p className="intestazione__sotto">Vendite, abilitazioni e controlli di audit sui dati reali del database.</p>
      </div>
      <div className="diretta">
        {aggiornatoAlle && <span className="diretta__ora">Aggiornato alle {oraEsatta(aggiornatoAlle)}</span>}
        <button type="button" className="btn btn--sm" onClick={carica} disabled={aggiornando}>
          <Icon nome="aggiorna" dimensione={18} className={aggiornando ? 'gira' : ''} />
          {aggiornando ? 'Aggiorno…' : 'Aggiorna'}
        </button>
      </div>
    </header>
  );

  if (!stats) {
    return (
      <div className="pagina pagina--admin">
        {intestazione}
        <Alert tipo="errore">{errore}</Alert>
      </div>
    );
  }

  const { audit, biglietti, settori, utenti, incasso, ordini_recenti: recenti, elenco_utenti: elenco } = stats;
  const venduti = biglietti.totale_venduti;
  const postiTotali = settori.reduce((somma, s) => somma + s.biglietti_venduti + s.biglietti_rimasti, 0);
  const tassoAbilitati = utenti.totale_iscritti > 0 ? (utenti.utenti_abilitati / utenti.totale_iscritti) * 100 : 0;
  const maxIncasso = Math.max(1, ...settori.map((s) => Number(s.incasso_settore)));
  const maxIstogramma = Math.max(1, ...biglietti.acquirenti_per_quantita.map((x) => x.acquirenti));
  const nAcquirenti = biglietti.biglietti_per_se;

  return (
    <div className="pagina pagina--admin">
      {intestazione}
      {errore && <Alert tipo="errore">{errore}</Alert>}

      <section className={`sentinella ${audit.integro ? 'sentinella--ok' : 'sentinella--allarme'}`} aria-labelledby="titolo-sentinella">
        <div className="sentinella__stato">
          <span className="sentinella__faro" aria-hidden="true">
            <Icon nome={audit.integro ? 'scudo' : 'avviso'} dimensione={34} spessore={1.7} />
          </span>
          <div>
            <h2 id="titolo-sentinella">{audit.integro ? 'Sistema integro' : `${audit.anomalie_totali} anomalie rilevate`}</h2>
            <p>
              {audit.integro
                ? 'Nessun biglietto è stato venduto senza diritto, nessun utente supera il limite e le vendite coincidono con gli ordini.'
                : 'Alcuni dati non rispettano le regole di vendita: controlla i punti evidenziati qui sotto.'}
            </p>
          </div>
        </div>
        <ul className="controlli">
          {CONTROLLI.map(([chiave, titolo, descrizione]) => {
            const valore = audit[chiave];
            return (
              <li key={chiave} className={valore === 0 ? 'controllo controllo--ok' : 'controllo controllo--ko'}>
                <Icon nome={valore === 0 ? 'spunta' : 'avviso'} dimensione={18} />
                <div>
                  <strong>{titolo}</strong>
                  <span>{descrizione}</span>
                </div>
                <b className="controllo__valore">{valore}</b>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="kpi" aria-label="Indicatori principali">
        <div className="kpi__voce tema-butter">
          <p className="kpi__etichetta">Biglietti venduti</p>
          <p className="kpi__valore">
            <AnimatedNumber value={venduti} da={0} />
            <small> / {postiTotali}</small>
          </p>
        </div>
        <div className="kpi__voce tema-mint">
          <p className="kpi__etichetta">Incasso totale</p>
          <p className="kpi__valore">
            <AnimatedNumber value={Number(incasso.totale)} da={0} format={(n) => euro(Math.round(n))} />
          </p>
        </div>
        <div className="kpi__voce tema-sky">
          <p className="kpi__etichetta">Ordini</p>
          <p className="kpi__valore">
            <AnimatedNumber value={incasso.ordini} da={0} />
          </p>
        </div>
        <div className="kpi__voce tema-lilac">
          <p className="kpi__etichetta">Iscritti abilitati</p>
          <p className="kpi__valore">
            <AnimatedNumber value={tassoAbilitati} da={0} format={(n) => `${n.toFixed(0)}%`} />
            <small>
              {' '}
              {utenti.utenti_abilitati} su {utenti.totale_iscritti}
            </small>
          </p>
        </div>
      </section>

      <div className="griglia-admin">
        <section className="pannello" aria-labelledby="t-settori">
          <h2 id="t-settori">Vendite e incassi per settore</h2>
          <ul className="barre">
            {settori.map((s) => {
              const totale = s.biglietti_venduti + s.biglietti_rimasti;
              const quota = totale > 0 ? (s.biglietti_venduti / totale) * 100 : 0;
              return (
                <li key={s.id_settore} className={`barra-settore tema-${temaSettore(s.nome_settore, s.id_settore)}`}>
                  <div className="barra-settore__testa">
                    <strong>{s.nome_settore}</strong>
                    <span>{euro(s.prezzo)} a biglietto</span>
                  </div>
                  <div
                    className="barra-settore__pista"
                    role="img"
                    aria-label={`${s.biglietti_venduti} venduti su ${totale}`}
                  >
                    <i style={{ width: `${quota}%` }} />
                  </div>
                  <div className="barra-settore__dati">
                    <span>
                      <b>{s.biglietti_venduti}</b> venduti
                    </span>
                    <span>
                      <b>{s.biglietti_rimasti}</b> rimasti
                    </span>
                    <span className="barra-settore__incasso" style={{ '--q': Number(s.incasso_settore) / maxIncasso }}>
                      <b>{euroPreciso(s.incasso_settore)}</b>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="pannello" aria-labelledby="t-rapporto">
          <h2 id="t-rapporto">Biglietti per sé e per accompagnatori</h2>
          <div className="rapporto">
            <div className="rapporto__anello">
              <Anello
                parte={biglietti.biglietti_per_se}
                totale={venduti}
                etichetta={`${biglietti.biglietti_per_se} biglietti per sé su ${venduti}`}
                colore="var(--lilla-vivo)"
              />
              <p className="rapporto__centro">
                <strong>
                  <AnimatedNumber value={venduti} da={0} />
                </strong>
                <span>venduti</span>
              </p>
            </div>
            <dl className="legenda">
              <div>
                <dt>
                  <i className="legenda__chip legenda__chip--a" /> Per sé (intestatario)
                </dt>
                <dd>{biglietti.biglietti_per_se}</dd>
              </div>
              <div>
                <dt>
                  <i className="legenda__chip legenda__chip--b" /> Per accompagnatori
                </dt>
                <dd>{biglietti.biglietti_per_altri}</dd>
              </div>
            </dl>
          </div>
          <p className="pannello__nota">
            Ogni acquirente conta un biglietto per sé: tutti gli altri che ha comprato sono per accompagnatori.
          </p>
        </section>

        <section className="pannello" aria-labelledby="t-quantita">
          <h2 id="t-quantita">Quanti biglietti compra ogni acquirente</h2>
          {nAcquirenti === 0 ? (
            <p className="vuoto vuoto--piccolo">Nessun acquisto ancora: l&rsquo;istogramma comparirà con i primi ordini.</p>
          ) : (
            <ul className="istogramma">
              {biglietti.acquirenti_per_quantita.map((x) => (
                <li key={x.biglietti}>
                  <span className="istogramma__n">{x.acquirenti}</span>
                  <span className="istogramma__colonna" style={{ '--h': x.acquirenti / maxIstogramma }} />
                  <span className="istogramma__et">
                    {x.biglietti} {x.biglietti === 1 ? 'biglietto' : 'biglietti'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pannello" aria-labelledby="t-abilitati">
          <h2 id="t-abilitati">Iscritti con codice di prelazione</h2>
          <div className="rapporto">
            <div className="rapporto__anello">
              <Anello
                parte={utenti.utenti_abilitati}
                totale={utenti.totale_iscritti}
                etichetta={`${utenti.utenti_abilitati} abilitati su ${utenti.totale_iscritti} iscritti`}
                colore="var(--menta-vivo)"
              />
              <p className="rapporto__centro">
                <strong>
                  <AnimatedNumber value={tassoAbilitati} da={0} format={(n) => `${n.toFixed(0)}%`} />
                </strong>
                <span>abilitati</span>
              </p>
            </div>
            <dl className="legenda">
              <div>
                <dt>Iscritti (clienti)</dt>
                <dd>{utenti.totale_iscritti}</dd>
              </div>
              <div>
                <dt>Con codice</dt>
                <dd>{utenti.utenti_abilitati}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section className="sezione" aria-labelledby="t-recenti">
        <header className="sezione__testa">
          <h2 id="t-recenti">Ultimi ordini</h2>
        </header>
        {recenti.length === 0 ? (
          <p className="vuoto">Nessun ordine registrato finora.</p>
        ) : (
          <div className="tabella-scroll">
            <table className="tabella">
              <thead>
                <tr>
                  <th scope="col">Ordine</th>
                  <th scope="col">Quando</th>
                  <th scope="col">Acquirente</th>
                  <th scope="col">Settore</th>
                  <th scope="col" className="num">Biglietti</th>
                  <th scope="col" className="num">Totale</th>
                </tr>
              </thead>
              <tbody>
                {recenti.map((o) => (
                  <tr key={o.id_ordine}>
                    <td>n° {o.id_ordine}</td>
                    <td>{dataOra(o.data_ora)}</td>
                    <td>
                      {o.nome} {o.cognome}
                      <small>{o.email}</small>
                    </td>
                    <td>{o.settore}</td>
                    <td className="num">{o.quantita}</td>
                    <td className="num">{euroPreciso(o.totale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sezione" aria-labelledby="t-utenti">
        <header className="sezione__testa">
          <h2 id="t-utenti">Clienti e codici di prelazione</h2>
        </header>
        {elenco.length === 0 ? (
          <p className="vuoto">Nessun cliente registrato.</p>
        ) : (
          <div className="tabella-scroll">
            <table className="tabella">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Codice</th>
                  <th scope="col">Stato</th>
                  <th scope="col" className="num">Biglietti</th>
                </tr>
              </thead>
              <tbody>
                {elenco.map((u) => (
                  <tr key={u.id_utente}>
                    <td>
                      {u.nome} {u.cognome}
                      <small>{u.email}</small>
                    </td>
                    <td>{u.codice_accesso ? <code className="codice">{u.codice_accesso}</code> : '—'}</td>
                    <td>
                      <span className={`etichetta ${u.abilitato ? 'etichetta--ok' : ''}`}>
                        {u.abilitato ? 'Abilitato' : 'Senza prelazione'}
                      </span>
                    </td>
                    <td className="num">
                      {u.biglietti} / {stats.max_biglietti_per_utente}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

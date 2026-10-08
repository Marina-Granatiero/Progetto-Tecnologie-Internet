import React, { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function Acquista() {
  const { user } = useContext(AuthContext);
  const [settori, setSettori] = useState([]);
  const [settoreSelezionato, setSettoreSelezionato] = useState('');
  const [quantita, setQuantita] = useState(1);
  const [messaggio, setMessaggio] = useState(null);
  const [errore, setErrore] = useState(null);
  const [inInvio, setInInvio] = useState(false);

  useEffect(() => {
    API.get('/settori')
      .then((res) => {
        setSettori(res.data);
        if (res.data.length > 0) {
          setSettoreSelezionato(res.data[0].id_settore);
        }
      })
      .catch(() => setErrore('Errore nel recupero della disponibilità settori.'));
  }, []);

  const handleAcquisto = async (e) => {
    e.preventDefault();
    setMessaggio(null);
    setErrore(null);
    setInInvio(true);

    try {
      const res = await API.post('/ordini', {
        id_settore: Number(settoreSelezionato),
        quantita: Number(quantita)
      });
      setMessaggio(`Acquisto completato con successo! Ordine #${res.data.id_ordine} - Totale: €${parseFloat(res.data.totale).toFixed(2)}`);
      setQuantita(1);
    } catch (err) {
      setErrore(err.response?.data?.error || 'Errore durante la transazione.');
    } finally {
      setInInvio(false);
    }
  };

  const settoreAttuale = settori.find((s) => s.id_settore === Number(settoreSelezionato));
  const totaleCalcolato = settoreAttuale ? (settoreAttuale.prezzo * quantita).toFixed(2) : '0.00';

  return (
    <div>
      <h2>Prenotazione Biglietti</h2>
      <p>Utente abilitato: <strong>{user?.nome} {user?.cognome}</strong> (Codice: <code>{user?.codice_accesso}</code>)</p>
      
      {messaggio && <p style={{ color: 'green', fontWeight: 'bold' }}>{messaggio}</p>}
      {errore && <p style={{ color: 'red', fontWeight: 'bold' }}>{errore}</p>}

      <form onSubmit={handleAcquisto} style={{ display: 'flex', flexDirection: 'column', maxWidth: '350px', gap: '15px' }}>
        <label>
          Seleziona Settore:
          <select 
            value={settoreSelezionato} 
            onChange={(e) => setSettoreSelezionato(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          >
            {settori.map((s) => (
              <option key={s.id_settore} value={s.id_settore} disabled={s.biglietti_disponibili <= 0}>
                {s.nome_settore} - €{parseFloat(s.prezzo).toFixed(2)} ({s.biglietti_disponibili} disponibili)
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantità (Massimo 4 per utente):
          <input 
            type="number" 
            min="1" 
            max="4" 
            value={quantita} 
            onChange={(e) => setQuantita(Math.min(4, Math.max(1, Number(e.target.value))))}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required 
          />
        </label>

        <p>Totale da corrispondere: <strong>€{totaleCalcolato}</strong></p>

        <button type="submit" disabled={inInvio} style={{ padding: '10px' }}>
          {inInvio ? 'Elaborazione Transazione...' : 'Conferma e Acquista'}
        </button>
      </form>
    </div>
  );
}

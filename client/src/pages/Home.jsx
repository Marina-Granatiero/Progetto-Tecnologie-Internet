import React, { useState, useEffect } from 'react';
import API from '../services/api';

export default function Home() {
  const [settori, setSettori] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    API.get('/settori')
      .then((res) => {
        setSettori(res.data);
        setCaricamento(false);
      })
      .catch(() => {
        setErrore('Impossibile recuperare i settori dal database.');
        setCaricamento(false);
      });
  }, []);

  return (
    <div>
      <h2>Settori e Disponibilità Biglietti</h2>
      {caricamento && <p>Caricamento dati...</p>}
      {errore && <p style={{ color: 'red' }}>{errore}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        {settori.map((s) => (
          <div key={s.id_settore} style={{ border: '1px solid #ccc', padding: '12px' }}>
            <h3>{s.nome_settore}</h3>
            <p>Prezzo: €{parseFloat(s.prezzo).toFixed(2)}</p>
            <p>Capacità massima: {s.capacita_max}</p>
            <p>Biglietti disponibili: {s.biglietti_disponibili}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function Register() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [esito, setEsito] = useState(null);
  const [errore, setErrore] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrore(null);
    setEsito(null);
    try {
      const res = await API.post('/auth/register', { nome, cognome, email, password });
      setEsito(res.data);
      setTimeout(() => navigate('/login'), 3500);
    } catch (err) {
      setErrore(err.response?.data?.error || 'Errore durante la registrazione.');
    }
  };

  return (
    <div>
      <h2>Registrazione</h2>
      {errore && <p style={{ color: 'red' }}>{errore}</p>}
      {esito && (
        <div style={{ border: '1px solid green', padding: '10px', marginBottom: '10px' }}>
          <p>{esito.message}</p>
          {esito.utente.abilitato ? (
            <p>Sei abilitato con codice: <strong>{esito.utente.codice_accesso}</strong></p>
          ) : (
            <p>Registrazione completata come utente standard (soglia codici esaurita).</p>
          )}
          <p>Reindirizzamento al login in corso...</p>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '10px' }}>
        <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input type="text" placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Registrati</button>
      </form>
    </div>
  );
}

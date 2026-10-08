import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [messaggio, setMessaggio] = useState(null);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessaggio(null);
    try {
      const res = await API.post('/auth/login', { email, password });
      login(res.data.utente, res.data.token);
      navigate('/');
    } catch (err) {
      setMessaggio(err.response?.data?.error || 'Errore durante il login.');
    }
  };

  return (
    <div>
      <h2>Accedi</h2>
      {messaggio && <p style={{ color: 'red' }}>{messaggio}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '10px' }}>
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <button type="submit">Entra</button>
      </form>
    </div>
  );
}

import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{ padding: '10px 0', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <Link to="/">Home / Settori</Link>
        {!user && (
          <>
            <Link to="/login">Accedi</Link>
            <Link to="/register">Registrati</Link>
          </>
        )}
        {user && (
          <>
            {user.abilitato && <Link to="/acquista">Acquista Biglietti</Link>}
            {user.ruolo === 'admin' && <Link to="/admin">Dashboard Admin</Link>}
            <span>Utente: <strong>{user.nome} {user.cognome}</strong></span>
            {user.codice_accesso && <span>Codice: <code>{user.codice_accesso}</code></span>}
            <button onClick={handleLogout}>Esci</button>
          </>
        )}
      </div>
    </nav>
  );
}

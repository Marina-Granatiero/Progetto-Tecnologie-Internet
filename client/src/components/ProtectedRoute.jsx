import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <p>Verifica autorizzazioni in corso...</p>;
  }

  if (!user || !user.abilitato) {
    return <Navigate to="/" replace />;
  }

  return children;
}

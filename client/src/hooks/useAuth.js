import { useContext } from 'react';
import { AuthContext } from '../context/authContext';

export function useAuth() {
  const contesto = useContext(AuthContext);
  if (!contesto) throw new Error('useAuth va usato dentro <AuthProvider>.');
  return contesto;
}

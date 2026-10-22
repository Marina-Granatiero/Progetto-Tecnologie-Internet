import { createContext } from 'react';

// Il contesto vive in un file a sé (senza componenti) per far funzionare il fast refresh di Vite.
export const AuthContext = createContext(null);

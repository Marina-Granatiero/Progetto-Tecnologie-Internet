import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Backdrop from './components/Backdrop';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import PageTransition from './components/PageTransition';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthProvider';
import Acquista from './pages/Acquista';
import Admin from './pages/Admin';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Register from './pages/Register';

export default function App() {
  // Il tono iniziale dello sfondo è impostato subito, prima del primo disegno
  useEffect(() => {
    document.body.dataset.tono ||= 'lilac';
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Backdrop />
        <a className="salta-link" href="#contenuto">
          Vai al contenuto
        </a>
        <Navbar />
        <PageTransition>
          {(posizione) => (
            <Routes location={posizione}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/acquista"
                element={
                  <ProtectedRoute richiede="abilitato">
                    <Acquista />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute richiede="admin">
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </PageTransition>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  );
}

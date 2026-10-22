import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Pagina non trovata');
  return (
    <div className="pagina pagina--vuota">
      <p className="grande-404" aria-hidden="true">
        404
      </p>
      <h1>Questa pagina non esiste</h1>
      <p>L&rsquo;indirizzo potrebbe essere sbagliato o la pagina è stata spostata.</p>
      <Link to="/" className="btn btn--primary">
        Torna ai settori
      </Link>
    </div>
  );
}

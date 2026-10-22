import Icon from './Icon';
import { oraEsatta } from '../services/format';

/** "In diretta": mostra quando sono stati letti l'ultima volta i dati e permette di ricaricarli. */
export default function LiveBadge({ aggiornatoAlle, onRicarica }) {
  return (
    <div className="diretta">
      <span className="diretta__stato">
        <span className="diretta__punto" aria-hidden="true" />
        In diretta
      </span>
      {aggiornatoAlle && <span className="diretta__ora">Aggiornato alle {oraEsatta(aggiornatoAlle)}</span>}
      {onRicarica && (
        <button type="button" className="diretta__ricarica" onClick={onRicarica} aria-label="Aggiorna ora la disponibilità">
          <Icon nome="aggiorna" dimensione={18} />
        </button>
      )}
    </div>
  );
}

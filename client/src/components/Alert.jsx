import Icon from './Icon';

const ICONE = { errore: 'avviso', successo: 'spunta', info: 'info', attenzione: 'avviso' };

/** Messaggio di stato. Gli errori vengono annunciati subito dai lettori di schermo. */
export default function Alert({ tipo = 'info', children, onChiudi, className = '' }) {
  return (
    <div
      className={`avviso avviso--${tipo} ${className}`}
      role={tipo === 'errore' ? 'alert' : 'status'}
    >
      <Icon nome={ICONE[tipo]} className="avviso__icona" />
      <div className="avviso__testo">{children}</div>
      {onChiudi && (
        <button type="button" className="avviso__chiudi" onClick={onChiudi} aria-label="Chiudi il messaggio">
          <Icon nome="chiudi" dimensione={16} />
        </button>
      )}
    </div>
  );
}

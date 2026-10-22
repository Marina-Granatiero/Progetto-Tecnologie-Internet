import { useState } from 'react';
import Icon from './Icon';

/** Campo di modulo con etichetta, aiuto, errore associato e (opzionale) mostra/nascondi password. */
export default function Field({
  id,
  label,
  tipo = 'text',
  valore,
  onChange,
  errore,
  aiuto,
  mostraToggle = false,
  children,
  ...resto
}) {
  const [visibile, setVisibile] = useState(false);
  const tipoEffettivo = mostraToggle && visibile ? 'text' : tipo;
  const descrizioni = [errore ? `${id}-errore` : null, aiuto ? `${id}-aiuto` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`campo${errore ? ' campo--errore' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="campo__controllo">
        <input
          id={id}
          name={id}
          type={tipoEffettivo}
          value={valore}
          onChange={onChange}
          aria-invalid={errore ? 'true' : undefined}
          aria-describedby={descrizioni || undefined}
          {...resto}
        />
        {mostraToggle && (
          <button
            type="button"
            className="campo__occhio"
            onClick={() => setVisibile((v) => !v)}
            aria-label={visibile ? 'Nascondi la password' : 'Mostra la password'}
            aria-pressed={visibile}
          >
            <Icon nome={visibile ? 'occhioBarrato' : 'occhio'} />
          </button>
        )}
      </div>
      {children}
      {aiuto && (
        <p id={`${id}-aiuto`} className="campo__aiuto">
          {aiuto}
        </p>
      )}
      {errore && (
        <p id={`${id}-errore`} className="campo__errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

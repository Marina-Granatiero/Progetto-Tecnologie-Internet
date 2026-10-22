// Quattro barre da equalizzatore: è il segno del marchio e il caricamento dell'app.
export default function Equalizer({ className = '' }) {
  return (
    <span className={`eq ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

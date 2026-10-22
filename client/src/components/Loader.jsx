import Equalizer from './Equalizer';

export default function Loader({ testo = 'Caricamento…' }) {
  return (
    <div className="caricamento" role="status">
      <Equalizer className="eq--grande" />
      <p>{testo}</p>
    </div>
  );
}

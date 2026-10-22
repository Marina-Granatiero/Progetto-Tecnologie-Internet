import AnimatedNumber from './AnimatedNumber';
import SeatDots from './SeatDots';
import { euro, temaSettore } from '../services/format';

function stato(disponibili, capienza) {
  if (disponibili <= 0) return { chiave: 'esaurito', etichetta: 'Esaurito' };
  if (disponibili <= Math.max(3, capienza * 0.15)) return { chiave: 'ultimi', etichetta: 'Ultimi posti' };
  return { chiave: 'disponibile', etichetta: 'Disponibile' };
}

/** Biglietto-settore con strappo: fascia colorata (braccialetto) + matrice dei posti. */
export default function SectorCard({ settore, azione }) {
  const capienza = Number(settore.capacita_max);
  const disponibili = Number(settore.biglietti_disponibili);
  // I puntini rappresentano i posti realmente in vendita (può differire da capacita_max)
  const totale = disponibili + Number(settore.biglietti_venduti ?? Math.max(0, capienza - disponibili));
  const venduti = totale - disponibili;
  const tema = temaSettore(settore.nome_settore, settore.id_settore);
  const st = stato(disponibili, totale);

  return (
    <article className={`stub tema-${tema}`} data-stato={st.chiave}>
      <div className="stub__forma">
        <div className="stub__fascia">
          <span className={`stub__badge stub__badge--${st.chiave}`}>{st.etichetta}</span>
          <h3 className="stub__nome">{settore.nome_settore}</h3>
          <p className="stub__prezzo">
            <span className="stub__importo">{euro(settore.prezzo)}</span>
            <span className="stub__unita">a persona</span>
          </p>
        </div>
        <div className="stub__corpo">
          <SeatDots totale={totale} venduti={venduti} />
          {st.chiave === 'esaurito' && (
            <p className="stub__timbro" aria-hidden="true">
              Esaurito
            </p>
          )}
          <p className="stub__conteggio">
            <strong>
              <AnimatedNumber value={disponibili} da={0} />
            </strong>{' '}
            {disponibili === 1 ? 'posto libero' : 'posti liberi'} su {totale}
          </p>
          {azione && <div className="stub__azione">{azione}</div>}
        </div>
      </div>
    </article>
  );
}

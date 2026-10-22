import { useReducedMotion } from '../hooks/useReducedMotion';

const COLORI = ['#8B78FF', '#FF9A6B', '#33B987', '#5AA2F0', '#F2C230', '#F0699F'];
// pseudo-casuale deterministico: il rendering resta puro
const r = (i, k) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Esplosione di coriandoli pastello: appare per un attimo alla conferma dell'ordine. */
export default function Confetti({ quanti = 44 }) {
  const ridotto = useReducedMotion();
  if (ridotto) return null;

  return (
    <div className="coriandoli" aria-hidden="true">
      {Array.from({ length: quanti }, (_, i) => {
        const angolo = (i / quanti) * Math.PI * 2 + r(i, 1) * 0.6;
        const forza = 90 + r(i, 2) * 170;
        return (
          <span
            key={i}
            style={{
              '--dx': `${Math.cos(angolo) * forza}px`,
              '--dy': `${Math.sin(angolo) * forza - 60}px`,
              '--rot': `${Math.round(r(i, 3) * 720 - 360)}deg`,
              '--col': COLORI[i % COLORI.length],
              '--w': `${6 + Math.round(r(i, 4) * 6)}px`,
              '--rit': `${Math.round(r(i, 5) * 120)}ms`,
              borderRadius: i % 3 === 0 ? '50%' : '2px',
            }}
          />
        );
      })}
    </div>
  );
}

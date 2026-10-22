import { useEffect, useState } from 'react';

/** true non appena l'elemento entra (anche solo in parte) nella parte visibile della pagina. */
export function useInView(ref, { soglia = 0.15 } = {}) {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setVisibile(true));
      return () => cancelAnimationFrame(id);
    }
    const osservatore = new IntersectionObserver(
      ([voce]) => {
        if (voce.isIntersecting) {
          setVisibile(true);
          osservatore.disconnect();
        }
      },
      { threshold: soglia }
    );
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [ref, soglia]);

  return visibile;
}

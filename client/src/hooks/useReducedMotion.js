import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function iscriviti(callback) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

/** true se l'utente ha chiesto al sistema di ridurre le animazioni. */
export function useReducedMotion() {
  return useSyncExternalStore(
    iscriviti,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}

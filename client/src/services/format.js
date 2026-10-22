const euroIntero = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const euroCent = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** 120 -> "120 €" ; 120.5 -> "120,50 €" */
export function euro(valore) {
  const n = Number(valore) || 0;
  return Number.isInteger(n) ? euroIntero.format(n) : euroCent.format(n);
}

/** Sempre con i centesimi: 240 -> "240,00 €" */
export function euroPreciso(valore) {
  return euroCent.format(Number(valore) || 0);
}

export function dataOra(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function oraEsatta(data) {
  if (!data) return '';
  return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function iniziali(nome = '', cognome = '') {
  return `${nome.trim().charAt(0)}${cognome.trim().charAt(0)}`.toUpperCase() || '?';
}

/**
 * Tema cromatico di un settore. Per i settori noti il colore segue il "braccialetto"
 * (oro / azzurro / menta); per eventuali nuovi settori si ruota la tavolozza.
 */
const TEMI = ['butter', 'sky', 'mint', 'peach', 'rose', 'lilac'];
export function temaSettore(nome = '', id = 0) {
  if (/gold|pit/i.test(nome)) return 'butter';
  if (/tribuna/i.test(nome)) return 'sky';
  if (/prato/i.test(nome)) return 'mint';
  return TEMI[Math.abs(Number(id) || 0) % TEMI.length];
}

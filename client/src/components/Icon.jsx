// Piccola raccolta di icone a tratto (24x24), disegnate a mano: nessuna libreria esterna.
const PERCORSI = {
  occhio: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  occhioBarrato: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  spunta: <path d="M4 12.5l5 5L20 6.5" />,
  avviso: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.2M12 17.3v.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.2" />
    </>
  ),
  chiudi: <path d="M6 6l12 12M18 6 6 18" />,
  freccia: <path d="M5 12h14M13 6l6 6-6 6" />,
  biglietto: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v1.2a2.3 2.3 0 0 0 0 4.6v1.2a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-1.2a2.3 2.3 0 0 0 0-4.6V8.5Z" />
      <path d="M14.5 6.5v11" strokeDasharray="1.6 2.2" />
    </>
  ),
  esci: (
    <>
      <path d="M9 4.5H6.5A2.5 2.5 0 0 0 4 7v10a2.5 2.5 0 0 0 2.5 2.5H9" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
  aggiorna: (
    <>
      <path d="M20 11a8 8 0 0 0-14.5-4.2L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 14.5 4.2L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </>
  ),
  copia: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  meno: <path d="M5 12h14" />,
  piu: <path d="M12 5v14M5 12h14" />,
  scudo: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.3 2.3 4.2-4.6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  utenti: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 5.3a3.3 3.3 0 0 1 0 6.4M18 14.8c1.9.6 3.1 2.3 3.5 5.2" />
    </>
  ),
  euro: (
    <>
      <path d="M17.5 6.2A7 7 0 0 0 7 9.4M17.5 17.8A7 7 0 0 1 7 14.6" />
      <path d="M4.5 10.5h9M4.5 13.5h9" />
    </>
  ),
};

export default function Icon({ nome, dimensione = 20, className = '', spessore = 1.9 }) {
  return (
    <svg
      className={`icona ${className}`}
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={spessore}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PERCORSI[nome]}
    </svg>
  );
}

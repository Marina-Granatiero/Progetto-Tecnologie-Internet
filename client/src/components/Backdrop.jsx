// Sfondo: forme piatte color pastello (stile carta ritagliata). Il colore cambia con la pagina
// grazie alle variabili --tono-a/--tono-b animate in CSS dall'attributo data-tono su <body>.
export default function Backdrop() {
  return (
    <div className="sfondo" aria-hidden="true">
      <span className="sfondo__forma sfondo__forma--a" />
      <span className="sfondo__forma sfondo__forma--b" />
      <span className="sfondo__forma sfondo__forma--c" />
      <span className="sfondo__grana" />
    </div>
  );
}

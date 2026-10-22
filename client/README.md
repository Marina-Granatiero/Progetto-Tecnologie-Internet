# Client – React + Vite

Interfaccia della piattaforma di vendita biglietti. La documentazione generale è nel [README della repository](../README.md).

```bash
npm install
npm run dev        # sviluppo su http://localhost:5173 (il server API deve girare su :5000)
npm run build      # build di produzione in dist/
npm run lint       # ESLint (react-hooks v7): deve restare a 0 problemi
npm run test:e2e   # collaudo nel browser (richiede Playwright, vedi README principale)
```

- L'indirizzo dell'API è `http://<host>:5000/api`; si cambia con la variabile `VITE_API_URL` (file `.env` in questa cartella).
- Gli stili sono in `src/styles/`: `tokens.css` (palette, font, forme), `base.css`, `layout.css` (sfondo, barra, sipario di transizione), `components.css` (bottoni, form, biglietti con strappo, puntini dei posti), `pages.css` (pagine e responsive). `src/index.css` li importa nell'ordine corretto.
- I font (Bricolage Grotesque, Figtree, DM Mono – licenza OFL, testi in `public/fonts/`) sono serviti dal progetto stesso.
- Tutte le animazioni rispettano `prefers-reduced-motion`.

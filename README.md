# Piattaforma Web Vendita Biglietti Concerto
**Esame di Tecnologie Internet – Università di Parma**
**Candidata:** Marina Granatiero (Matricola: 367801) - Corso di Laurea LIIET

Applicazione web completa per la vendita simulata di biglietti per un concerto ad alta richiesta: i **primi 5 iscritti** ricevono un **codice di prelazione**, ogni utente può comprare **al massimo 4 biglietti** e nessun posto può essere venduto due volte, nemmeno con acquisti simultanei.

![Home](docs/img/01-home.png)

> Documentazione tecnica completa (requisiti, schema 3NF, concorrenza, sicurezza, collaudo): **[docs/relazione-tecnica.md](docs/relazione-tecnica.md)**

---

## Stack tecnologico
| Livello | Tecnologie |
|---|---|
| Front-end | React 19 (Vite), React Router 7, Axios, CSS puro (nessun framework UI) |
| Back-end | Node.js ≥ 20, Express 5, mysql2/promise (pool), bcryptjs, jsonwebtoken, dotenv |
| Database | MySQL 5.7+/8 oppure MariaDB 10.2+ (XAMPP), motore InnoDB, transazioni ACID |
| Test | `node:test` (74 test su database reale), Playwright (collaudo nel browser), ESLint |

## Struttura della repository
```
client/                 interfaccia React (Vite)
  src/components/       Navbar, SectorCard, HeroTicket, ProtectedRoute, PageTransition…
  src/context/          AuthProvider (sessione utente + JWT)
  src/hooks/            useSettori (tempo reale), useRegole, useAuth…
  src/pages/            Home, Login, Register, Acquista, Admin, NotFound
  src/services/         api.js (Axios + interceptor), format.js, storage.js
  src/styles/           design system: tokens, base, layout, componenti, pagine
  e2e/scenario.mjs      collaudo end-to-end nel browser (Playwright)
server/                 API REST (Express)
  controllers/          auth, ordini (transazione ACID), settori, admin
  middleware/           authMiddleware (JWT), adminMiddleware, errorHandler
  database/schema.sql   schema 3NF + dati di prova + trigger antiscalping
  scripts/init-db.js    crea/azzera il database (npm run db:init / db:reset)
  tests/                74 test automatici (unitari, API, concorrenza, sicurezza)
docs/                   relazione tecnica e screenshot
```

## Avvio rapido (Windows + XAMPP)

**1. Database** – avvia *MySQL* dal pannello di XAMPP, poi:
```bash
cd server
npm install
copy .env.example .env      # (Linux/macOS: cp .env.example .env) e, se serve, modifica i valori
npm run db:init             # crea concerto_db, tabelle, dati di prova, trigger e utente admin
```
In alternativa importa `server/database/schema.sql` da phpMyAdmin (scheda *Importa*).
Hai già un `concerto_db` con i tuoi dati? Non serve rifarlo: esegui solo, se vuoi, `server/database/aggiornamento_giornata9.sql` (non cancella nulla).

**2. Server API** (porta 5000)
```bash
cd server
npm start                   # oppure: npm run dev  (riavvio automatico)
```
Verifica: <http://localhost:5000/api/health> deve rispondere `{"status":"ok","database":"raggiungibile"}`.

**3. Client** (porta 5173)
```bash
cd client
npm install
npm run dev
```
Apri <http://localhost:5173>.

**Account di prova:** `admin@concerto.it` / `admin123` (amministratore). I clienti si creano dalla pagina *Registrati*: i primi 5 ricevono il codice `TICKET-XXXXXX`.

### Configurazione (`server/.env`)
| Variabile | Predefinito | Note |
|---|---|---|
| `PORT` | 5000 | porta del server |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | localhost, 3306, root, *(vuota)*, concerto_db | XAMPP: utente `root` senza password |
| `JWT_SECRET` | **obbligatoria** | il server non parte senza (nessuna chiave di ripiego nel codice) |
| `JWT_EXPIRES_IN` | 24h | durata dei token |
| `SOGLIA_PRIMI_ISCRITTI`, `MAX_BIGLIETTI_PER_UTENTE` | 5, 4 | regole di business; il client le legge da `/api/regole` |
| `CLIENT_ORIGIN` | *(vuoto = tutti)* | origine consentita dal CORS, es. `http://localhost:5173` |

Il client chiama `http://<host>:5000/api`; per un altro indirizzo imposta `VITE_API_URL` (es. in `client/.env`).

## Test
```bash
# Server: 74 test su un database dedicato "concerto_test" (creato e azzerato dai test)
cd server && npm test

# Qualità del codice client
cd client && npm run lint

# Collaudo nel browser (21 verifiche): servono server + client avviati e un DB appena azzerato
cd server && npm run db:reset                    # ATTENZIONE: cancella concerto_db
cd ../client
npm install --no-save playwright && npx playwright install chromium
npm run test:e2e                                 # E2E_SHOTS=cartella per salvare gli screenshot
```
I test del server **non toccano mai** `concerto_db`: il nome del database di test deve contenere "test" (variabile `TEST_DB_NAME`).

## API REST
Tutte le risposte sono JSON; gli errori hanno la forma `{ "error": "messaggio" }`.

| Metodo e percorso | Accesso | Descrizione | Codici di errore |
|---|---|---|---|
| `GET /api/health` | pubblico | stato server e database | 503 |
| `GET /api/settori` | pubblico | settori con prezzo, posti disponibili e venduti (tempo reale) | – |
| `GET /api/regole` | pubblico | soglia primi iscritti, limite biglietti, codici già assegnati | – |
| `POST /api/auth/register` | pubblico | registrazione; i primi 5 clienti ottengono `abilitato` e il codice | 400 dati non validi, 409 email già usata |
| `POST /api/auth/login` | pubblico | restituisce `token` JWT e dati utente | 400, 401 credenziali errate |
| `GET /api/auth/me` | JWT | dati aggiornati dell'utente (letti dal database) | 401 |
| `POST /api/ordini` | JWT + abilitato | acquisto `{ id_settore, quantita }` in un'unica transazione | 400, 401, 403 non abilitato, 404 settore, 409 limite superato / posti esauriti |
| `GET /api/ordini/miei` | JWT | storico ordini, biglietti acquistati e rimanenti | 401 |
| `GET /api/admin/statistiche` | JWT + admin | statistiche aggregate e audit (sentinella) | 401, 403 |

## Scelte di progetto da conoscere
- **Primi 5 iscritti**: contano solo gli utenti con ruolo `cliente` (l'amministratore non occupa un posto) e la registrazione è serializzata con un lock, quindi due iscrizioni simultanee non possono superare la soglia.
- **Limite dei 4 biglietti**: è *storico* (somma di tutti gli ordini dell'utente), controllato in transazione con lock sulla riga dell'utente e ribadito da un trigger del database.
- **Per sé / accompagnatori** (dashboard admin): ogni acquirente conta **1 biglietto per sé**, tutti gli altri che ha comprato sono per accompagnatori.
- **Password** salvate solo come hash bcrypt. Se nel database esistono vecchie password in chiaro, vengono convertite in automatico al primo login riuscito.
- **Ruolo e abilitazione** non si fidano mai del token né del `localStorage`: il server li rilegge dal database a ogni richiesta sensibile.
- **Pagamento simulato**: nessun dato di pagamento viene richiesto o salvato.

## Risoluzione dei problemi
| Sintomo | Causa e rimedio |
|---|---|
| `JWT_SECRET non impostato` | manca `server/.env`: copia `.env.example` |
| `Cannot find module …` | esegui `npm install` nella cartella `server` (o `client`) |
| `Porta 5000 già in uso` | un altro server è attivo: chiudilo oppure cambia `PORT` (e `VITE_API_URL` nel client) |
| `Access denied` / `Unknown database` | MySQL non avviato, credenziali in `.env` errate, oppure manca `npm run db:init` |
| Il client mostra "Impossibile recuperare i settori" | il server non è raggiungibile su :5000 (controlla `/api/health`) |
| `npm test` fallisce subito | MySQL deve essere acceso; l'utente deve poter creare database |

## Cronologia delle giornate
| Giornata | Contenuto | Stato |
|---|---|---|
| 1 | Requisiti, schema ER/3NF, database e dati di prova | ✔ |
| 2 | Express, pool mysql2, `.env`, middleware globali | ✔ |
| 3 | Registrazione bcrypt, soglia primi iscritti, login JWT, `authMiddleware` | ✔ |
| 4 | `POST /api/ordini` transazionale con `SELECT … FOR UPDATE` e antiscalping | ✔ |
| 5 | Client React (Vite), Axios con interceptor, AuthContext, Navbar, Home/Login/Register | ✔ |
| 6 | `ProtectedRoute`, `Acquista.jsx`, gestione errori della transazione | ✔ |
| 7 | Rotte riservate admin, statistiche aggregate, sentinella di audit, `Admin.jsx` | ✔ |
| 8 | Restyling grafico pastello con transizioni | ✔ |
| 9 | Collaudo (bypass URL, limite 4, acquisti simultanei), relazione tecnica | ✔ |

Per sincronizzare il repository: `git add -A`, `git commit -m "Giornate 6-9: …"`, `git push`.

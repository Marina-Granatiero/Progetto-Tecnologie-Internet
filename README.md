# Piattaforma Web Vendita Biglietti Concerto
**Esame di Tecnologie Internet – Università di Parma**
**Candidata:** Marina Granatiero (Matricola: 367801) - Corso di Laurea LIIET

---

## Descrizione del Progetto
Applicazione web completa per la simulazione e vendita di biglietti per eventi musicali ad alta richiesta con accesso regolato tramite codice univoco di prelazione.

### Architettura Tecnologica
- **Front-end:** Single Page Application dinamica realizzata con React.
- **Back-end:** Server HTTP e API RESTful sviluppati in Node.js con Express.
- **Database:** RDBMS MySQL (transazioni ACID per la concorrenza e prevenzione overbooking).

### Struttura della Repository
- `/client`: interfaccia grafica utente e dashboard amministrativa.
- `/server`: logica applicativa, rotte REST e controller.
- `/server/database/schema.sql`: script DDL per la creazione delle tabelle del database.
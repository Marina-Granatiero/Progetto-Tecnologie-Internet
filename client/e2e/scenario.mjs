// Collaudo end-to-end del client nel browser (Giornata 9).
//
// Prerequisiti (vedi README): server avviato su :5000 con un database APPENA azzerato
// (cd server && npm run db:reset), client avviato su :5173 (npm run dev) e Playwright installato:
//   cd client && npm install --no-save playwright && npx playwright install chromium
//
// Esecuzione:  npm run test:e2e
// Variabili opzionali:  BASE_URL, API_URL, E2E_SHOTS=cartella (salva gli screenshot), E2E_HEADED=1,
// E2E_DEBUG=1 (stampa subito gli errori della console del browser, per capire in quale passo avvengono)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:5000/api';
const SHOTS = process.env.E2E_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const esiti = [];
async function passo(nome, fn) {
  try {
    await fn();
    esiti.push(true);
    console.log('  ✔', nome);
  } catch (e) {
    esiti.push(false);
    console.log('  ✖', nome, '\n     ', String(e.message).split('\n')[0]);
  }
}
const sezione = (titolo) => console.log(`\n— ${titolo}`);

const api = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const registraApi = (n) =>
  api('/auth/register', {
    method: 'POST',
    body: { nome: `Utente${n}`, cognome: `Test${n}`, email: `utente${n}@test.it`, password: 'password123' },
  });

async function nuovaPagina(browser, { w = 1440, h = 900, ridotto = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    reducedMotion: ridotto ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => {
    // gli errori 401 sono attesi nei test di sicurezza (token manomesso, password errata)
    if (['error', 'warning'].includes(m.type()) && !/401/.test(m.text())) {
      log.push(`${m.type()}: ${m.text()}`);
      if (process.env.E2E_DEBUG) console.log(`      [console ${m.type()}]`, m.text().slice(0, 200));
    }
  });
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
  return { page, log };
}
const shot = async (page, nome) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${nome}.png` });
};
const fase = (page) => page.locator('.sipario').getAttribute('class');
// Conta le navigazioni (pushState/replaceState) della pagina corrente: un reindirizzamento ne fa 1-2,
// un ciclo infinito di <Navigate> ne farebbe decine (regressione già incontrata in modalità sviluppo).
const contaNavigazioni = (page) =>
  page.addInitScript(() => {
    window.__navigazioni = 0;
    for (const metodo of ['pushState', 'replaceState']) {
      const originale = history[metodo].bind(history);
      history[metodo] = (...args) => {
        window.__navigazioni++;
        return originale(...args);
      };
    }
  });
const navigazioni = (page) => page.evaluate(() => window.__navigazioni);
const accedi = (page) => page.getByRole('button', { name: 'Accedi', exact: true }).last().click();
const attendiStepper = (page, n) =>
  page.waitForFunction((v) => document.querySelector('.stepper__valore').innerText.trim() === String(v), n);

const browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
const logConsole = [];

// ------------------------------------------------------------------------------------------
sezione('1. Primo iscritto: registrazione, codice di prelazione, acquisto fino al limite');
{
  const { page, log } = await nuovaPagina(browser);
  logConsole.push(log);

  await passo('registrazione: validazione lato client', async () => {
    await page.goto(BASE + '/register', { waitUntil: 'networkidle' });
    await page.click('button[type=submit]');
    assert((await page.locator('.campo__errore').count()) >= 4, 'attesi almeno 4 errori di campo');
    await page.fill('#email', 'non-una-email');
    await page.fill('#password', 'corta');
    await page.click('button[type=submit]');
    assert.equal(await page.getByText('manca qualcosa').count(), 1);
    assert((await page.getByText('almeno 8 caratteri').count()) >= 1);
    await shot(page, 'register-errori');
  });

  await passo('registrazione: il primo iscritto ottiene il codice e viene collegato in automatico', async () => {
    await page.fill('#nome', 'Mario');
    await page.fill('#cognome', 'Rossi');
    await page.fill('#email', 'mario@test.it');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForSelector('.codice-rivelato__codice', { timeout: 8000 });
    const codice = await page.locator('.codice-rivelato__codice').getAttribute('aria-label');
    assert.match(codice, /^TICKET-[A-Z0-9]{6}$/);
    await page.waitForTimeout(1500);
    await shot(page, 'register-ok');
    assert.equal(await page.locator('.codice-chip').count(), 1, 'chip del codice nella navbar');
    assert.equal(await page.getByRole('link', { name: 'Acquista' }).count(), 1, 'voce Acquista visibile');
  });

  await passo('acquisto: Tribuna ×2, conferma e contatore del limite', async () => {
    await page.getByRole('button', { name: 'Scegli i biglietti' }).click();
    await page.waitForURL('**/acquista');
    await page.waitForSelector('.opzione');
    await page.waitForTimeout(1500);
    await shot(page, 'acquista-iniziale');
    await page.locator('.opzione', { hasText: 'Tribuna' }).click();
    await page.getByRole('button', { name: 'Un biglietto in più' }).click();
    await attendiStepper(page, 2);
    await page.getByRole('button', { name: 'Conferma e acquista' }).click();
    await page.waitForSelector('.stub-verticale--conferma', { timeout: 8000 });
    await page.waitForTimeout(900);
    await shot(page, 'acquista-confermato');
    const testo = await page.locator('.limite p').innerText();
    assert.match(testo, /2\s+biglietti su 4/);
    assert.match(testo, /Te ne restano 2/);
  });

  await passo('acquisto: secondo ordine fino al limite (4), pulsante bloccato', async () => {
    await page.getByRole('button', { name: 'Acquista ancora' }).click();
    await page.locator('.opzione', { hasText: 'Prato' }).click();
    await page.getByRole('button', { name: 'Un biglietto in più' }).click();
    await attendiStepper(page, 2);
    assert(await page.getByRole('button', { name: 'Un biglietto in più' }).isDisabled(), 'oltre i restanti non si sale');
    await page.getByRole('button', { name: 'Conferma e acquista' }).click();
    await page.waitForSelector('.stub-verticale--conferma');
    await page.waitForTimeout(700);
    const testo = await page.locator('.limite p').innerText();
    assert(/4\s+biglietti su 4/.test(testo) && /limite/.test(testo), testo);
    await shot(page, 'acquista-limite');
    assert.equal(await page.locator('.ordine').count(), 2, 'due ordini in elenco');
  });

  await passo('il server rifiuta il 5° biglietto anche aggirando l’interfaccia', async () => {
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const r = await api('/ordini', { method: 'POST', token, body: { id_settore: 3, quantita: 1 } });
    assert.equal(r.status, 409, JSON.stringify(r.data));
    const m = await api('/ordini/miei', { token });
    assert.equal(m.data.acquistati, 4);
  });

  await contaNavigazioni(page);
  await passo('URL /admin digitato a mano da un cliente: rimandato alla home con avviso (senza cicli)', async () => {
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    assert(!page.url().includes('/admin'), page.url());
    assert((await page.locator('.avviso').count()) >= 1, 'avviso visibile');
    const n = await navigazioni(page);
    assert(n <= 4, `troppe navigazioni (${n}): ciclo di reindirizzamento?`);
  });

  // i primi 5 iscritti sono abilitati: gli altri 4 via API, poi un 6° senza prelazione
  for (let n = 2; n <= 5; n++) {
    const r = await registraApi(n);
    assert.equal(r.data.utente?.abilitato, true, `utente ${n} abilitato`);
  }
  assert.equal((await registraApi(6)).data.utente.abilitato, false);

  await passo('utente senza prelazione: niente voce Acquista, /acquista negato, ordine rifiutato dal server (403)', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('#email', 'utente6@test.it');
    await page.fill('#password', 'password123');
    await accedi(page);
    await page.waitForURL(BASE + '/');
    assert((await page.getByText('Senza prelazione').count()) >= 1);
    assert.equal(await page.getByRole('link', { name: 'Acquista' }).count(), 0);
    await page.waitForTimeout(1200);
    await shot(page, 'home-senza-codice');
    await page.goto(BASE + '/acquista', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    assert(!page.url().includes('/acquista'), page.url());
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const r = await api('/ordini', { method: 'POST', token, body: { id_settore: 1, quantita: 1 } });
    assert.equal(r.status, 403);
  });

  await passo('non autenticato: /acquista e /admin portano al login', async () => {
    await page.evaluate(() => localStorage.clear());
    for (const p of ['/acquista', '/admin']) {
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      assert(page.url().endsWith('/login'), `${p} → ${page.url()}`);
      const n = await navigazioni(page);
      assert(n <= 4, `${p}: troppe navigazioni (${n}): ciclo di reindirizzamento?`);
    }
    assert.equal(await page.getByText('devi prima accedere').count(), 1);
  });

  await passo('token manomesso (anche con utente "admin" finto in localStorage): sessione chiusa', async () => {
    await page.evaluate(() => {
      localStorage.setItem('token', 'xxx.yyy.zzz');
      localStorage.setItem(
        'user',
        JSON.stringify({ id_utente: 1, nome: 'Finto', cognome: 'Admin', ruolo: 'admin', abilitato: 1 })
      );
    });
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    assert(page.url().endsWith('/login'), page.url());
    assert.equal(await page.getByText('sessione è scaduta').count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
    await shot(page, 'login-scaduta');
  });

  await passo('login con credenziali errate: messaggio d’errore', async () => {
    await page.fill('#email', 'mario@test.it');
    await page.fill('#password', 'sbagliata!');
    await accedi(page);
    await page.waitForSelector('.avviso--errore');
    assert.match(await page.locator('.avviso--errore').innerText(), /credenziali|password|email/i);
  });

  await passo('dashboard admin: sistema integro e statistiche coerenti con gli acquisti', async () => {
    await page.fill('#email', 'admin@concerto.it');
    await page.fill('#password', 'admin123');
    await accedi(page);
    await page.waitForURL('**/admin'); // dopo il login si torna alla pagina richiesta
    await page.waitForSelector('.sentinella', { timeout: 8000 });
    await page.waitForTimeout(2200);
    await shot(page, 'admin');
    assert.equal(await page.locator('.sentinella--ok').count(), 1, 'sistema integro');
    const kpi = (await page.locator('.kpi__voce').first().innerText()).replace(/\s+/g, ' ');
    assert.match(kpi, /4\s*\/\s*350/);
    // un solo acquirente con 4 biglietti: 1 per sé, 3 per accompagnatori
    const legenda = (await page.locator('.legenda').first().innerText()).replace(/\s+/g, ' ');
    assert.match(legenda, /Per sé.*1.*accompagnatori.*3/);
  });
  await page.context().close();
}

// ------------------------------------------------------------------------------------------
sezione('2. Transizioni, tastiera, aggiornamento in tempo reale');
{
  const { page, log } = await nuovaPagina(browser);
  logConsole.push(log);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await passo('il sipario copre, scopre e si ritira; cambia pagina e tono dello sfondo', async () => {
    assert.equal(await page.evaluate(() => document.body.dataset.tono), 'lilac');
    await page.getByRole('link', { name: 'Accedi' }).first().click();
    await page.waitForTimeout(150);
    assert.match(await fase(page), /sipario--copre/);
    await shot(page, 'transizione-copre');
    await page.waitForTimeout(330);
    assert.match(await fase(page), /sipario--scopre/);
    assert(page.url().endsWith('/login'));
    await page.waitForTimeout(700);
    assert.match(await fase(page), /sipario--fermo/);
    assert.equal(await page.evaluate(() => document.body.dataset.tono), 'peach');
    assert(await page.getByRole('heading', { name: 'Accedi' }).isVisible());
  });

  await passo('dopo il cambio pagina il focus passa al contenuto', async () => {
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'contenuto');
  });

  await passo('due click ravvicinati sui link non rompono la navigazione', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Registrati' }).first().click();
    await page.getByRole('link', { name: 'Settori' }).click();
    await page.waitForTimeout(1500);
    assert.equal(page.url(), BASE + '/');
    assert(await page.getByRole('heading', { name: /Un posto sotto il palco/ }).isVisible());
    assert.match(await fase(page), /sipario--fermo/);
  });

  await passo('pulsante Indietro del browser', async () => {
    await page.getByRole('link', { name: 'Accedi' }).first().click();
    await page.waitForTimeout(1100);
    await page.goBack();
    await page.waitForTimeout(1100);
    assert.equal(page.url(), BASE + '/');
  });

  await passo('tastiera: il primo Tab porta al link "salta al contenuto"', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    assert.match(await page.evaluate(() => document.activeElement?.className), /salta-link/);
  });

  await passo('tempo reale: l’acquisto di un altro utente scala i posti senza ricaricare', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const prima = Number(
      await page.locator('.stub', { hasText: 'Prato' }).locator('.stub__conteggio strong').innerText()
    );
    const l = await api('/auth/login', { method: 'POST', body: { email: 'utente3@test.it', password: 'password123' } });
    const r = await api('/ordini', { method: 'POST', token: l.data.token, body: { id_settore: 3, quantita: 3 } });
    assert.equal(r.status, 201);
    await page.waitForFunction(
      (p) => Number(document.querySelector('.stub:nth-child(3) .stub__conteggio strong').innerText) !== p,
      prima,
      { timeout: 15000 }
    );
    await page.waitForTimeout(1200);
    const dopo = Number(
      await page.locator('.stub', { hasText: 'Prato' }).locator('.stub__conteggio strong').innerText()
    );
    assert.equal(dopo, prima - 3);
  });
  await page.context().close();
}

// ------------------------------------------------------------------------------------------
sezione('3. Movimento ridotto (prefers-reduced-motion)');
{
  const { page, log } = await nuovaPagina(browser, { ridotto: true });
  logConsole.push(log);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await passo('nessun sipario: il cambio pagina è immediato', async () => {
    await page.getByRole('link', { name: 'Accedi' }).first().click();
    await page.waitForTimeout(120);
    assert(page.url().endsWith('/login'));
    assert.match(await fase(page), /sipario--fermo/);
    assert(await page.getByRole('heading', { name: 'Accedi' }).isVisible());
  });
  await passo('i contatori mostrano subito il valore finale', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    assert.match(await page.locator('.regole li').first().innerText(), /5 su 5/);
  });
  await page.context().close();
}

// ------------------------------------------------------------------------------------------
sezione('4. Smartphone (390 px): menu a comparsa e assenza di scroll orizzontale');
{
  const { page, log } = await nuovaPagina(browser, { w: 390, h: 844 });
  logConsole.push(log);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await passo('il menu si apre, mostra i link e si chiude cambiando pagina', async () => {
    const btn = page.locator('.barra__menu-btn');
    assert(await btn.isVisible());
    assert.equal(await btn.getAttribute('aria-expanded'), 'false');
    assert(!(await page.getByRole('link', { name: 'Registrati' }).isVisible()), 'a menu chiuso i link sono nascosti');
    await btn.click();
    await page.waitForTimeout(600);
    assert.equal(await btn.getAttribute('aria-expanded'), 'true');
    assert(await page.getByRole('link', { name: 'Registrati' }).isVisible());
    await shot(page, 'menu-mobile');
    await page.getByRole('link', { name: 'Registrati' }).click();
    await page.waitForTimeout(1200);
    assert(page.url().endsWith('/register'));
    assert.equal(await btn.getAttribute('aria-expanded'), 'false');
  });
  await passo('nessuna pagina pubblica ha scroll orizzontale', async () => {
    for (const p of ['/', '/login', '/register']) {
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(extra, 0, `${p}: +${extra}px`);
    }
  });
  await page.context().close();
}

await browser.close();

const errori = logConsole.flat();
console.log('\nConsole del browser:', errori.length ? '\n  ' + errori.join('\n  ') : 'nessun errore né avviso inatteso');
const ko = esiti.filter((x) => !x).length;
console.log(`\nRISULTATO: ${esiti.length - ko}/${esiti.length} passi superati${errori.length ? ' (con errori in console!)' : ''}`);
process.exit(ko || errori.length ? 1 : 0);

# Guida al Deploy di SmartBudget su Vercel

Questa guida ti accompagna passo dopo passo per rendere SmartBudget accessibile da Internet, su qualsiasi dispositivo, senza dover tenere il computer acceso.

**Cosa otterrai:** un indirizzo web tipo `https://smartbudget.vercel.app` accessibile ovunque.

**Prerequisiti:** SmartBudget già funzionante in locale (hai completato `INSTALLAZIONE.md`), account GitHub con il codice caricato.

**Tempo stimato:** 45–60 minuti.

---

## Indice

1. [Crea un account GitHub e carica il codice](#parte-1--carica-il-codice-su-github)
2. [Crea un account Vercel e collega il progetto](#parte-2--crea-il-progetto-su-vercel)
3. [Configura le variabili d'ambiente su Vercel](#parte-3--configura-le-variabili-dambiente)
4. [Aggiorna Supabase per la produzione](#parte-4--aggiorna-supabase-per-la-produzione)
5. [Applica la patch di sicurezza al database](#parte-5--applica-la-patch-di-sicurezza-al-database)
6. [Esegui il primo deploy](#parte-6--esegui-il-primo-deploy)
7. [Verifica che tutto funzioni](#parte-7--verifica-finale)
8. [Come aggiornare l'app in futuro](#parte-8--aggiornamenti-futuri)
9. [Risoluzione problemi](#risoluzione-problemi)

---

## PARTE 1 — Carica il codice su GitHub

GitHub è il servizio dove il codice viene conservato online. Vercel lo legge da lì per costruire il sito.

### Passo 1 — Crea un account GitHub (se non ce l'hai già)

1. Vai su [https://github.com](https://github.com)
2. Clicca **Sign up** in alto a destra
3. Inserisci email, password e username
4. Segui la verifica e conferma l'email

### Passo 2 — Crea un repository per SmartBudget

1. Una volta dentro GitHub, clicca il pulsante **+** in alto a destra → **New repository**
2. Compila i campi:
   - **Repository name**: `smartbudget`
   - **Visibility**: scegli **Private** (il codice non sarà visibile pubblicamente)
   - Non spuntare nessuna delle opzioni "Initialize this repository"
3. Clicca **Create repository**
4. GitHub mostra una pagina con istruzioni — lasciala aperta, ti servirà tra poco

### Passo 3 — Carica il codice su GitHub

Apri la finestra nera (Terminale su Mac, cmd su Windows). Assicurati di essere dentro la cartella del progetto:

```bash
cd ~/Desktop/smartbudget
```

Poi esegui questi comandi uno alla volta, premendo Invio dopo ognuno:

```bash
git init
git add .
git commit -m "primo commit"
git branch -M main
git remote add origin https://github.com/IL-TUO-USERNAME/smartbudget.git
git push -u origin main
```

> Sostituisci `IL-TUO-USERNAME` con il tuo nome utente GitHub (quello che hai scelto al Passo 1).

GitHub potrebbe chiederti username e password. Inseriscili.

**Come verificare che ha funzionato:** torna sul browser, ricarica la pagina del repository GitHub — dovresti vedere tutti i file del progetto comparire.

---

## PARTE 2 — Crea il progetto su Vercel

Vercel è il servizio che prende il tuo codice, lo trasforma in un sito web e lo pubblica su Internet, gratuitamente.

### Passo 4 — Crea un account Vercel

1. Vai su [https://vercel.com](https://vercel.com)
2. Clicca **Sign Up** in alto a destra
3. Clicca **Continue with GitHub** — questo collega automaticamente Vercel al tuo account GitHub
4. Autorizza Vercel ad accedere ai tuoi repository quando richiesto

### Passo 5 — Importa il progetto SmartBudget

1. Dalla dashboard Vercel, clicca **Add New…** → **Project**
2. Nella lista dei repository GitHub che compare, cerca `smartbudget` e clicca **Import**

   > Se non vedi il repository, clicca **Adjust GitHub App Permissions** e aggiungi il repository `smartbudget`.

3. Nella schermata di configurazione che appare:
   - **Framework Preset**: Vercel dovrebbe rilevare automaticamente **Next.js** — se non lo fa, selezionalo tu dal menu a tendina
   - **Root Directory**: lascia `.` (il punto, che significa "cartella principale")
   - **Build Command**: lascia il valore di default (`next build`)
   - **Output Directory**: lascia vuoto

4. **Non cliccare ancora Deploy** — prima devi configurare le variabili d'ambiente (Parte 3).

---

## PARTE 3 — Configura le variabili d'ambiente

Le variabili d'ambiente sono i "codici segreti" che permettono all'app di collegarsi a Supabase, inviare email e usare l'AI. In locale le avevi nel file `.env.local`; su Vercel vanno inserite nel pannello web.

### Passo 6 — Apri la sezione Environment Variables

Nella stessa schermata di configurazione del Passo 5, scorri verso il basso fino a trovare la sezione **Environment Variables**.

Oppure, se hai già cliccato Deploy e vuoi aggiungerle dopo:
1. Vai nella dashboard Vercel → clicca sul progetto `smartbudget`
2. Clicca **Settings** (in alto) → **Environment Variables** (nel menu a sinistra)

### Passo 7 — Aggiungi le variabili obbligatorie

Per ogni variabile nella tabella qui sotto, clicca **Add** (o il campo di testo), inserisci il **Nome** e il **Valore**, poi conferma.

#### Variabili Supabase (obbligatorie)

Apri il pannello Supabase → clicca sull'ingranaggio ⚙️ in basso a sinistra → **Project Settings** → **API**.

| Nome variabile | Dove trovare il valore | Esempio |
|----------------|----------------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Campo **Project URL** | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sezione **Project API keys** → riga **anon public** | `eyJhbGci...` (stringa lunga) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sezione **Project API keys** → riga **service_role** (clicca **Reveal** per vederla) | `eyJhbGci...` (stringa diversa) |

> **Attenzione:** `SUPABASE_SERVICE_ROLE_KEY` è una chiave con poteri amministrativi. In Vercel, dopo averla incollata, spunta l'opzione **Sensitive** (o l'icona a forma di occhio con una barra) — così non comparirà nei log.

#### URL dell'app (obbligatorio)

Questa variabile dice all'app qual è il suo indirizzo pubblico. Per ora inserisci un valore provvisorio — lo aggiornerai dopo il primo deploy (vedi Parte 6, Passo 15).

| Nome variabile | Valore provvisorio |
|----------------|--------------------|
| `NEXT_PUBLIC_APP_URL` | `https://smartbudget.vercel.app` |

> L'URL esatto te lo darà Vercel dopo il primo deploy. Se il tuo progetto si chiama diversamente (es. `smartbudget-nick`), sarà `https://smartbudget-nick.vercel.app`.

#### Secret per il cron job (obbligatorio)

Il cron job è un'operazione automatica che controlla le fatture in scadenza ogni mattina. Ha bisogno di una password segreta per funzionare in sicurezza.

**Genera la password segreta** — apri la finestra nera e digita:

```bash
openssl rand -base64 32
```

Vedrai una stringa tipo `K7mP2xQn8vLt4RjA...`. Copiala.

| Nome variabile | Valore |
|----------------|--------|
| `CRON_SECRET` | La stringa generata sopra |

> Marca anche questa come **Sensitive** in Vercel.

#### Variabili opzionali (solo se vuoi email e AI)

Aggiungile solo se hai creato gli account relativi. L'app funziona anche senza.

| Nome variabile | Servizio | Dove trovare il valore |
|----------------|----------|----------------------|
| `RESEND_API_KEY` | Resend (email) | [resend.com](https://resend.com) → API Keys |
| `TELEGRAM_BOT_TOKEN` | Telegram | Creato con @BotFather su Telegram |
| `ANTHROPIC_API_KEY` | Claude AI | [console.anthropic.com](https://console.anthropic.com) → API Keys |

### Passo 8 — Verifica le variabili inserite

Prima di procedere, controlla che queste variabili siano presenti nella lista:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `NEXT_PUBLIC_APP_URL`
- ✅ `CRON_SECRET`

---

## PARTE 4 — Aggiorna Supabase per la produzione

Quando usavi l'app in locale, Supabase era configurato per `localhost`. Ora devi dirgli che l'app sarà raggiungibile da un indirizzo web pubblico.

### Passo 9 — Aggiorna gli URL autorizzati

1. Apri il pannello Supabase del tuo progetto
2. Clicca su **Authentication** nel menu a sinistra
3. Clicca su **URL Configuration**
4. Modifica questi campi:

   **Site URL** (l'indirizzo principale dell'app):
   ```
   https://smartbudget.vercel.app
   ```

   **Redirect URLs** (aggiungine uno nuovo cliccando **Add URL**):
   ```
   https://smartbudget.vercel.app/auth/callback
   ```

   > Se l'URL esatto di Vercel è diverso (lo scoprirai dopo il primo deploy), torna qui e aggiornalo.

5. Clicca **Save**

### Passo 10 — Attiva la conferma email

In locale la conferma email era disabilitata per comodità. In produzione è importante attivarla per sicurezza.

1. Nel pannello Supabase → **Authentication** → **Providers**
2. Clicca su **Email**
3. Assicurati che **Confirm email** sia attivato (toggle blu)
4. Clicca **Save**

---

## PARTE 5 — Applica la patch di sicurezza al database

Prima del deploy abbiamo corretto una vulnerabilità nelle regole di sicurezza del database. Devi applicare questa correzione anche al database online.

### Passo 11 — Esegui lo script di sicurezza

1. Nel pannello Supabase, clicca su **SQL Editor** nel menu a sinistra (icona `</>`)
2. Clicca **New query** in alto a sinistra
3. Copia e incolla questo comando:

```sql
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
```

4. Clicca **Run** (pulsante verde)
5. Dovresti vedere il messaggio `Success. No rows returned`

Questo comando rimuove una regola permissiva che avrebbe permesso a qualsiasi utente di inserire notifiche false nel sistema. Il server continua a funzionare correttamente perché usa una chiave amministrativa che bypassa queste regole.

---

## PARTE 6 — Esegui il primo deploy

### Passo 12 — Avvia il deploy

- **Se sei ancora nella schermata di importazione progetto** (Passo 5): clicca **Deploy**
- **Se hai già chiuso quella schermata**: vai nella dashboard Vercel → progetto → clicca **Redeploy** oppure fai una modifica qualsiasi al codice e ricaricalo su GitHub (Vercel si aggiorna automaticamente)

### Passo 13 — Attendi il completamento

Vercel mostrerà un log in tempo reale con il progresso del deploy. Il processo richiede 2–5 minuti. Vedrai scorrere righe di testo — è normale.

Il deploy è completato quando vedi:

```
✅  Production: https://smartbudget-xxxxx.vercel.app
```

### Passo 14 — Prendi nota dell'URL assegnato

Vercel assegna un URL definitivo al tuo progetto. Copialo — lo userai nei passi successivi.

Esempi di URL:
- `https://smartbudget.vercel.app` (se il nome era disponibile)
- `https://smartbudget-nick.vercel.app`
- `https://smartbudget-git-main-nick.vercel.app`

### Passo 15 — Aggiorna NEXT_PUBLIC_APP_URL con l'URL reale

Ora che conosci l'URL esatto, aggiornalo in Vercel:

1. Vercel → progetto → **Settings** → **Environment Variables**
2. Trova `NEXT_PUBLIC_APP_URL` e clicca la matita ✏️ per modificarla
3. Sostituisci il valore provvisorio con l'URL reale appena copiato
4. Salva

Poi aggiorna anche Supabase (Passo 9) se l'URL è diverso da quello che avevi scritto.

### Passo 16 — Rideploya per applicare il nuovo URL

Dopo aver modificato una variabile d'ambiente, il deploy precedente non ne tiene conto. Devi avviare un nuovo deploy:

1. Vercel → progetto → tab **Deployments**
2. Clicca i tre puntini **···** accanto all'ultimo deploy → **Redeploy**
3. Attendi il completamento (altri 2–3 minuti)

---

## PARTE 7 — Verifica finale

### Passo 17 — Testa le funzioni principali

Apri il tuo browser e vai all'URL del progetto (es. `https://smartbudget.vercel.app`).

Testa questi scenari nell'ordine:

**Test 1 — Registrazione**
1. Vai su `/signup` (o clicca "Registrati")
2. Inserisci email e password
3. Clicca Registrati
4. Controlla la tua email: deve arrivare un'email di conferma da Supabase
5. Clicca il link nell'email
6. Verifica di essere reindirizzato all'app

**Test 2 — Onboarding**
1. Dopo la conferma email, accedi con le tue credenziali
2. Deve comparire il wizard di configurazione iniziale (3 passi)
3. Completa il wizard
4. Verifica di atterrare sulla dashboard

**Test 3 — Crea una transazione**
1. Vai su **Transazioni**
2. Clicca il pulsante per aggiungere una nuova transazione
3. Inserisci importo, categoria e data
4. Salva e verifica che compaia nella lista

**Test 4 — Sicurezza delle API** (apri una nuova scheda in modalità anonima / incognito)
1. Vai su `https://smartbudget.vercel.app/dashboard/mensile` senza essere loggato
2. Deve reindirizzarti automaticamente su `/login`

**Test 5 — Sicurezza headers** (opzionale, per gli utenti tecnici)
1. Vai su [https://securityheaders.com](https://securityheaders.com)
2. Inserisci l'URL del tuo sito e clicca **Scan**
3. Dovresti ottenere una valutazione **A** o **B**

### Passo 18 — Verifica il cron job (notifiche automatiche)

Il cron job gira ogni mattina alle 8:00. Puoi testarlo manualmente:

1. Apri la finestra nera e digita (sostituisci i valori):

```bash
curl -X POST https://TUOURL.vercel.app/api/notifications/process \
  -H "Authorization: Bearer IL-TUO-CRON-SECRET"
```

> Il `CRON_SECRET` è la stringa che hai generato al Passo 7. Puoi rivederla in Vercel → Settings → Environment Variables.

2. Dovresti ricevere una risposta tipo:
```json
{"ok":true,"processed":1}
```

---

## PARTE 8 — Aggiornamenti futuri

Ogni volta che modifichi il codice e vuoi aggiornare il sito:

1. Apri la finestra nera nella cartella del progetto
2. Carica le modifiche su GitHub:

```bash
git add .
git commit -m "descrizione della modifica"
git push
```

**Vercel si aggiorna automaticamente** entro 2–3 minuti dopo ogni `git push`. Non devi fare altro.

Per controllare lo stato del deploy: Vercel → progetto → tab **Deployments**.

---

## Risoluzione problemi

### Il deploy fallisce con errori TypeScript

Controlla il log di Vercel (tab **Deployments** → clicca sull'ultimo deploy → **View Build Logs**). Cerca le righe rosse con `Type error`.

Poi nella finestra nera, in locale:
```bash
npm run build
```
Questo mostra gli stessi errori. Correggili e rifai il push.

---

### La pagina mostra "Application error"

1. Vercel → progetto → **Deployments** → clicca l'ultimo deploy → **View Function Logs**
2. Cerca errori che parlano di variabili mancanti (es. `NEXT_PUBLIC_SUPABASE_URL is undefined`)
3. Controlla che tutte le variabili d'ambiente siano inserite correttamente (senza spazi, senza virgolette, senza "a capo" finali)

---

### Il login non funziona / redirect dopo login va su localhost

Supabase sta ancora reindirizzando su `localhost`. Torna al Passo 9 e assicurati che **Site URL** e **Redirect URLs** contengano l'URL di Vercel, non `localhost`.

---

### L'email di conferma non arriva

1. Controlla la cartella Spam
2. Nel pannello Supabase → **Authentication** → **Users**: trova il tuo utente, clicca i tre puntini → **Send confirmation email** per rimandare l'email
3. Se usi un dominio email aziendale, potrebbe bloccare le email da Supabase. Prova con Gmail o un'altra email personale.

---

### Errore "Invalid JWT" o "JWT expired"

La sessione è scaduta o le chiavi Supabase sono cambiate. Prova a:
1. Fare logout e login di nuovo
2. Svuotare la cache del browser (Ctrl+Shift+R / Cmd+Shift+R)

---

### L'app funziona ma le notifiche automatiche non arrivano

Verifica che:
1. `CRON_SECRET` sia impostato in Vercel e non sia cambiato
2. `NEXT_PUBLIC_APP_URL` sia l'URL corretto (senza `/` finale)
3. Il piano Vercel supporti i Cron Jobs (il piano gratuito Hobby li supporta, ma con limitazioni)
4. In Supabase → Settings → utente, le notifiche email/Telegram siano attivate

Testa manualmente il cron come descritto al Passo 18.

---

### "Too Many Requests" sulle API

L'app ha un limite di richieste per prevenire abusi. Se ricevi questo errore durante un uso normale, contatta lo sviluppatore.

---

## Riepilogo URL e credenziali da conservare

Dopo aver completato questa guida, annota in un posto sicuro:

| Cosa | Valore |
|------|--------|
| URL dell'app | `https://...vercel.app` |
| Dashboard Vercel | [vercel.com/dashboard](https://vercel.com/dashboard) |
| Dashboard Supabase | [app.supabase.com](https://app.supabase.com) |
| CRON_SECRET | (la stringa generata con openssl — non condividerla mai) |
| Email account Supabase | (quella usata per registrarti) |

---

## Note finali

- **I tuoi dati sono sempre su Supabase**, indipendentemente dai deploy. Un nuovo deploy non cancella nulla.
- **Vercel piano gratuito (Hobby)** è sufficiente per uso personale/familiare. Limiti: 100GB di banda al mese, 6000 minuti di build, cron jobs con frequenza minima di 1 ora (il nostro è giornaliero, quindi va bene).
- **Non condividere mai** `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` — chi li ha può accedere a tutti i tuoi dati.
- **Backup**: Supabase piano gratuito non include backup automatici. Esporta periodicamente i dati da Supabase → **Table Editor** → **Export to CSV**.

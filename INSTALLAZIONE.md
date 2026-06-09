# Guida all'Installazione di SmartBudget

Questa guida ti accompagna passo dopo passo nell'installazione di SmartBudget sul tuo computer, anche se non hai mai installato un programma da codice sorgente. Segui ogni passaggio nell'ordine indicato.

---

## Cosa installerai

- **Node.js** — il motore che fa girare l'applicazione
- **Git** — lo strumento per scaricare il codice
- **Un account Supabase** — il database gratuito online che conserva i tuoi dati

Tempo stimato: circa 30–45 minuti (la maggior parte è attesa automatica).

---

## PARTE 1 — Installa i programmi necessari

### Passo 1 — Installa Node.js

Node.js è il motore che permette all'applicazione di funzionare.

1. Vai su [https://nodejs.org](https://nodejs.org)
2. Clicca sul pulsante verde grande **"LTS"** (è la versione stabile consigliata)
3. Si scarica un file di installazione (`.msi` su Windows, `.pkg` su Mac)
4. Apri il file scaricato e segui l'installazione cliccando **Avanti** / **Next** fino alla fine
5. Quando chiede se installare anche **npm**, assicurati che sia spuntato ✓

**Verifica che funzioni:**
- Su **Windows**: premi `Win + R`, scrivi `cmd`, premi Invio. Si apre una finestra nera.
- Su **Mac**: apri il programma **Terminale** (cercalo con Spotlight, `Cmd + Spazio`, scrivi "Terminale")
- Digita questo comando e premi Invio:
  ```
  node --version
  ```
- Dovresti vedere qualcosa tipo `v22.0.0`. Se compare un numero, Node.js è installato correttamente.

---

### Passo 2 — Installa Git

Git è lo strumento per scaricare il codice da Internet.

**Su Windows:**
1. Vai su [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Il download parte automaticamente
3. Apri il file scaricato e clicca **Next** su tutte le schermate senza modificare nulla
4. Alla fine clicca **Finish**

**Su Mac:**
- Git è già incluso con gli strumenti di sviluppo Apple. Apri il Terminale e digita:
  ```
  git --version
  ```
  Se compare una finestra che chiede di installare gli "Xcode Command Line Tools", clicca **Installa** e attendi.

**Verifica che funzioni:**
Nella finestra nera (cmd / Terminale), digita:
```
git --version
```
Dovresti vedere qualcosa tipo `git version 2.x.x`.

---

## PARTE 2 — Crea il database online (Supabase)

Supabase è un servizio gratuito che fa da database per SmartBudget. I tuoi dati vengono salvati lì in modo sicuro.

### Passo 3 — Crea un account Supabase

1. Vai su [https://supabase.com](https://supabase.com)
2. Clicca **Start your project** (o **Sign Up**)
3. Registrati con la tua email oppure accedi con il tuo account GitHub o Google
4. Conferma l'email se richiesto

---

### Passo 4 — Crea un nuovo progetto Supabase

1. Una volta dentro la dashboard di Supabase, clicca **New project**
2. Scegli la tua **organizzazione** (se è la prima volta, ne viene creata una automaticamente col tuo nome)
3. Compila i campi:
   - **Name**: scrivi `smartbudget` (o un nome a tua scelta)
   - **Database Password**: scegli una password sicura e **annotala** da qualche parte — ti servirà in futuro
   - **Region**: scegli la regione più vicina a te (es. `West EU` per l'Europa)
4. Clicca **Create new project**
5. Attendi 1–2 minuti mentre Supabase crea il progetto (vedrai una barra di caricamento)

---

### Passo 5 — Copia le credenziali del progetto

Ti servono due codici speciali per connettere SmartBudget al tuo database.

1. Nel pannello Supabase, clicca sull'icona dell'ingranaggio ⚙️ in basso a sinistra → **Project Settings**
2. Clicca su **API** nel menu a sinistra
3. Trova e copia (uno alla volta) questi due valori:
   - **Project URL** — assomiglia a `https://abcdefghijklm.supabase.co`
   - **anon public** (sotto "Project API keys") — è una stringa lunghissima che inizia con `eyJ...`

Tienili a portata di mano (aprono un blocco note e incollali lì).

---

### Passo 6 — Crea le tabelle del database

SmartBudget ha bisogno di alcune tabelle nel database. Le creeremo eseguendo degli script SQL già pronti.

1. Nel pannello Supabase, clicca su **SQL Editor** nel menu a sinistra (icona con `</>`)
2. Clicca **New query** in alto a sinistra

Ora devi eseguire **tre script** nell'ordine indicato:

#### Script 1 — Schema principale (tabelle e struttura)

1. Apri il file `supabase/schema.sql` dalla cartella del progetto (la vedrai dopo aver scaricato il codice nel Passo 7, ma puoi anticipare se hai già il file)
2. Copia tutto il contenuto del file
3. Incollalo nell'editor SQL di Supabase
4. Clicca **Run** (pulsante verde in alto a destra)
5. Attendi il messaggio `Success. No rows returned`

#### Script 2 — Politiche di sicurezza (RLS)

1. Clicca di nuovo **New query**
2. Apri il file `supabase/rls_policies.sql`, copia tutto il contenuto
3. Incollalo nell'editor e clicca **Run**

#### Script 3 — Categorie predefinite

1. Clicca di nuovo **New query**
2. Apri il file `supabase/seed_categories.sql`, copia tutto il contenuto
3. Incollalo nell'editor e clicca **Run**

> **Nota:** Se non riesci ad aprire i file `.sql` ora, salta al Passo 7 prima (scarica il codice), poi torna qui a eseguire gli script.

---

### Passo 7 — Configura l'autenticazione email

Per permettere agli utenti di registrarsi e ricevere email di conferma:

1. Nel pannello Supabase, vai su **Authentication** → **URL Configuration**
2. In **Site URL** scrivi: `http://localhost:3000`
3. In **Redirect URLs** aggiungi: `http://localhost:3000/auth/callback`
4. Clicca **Save**

---

## PARTE 3 — Scarica e configura SmartBudget

### Passo 8 — Scarica il codice dell'applicazione

1. Apri la finestra nera (cmd su Windows / Terminale su Mac)
2. Scegli una cartella dove vuoi salvare il progetto. Ad esempio, per salvarlo sul Desktop:
   - **Windows**: digita `cd Desktop` e premi Invio
   - **Mac**: digita `cd ~/Desktop` e premi Invio
3. Digita questo comando e premi Invio:
   ```
   git clone https://github.com/it-rainking/smartbudget.git
   ```
4. Attendi che il download finisca. Vedrai scorrere delle righe di testo.
5. Entra nella cartella appena creata:
   ```
   cd smartbudget
   ```

---

### Passo 9 — Installa le dipendenze dell'applicazione

Sempre nella finestra nera (assicurati di essere dentro la cartella `smartbudget`), digita:

```
npm install
```

Questo scarica tutti i componenti necessari all'applicazione. Potrebbero volerci 2–5 minuti. È normale vedere molto testo scorrere.

Quando finisce, torna al prompt senza errori (potresti vedere alcuni avvisi gialli — sono normali, non sono errori).

---

### Passo 10 — Crea il file di configurazione

L'applicazione ha bisogno di un file segreto con le tue credenziali Supabase.

1. Nella cartella `smartbudget`, crea un nuovo file di testo chiamato esattamente `.env.local`

   **Su Windows:**
   - Nella finestra nera (cmd), digita:
     ```
     copy NUL .env.local
     ```
   - Poi apri il file con il Blocco Note: cerca la cartella `smartbudget` sul Desktop, clicca con il tasto destro su `.env.local` → **Apri con** → **Blocco Note**

   **Su Mac:**
   - Nel Terminale digita:
     ```
     touch .env.local
     open -e .env.local
     ```
   - Si apre TextEdit

2. Scrivi questo contenuto nel file, sostituendo i valori con quelli che hai copiato al Passo 5:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://IL-TUO-PROGETTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...LA-TUA-CHIAVE-LUNGA...
   ```

   Esempio reale (con valori fittizi):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Salva il file (`Ctrl+S` su Windows, `Cmd+S` su Mac)

> **Attenzione:** Il nome del file deve essere esattamente `.env.local` (con il punto iniziale). Non `.env.local.txt` — se usi il Blocco Note di Windows, assicurati che in basso nella finestra "Salva con nome" sia selezionato **Tutti i file** e non "Documenti di testo".

---

## PARTE 4 — Avvia l'applicazione

### Passo 11 — Avvia SmartBudget

Nella finestra nera (assicurati di essere nella cartella `smartbudget`), digita:

```
npm run dev
```

Vedrai del testo comparire, e dopo qualche secondo:

```
▲ Next.js ready
- Local: http://localhost:3000
```

L'applicazione è in esecuzione!

---

### Passo 12 — Apri l'applicazione nel browser

1. Apri il tuo browser (Chrome, Firefox, Safari, Edge)
2. Nella barra dell'indirizzo in alto, scrivi:
   ```
   http://localhost:3000
   ```
3. Premi Invio

Dovresti vedere la pagina di login di SmartBudget.

---

### Passo 13 — Crea il tuo primo account

1. Clicca su **Registrati** (o **Sign Up**)
2. Inserisci la tua email e scegli una password
3. Clicca **Registrati**
4. Controlla la tua casella email: riceverai un messaggio di conferma da Supabase
5. Clicca il link nell'email per confermare il tuo account
6. Torna su `http://localhost:3000` e accedi con email e password

Al primo accesso, verrà avviato un wizard di configurazione (Onboarding) che ti chiederà:
- La valuta preferita (es. Euro €)
- Il saldo iniziale del tuo conto
- Le categorie di spesa predefinite

Segui i 3 passaggi del wizard e sarai pronto a usare SmartBudget.

---

## Come riavviare l'applicazione in futuro

Ogni volta che vuoi usare SmartBudget, devi avviarla manualmente:

1. Apri la finestra nera (cmd / Terminale)
2. Vai nella cartella del progetto:
   - **Windows**: `cd Desktop\smartbudget`
   - **Mac**: `cd ~/Desktop/smartbudget`
3. Digita:
   ```
   npm run dev
   ```
4. Apri il browser su `http://localhost:3000`

Per fermare l'applicazione, torna nella finestra nera e premi `Ctrl+C`.

---

## Risoluzione problemi comuni

| Problema | Soluzione |
|----------|-----------|
| `npm: command not found` | Node.js non è installato correttamente. Ripeti il Passo 1. |
| `git: command not found` | Git non è installato correttamente. Ripeti il Passo 2. |
| Pagina bianca o errore 500 | Controlla che il file `.env.local` sia nella cartella `smartbudget` e che i valori siano corretti (senza spazi extra). |
| Email di conferma non arrivata | Controlla la cartella Spam. Se non arriva, nel pannello Supabase → Authentication → Users trovi il tuo utente e puoi confermarlo manualmente cliccando i tre puntini → "Confirm email". |
| `Error: Invalid API key` | La `ANON_KEY` nel file `.env.local` è sbagliata o incompleta. Ricopiala dal pannello Supabase. |
| L'app si avvia ma il login non funziona | Gli script SQL del Passo 6 potrebbero non essere stati eseguiti. Torna su Supabase e ri-esegui `schema.sql`. |
| Porta 3000 già in uso | Un'altra app usa la stessa porta. Digita `npm run dev -- -p 3001` e vai su `http://localhost:3001`. |

---

## Note finali

- L'applicazione gira **solo sul tuo computer** finché la finestra nera è aperta. I dati però sono **salvati online** su Supabase, quindi non li perdi mai.
- Se vuoi rendere l'app accessibile da altri dispositivi (o da Internet), è necessario un deploy su un servizio esterno come Vercel — questa è una procedura avanzata non inclusa in questa guida.
- La cartella `smartbudget` contiene tutto il codice: non spostarla o rinominarla dopo l'installazione, altrimenti i comandi del Terminale non troveranno più la cartella.

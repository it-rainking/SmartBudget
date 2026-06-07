# SmartBudget — Istruzioni di Installazione Cloud

Guida passo-passo per il deploy di SmartBudget su piattaforme cloud.

---

## Prerequisiti

- Account [Supabase](https://supabase.com) (piano Free o Pro)
- Account sulla piattaforma di deploy scelta (Vercel, Railway, Render, ecc.)
- Node.js ≥ 18.x
- Repository clonato o forkato su GitHub/GitLab

---

## 1. Configurazione Supabase

### 1.1 Crea un nuovo progetto

1. Vai su [app.supabase.com](https://app.supabase.com) e crea un nuovo progetto.
2. Scegli la regione più vicina ai tuoi utenti.
3. Annota le credenziali dal pannello **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 1.2 Esegui le migration SQL

Nel pannello Supabase, apri **SQL Editor** ed esegui nell'ordine:

1. Script di creazione tabelle (schema principale)
2. Script RLS (Row Level Security) per ogni tabella
3. Funzione `create_default_categories(p_user_id uuid)`

> Le migration SQL si trovano nella cartella `supabase/migrations/` del repository (se presenti) oppure vanno applicate manualmente seguendo lo schema in `CLAUDE.md → Database Schema`.

### 1.3 Configura l'autenticazione

In **Authentication → Providers**:
- Abilita **Email** (abilitato di default)
- In **Authentication → URL Configuration** imposta:
  - **Site URL**: `https://tuo-dominio.vercel.app`
  - **Redirect URLs**: `https://tuo-dominio.vercel.app/auth/callback`

---

## 2. Deploy su Vercel (raccomandato)

### 2.1 Importa il progetto

1. Vai su [vercel.com/new](https://vercel.com/new)
2. Connetti il tuo repository GitHub/GitLab
3. Seleziona il repository `smartbudget`

### 2.2 Configura le variabili d'ambiente

In **Environment Variables** aggiungi:

| Variabile | Descrizione | Obbligatoria |
|-----------|-------------|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave pubblica Supabase | ✅ |
| `RESEND_API_KEY` | API key [Resend](https://resend.com) per email | ⬜ |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram per notifiche | ⬜ |

> Le variabili `RESEND_API_KEY` e `TELEGRAM_BOT_TOKEN` sono necessarie solo se si vuole abilitare le notifiche esterne.

### 2.3 Deploy

Clicca **Deploy**. Vercel eseguirà automaticamente `npm run build`.

Al termine, il progetto sarà disponibile su `https://[nome-progetto].vercel.app`.

### 2.4 Aggiorna il Site URL in Supabase

Dopo il primo deploy, torna su Supabase → **Authentication → URL Configuration** e aggiorna **Site URL** con l'URL definitivo assegnato da Vercel.

---

## 3. Deploy su Railway

### 3.1 Crea un nuovo progetto

1. Vai su [railway.app](https://railway.app) e crea un nuovo progetto.
2. Seleziona **Deploy from GitHub repo** e scegli il repository.

### 3.2 Configura le variabili d'ambiente

In **Variables** aggiungi le stesse variabili elencate nella sezione Vercel (§ 2.2).

### 3.3 Configura il build

In **Settings → Build**:
- Build command: `npm run build`
- Start command: `npm run start`
- Port: `3000`

---

## 4. Deploy su Render

### 4.1 Crea un Web Service

1. Vai su [render.com](https://render.com) → **New Web Service**
2. Connetti il repository GitHub
3. Configura:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Environment**: `Node`

### 4.2 Variabili d'ambiente

Aggiungi le variabili nella sezione **Environment** (stesse della sezione § 2.2).

---

## 5. Deploy Self-Hosted (VPS/Docker)

### 5.1 Requisiti server

- Ubuntu 22.04 LTS (o equivalente)
- Node.js 18+ e npm
- (Opzionale) Docker e Docker Compose
- Nginx come reverse proxy

### 5.2 Deploy manuale

```bash
# Clona il repository
git clone https://github.com/it-rainking/smartbudget.git
cd smartbudget

# Installa le dipendenze
npm install

# Crea il file delle variabili d'ambiente
cp .env.example .env.local
# Edita .env.local con i tuoi valori

# Build di produzione
npm run build

# Avvia il server
npm run start
```

Il server sarà in ascolto su `http://localhost:3000`.

### 5.3 Configurazione Nginx

```nginx
server {
    listen 80;
    server_name tuo-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Abilita HTTPS con Certbot:

```bash
sudo certbot --nginx -d tuo-dominio.com
```

### 5.4 Process manager (PM2)

```bash
npm install -g pm2
pm2 start npm --name "smartbudget" -- run start
pm2 save
pm2 startup
```

---

## 6. Variabili d'Ambiente — Riepilogo

```env
# Supabase (obbligatorie)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Notifiche email via Resend (opzionale)
RESEND_API_KEY=re_...

# Notifiche Telegram (opzionale)
TELEGRAM_BOT_TOKEN=...
```

---

## 7. Primo Accesso

1. Naviga sull'URL del progetto deployato.
2. Clicca **Registrati** e crea un account con email e password.
3. Conferma l'email (controlla la casella di posta).
4. Al primo login verrà mostrato il wizard di **Onboarding** (3 step):
   - Scelta valuta
   - Saldo iniziale
   - Creazione categorie default
5. Completato l'onboarding, verrai reindirizzato alla **Dashboard Mensile**.

---

## 8. Flusso di Aggiornamento

Per aggiornare il progetto su Vercel/Railway/Render, è sufficiente fare **push** sul branch principale del repository — il deploy avviene automaticamente.

Per un VPS:

```bash
git pull origin main
npm install
npm run build
pm2 restart smartbudget
```

---

## Risoluzione Problemi

| Problema | Soluzione |
|----------|-----------|
| Errore `NEXT_PUBLIC_SUPABASE_URL missing` | Verifica le variabili d'ambiente nella piattaforma di deploy |
| Redirect login infinito | Controlla **Redirect URLs** in Supabase Auth |
| Errore 500 su `/auth/callback` | Verifica che `Site URL` in Supabase corrisponda al dominio deployato |
| Google Fonts non caricati | Normale in ambienti senza accesso a CDN esterni; l'app usa system fonts come fallback |
| Warning `baseline-browser-mapping` | Non bloccante, può essere ignorato |
| Warning `middleware → proxy` | Non bloccante (deprecazione Next.js 16), può essere ignorato |

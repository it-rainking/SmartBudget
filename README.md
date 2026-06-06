# SmartBudget 💰

Piattaforma completa per la gestione delle finanze personali, costruita con Next.js e Supabase.

---

## Funzionalità

| Modulo | Percorso | Descrizione |
|--------|----------|-------------|
| Auth | `/login` `/signup` | Autenticazione Supabase con redirect onboarding |
| Onboarding | `/onboarding` | Wizard 3 step: valuta, saldo iniziale, categorie default |
| Dashboard Mensile | `/dashboard/mensile` | KPI, grafici donut/bar, delta%, media giornaliera |
| Dashboard Annuale | `/dashboard/annuale` | Trend 12 mesi, line chart, bar chart, highlights |
| Transazioni | `/transazioni` | CRUD con filtri mese/tipo, import da CSV |
| Budget | `/budget` | Budget previsto vs effettivo per categoria con auto-save |
| Fatture | `/fatture` | Lista + calendario, scadenze, stati, auto-renew |
| Obiettivi | `/obiettivi` | Risparmio/debiti con progress bar e scadenze |
| Impostazioni | `/settings` | Valuta, lingua, export GDPR, eliminazione dati |
| Notifiche | (bell icon) | Alert in-app: fatture in scadenza, budget sforato, obiettivi |
| Istruzioni | `/istruzioni` | Guida utente interattiva integrata nell'app |

---

## Stack Tecnico

| Layer | Tecnologia | Versione |
|-------|-----------|---------|
| Framework | Next.js App Router + Turbopack | 16.0.3 |
| UI | React + TailwindCSS | 19.2.0 / 4.x |
| Backend | Supabase (PostgreSQL + Auth + RLS) | 2.84.0 |
| SSR Auth | @supabase/ssr | 0.7.0 |
| State | React Query (@tanstack/react-query) | 5.90.10 |
| Grafici | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| Linguaggio | TypeScript strict | 5.x |

---

## Setup Locale

### 1. Clona e installa dipendenze

```bash
git clone https://github.com/it-rainking/smartbudget.git
cd smartbudget
npm install
```

### 2. Variabili d'ambiente

Crea un file `.env.local` nella root del progetto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Opzionali — notifiche esterne
RESEND_API_KEY=re_...
TELEGRAM_BOT_TOKEN=...
```

Puoi trovare `SUPABASE_URL` e `ANON_KEY` nel pannello Supabase → Project Settings → API.

### 3. Configurazione Supabase

Esegui le migration SQL per creare lo schema (tabelle, RLS, funzioni).
Assicurati che la funzione `create_default_categories(p_user_id uuid)` sia presente nel tuo progetto Supabase.

### 4. Avvia in sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

---

## Script disponibili

```bash
npm run dev      # Server di sviluppo (Turbopack)
npm run build    # Build di produzione
npm run start    # Avvia build di produzione
npm run lint     # Linting ESLint
```

---

## Struttura del Progetto

```
src/
├── app/                    # Next.js App Router
│   ├── api/notifications/  # API routes email + Telegram
│   ├── dashboard/
│   │   ├── mensile/        # Dashboard mensile
│   │   └── annuale/        # Dashboard annuale
│   ├── transazioni/        # Gestione transazioni + import CSV
│   ├── budget/             # Budget mensile per categoria
│   ├── fatture/            # Fatture e abbonamenti
│   ├── obiettivi/          # Obiettivi finanziari
│   ├── istruzioni/         # Guida utente integrata
│   ├── settings/           # Impostazioni account
│   ├── login/              # Accesso
│   ├── signup/             # Registrazione
│   └── onboarding/         # Wizard primo accesso
├── components/
│   ├── DashboardLayout.tsx # Layout con sidebar, nav, bell notifiche
│   ├── Toast.tsx           # Sistema toast (success/error/info)
│   ├── NotificationBell.tsx# Campanella notifiche in-app
│   └── ImportCSVModal.tsx  # Modal import transazioni da CSV
├── hooks/                  # React Query hooks per ogni dominio
├── lib/
│   ├── supabase.ts         # Client Supabase browser
│   ├── supabase-server.ts  # Client Supabase SSR
│   ├── queryClient.ts      # Configurazione React Query
│   └── utils.ts            # formatCurrency, formatDate, ecc.
└── types/
    ├── index.ts            # Tipi dominio (Goal, Transaction, ecc.)
    └── database.ts         # Tipi schema Supabase
```

---

## Formato CSV per Import

Il modal di import in `/transazioni` accetta file `.csv` con separatore `,` o `;`.

Colonne supportate (nomi in italiano o inglese):

| Colonna | Valori accettati |
|---------|-----------------|
| `data` / `date` | `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` |
| `tipo` / `type` | `entrata` / `income`, `spesa` / `expense`, `risparmio` / `saving` |
| `importo` / `amount` | numero positivo (es. `1250.50` oppure `1250,50`) |
| `descrizione` / `description` | testo libero (opzionale) |
| `metodo` / `payment_method` | metodo di pagamento (opzionale) |

Scarica il file di esempio direttamente dal modal.

---

## Flusso Utente

```
/signup → conferma email → /login → /onboarding (primo accesso) → /dashboard/mensile
```

Dopo l'onboarding il wizard non si ripresenta. Il middleware gestisce automaticamente i redirect basati sullo stato di autenticazione e `onboarding_completed`.

---

## Notifiche

Le notifiche funzionano su due livelli:

1. **In-app (computed)** — calcolate in tempo reale dai dati: fatture in scadenza, budget superato >110%, obiettivi ≥90%, saldo negativo. Si resettano al refresh.
2. **Persistite (DB)** — salvate nella tabella `notifications`, marcate come lette nel database.
3. **Esterne** — email via [Resend](https://resend.com) e messaggi Telegram tramite le API routes in `/api/notifications/`.

---

## Deploy

Il progetto è pronto per il deploy su **Vercel** o qualsiasi piattaforma Node.js.
Configura le variabili d'ambiente nella piattaforma di deploy prima di avviare la build.

---

## Stato del Progetto

| Fase | Descrizione | Stato |
|------|-------------|-------|
| 0–6 | Core features | ✅ Completato |
| 7 | UX + Bug fix | 🔄 In corso |
| 8 | Notifiche Email/Telegram | 🔄 In corso |
| 9 | Import OFX + AI categorizzazione | 📋 Pianificato |
| 10 | i18n, Multi-account | 🔮 Futuro |

---

## Licenza

Proprietario — © 2026 SmartBudget

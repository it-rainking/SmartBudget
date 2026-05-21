# SmartBudget 💰

Piattaforma completa per la gestione delle finanze personali, costruita con Next.js e Supabase.

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

## Stack Tecnico

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, TailwindCSS 4
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **State**: React Query (`@tanstack/react-query`)
- **Grafici**: Chart.js + react-chartjs-2
- **Linguaggio**: TypeScript

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
```

Puoi trovare questi valori nel pannello Supabase → Project Settings → API.

### 3. Configurazione Supabase

Esegui le migration SQL per creare lo schema (tabelle, RLS, funzioni).  
Assicurati che la funzione `create_default_categories(p_user_id uuid)` sia presente.

### 4. Avvia in sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Struttura del Progetto

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/
│   │   ├── mensile/        # Dashboard mensile
│   │   └── annuale/        # Dashboard annuale
│   ├── transazioni/        # Gestione transazioni
│   ├── budget/             # Budget mensile
│   ├── fatture/            # Fatture e abbonamenti
│   ├── obiettivi/          # Obiettivi finanziari
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
│   ├── supabase.ts         # Client Supabase
│   └── utils.ts            # formatCurrency, formatDate, ecc.
└── types/
    ├── index.ts            # Tipi dominio (Goal, Transaction, ecc.)
    └── database.ts         # Tipi generati schema Supabase
```

## Formato CSV per Import

Il modal di import in `/transazioni` accetta file `.csv` con separatore `,` o `;`.

Colonne supportate (nomi in italiano o inglese):

| Colonna | Valori accettati |
|---------|-----------------|
| `data` / `date` | `YYYY-MM-DD` oppure `DD/MM/YYYY` |
| `tipo` / `type` | `entrata`, `spesa`, `risparmio` (o `income`, `expense`, `saving`) |
| `importo` / `amount` | numero positivo (es. `1250.50` o `1250,50`) |
| `descrizione` | testo libero (opzionale) |
| `metodo` | metodo di pagamento (opzionale) |

Scarica il file di esempio direttamente dal modal.

## Deploy

Il progetto è pronto per il deploy su **Vercel** o qualsiasi piattaforma Node.js.  
Ricorda di configurare le variabili d'ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nella piattaforma di deploy.

## Licenza

Proprietario — © 2025 SmartBudget

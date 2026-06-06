# CLAUDE.md — SmartBudget

Guida tecnica per agenti AI che lavorano su questo codebase.

---

## Panoramica Progetto

**SmartBudget** — Piattaforma per la gestione delle finanze personali.

- **Target**: Privati, coppie, famiglie, lavoratori autonomi
- **Lingua UI**: Italiano (v1); i18n-ready per Inglese in roadmap

---

## Tech Stack

| Layer | Tecnologia | Versione |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.0.3 |
| UI | React + TailwindCSS | 19.2.0 / 4.x |
| Backend | Supabase (PostgreSQL + Auth + RLS) | 2.84.0 |
| SSR Auth | @supabase/ssr | 0.7.0 |
| State | React Query (`@tanstack/react-query`) | 5.90.10 |
| Grafici | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| Linguaggio | TypeScript strict | 5.x |

---

## Routing

```
/                         → redirect a /login o /dashboard/mensile
/login                    → Supabase email/password auth
/signup                   → Registrazione
/onboarding               → Wizard 3-step primo accesso
/dashboard/mensile        → KPI mensili + grafici
/dashboard/annuale        → Trend 12 mesi + grafici annuali
/transazioni              → CRUD transazioni + import CSV
/budget                   → Budget previsto vs effettivo
/fatture                  → Fatture/abbonamenti + calendario
/obiettivi                → Obiettivi finanziari con progress bar
/settings                 → Preferenze, export GDPR, danger zone
/auth/callback            → Callback OAuth Supabase
/api/notifications/send   → POST: invio email/Telegram
/api/notifications/process → POST: job processor notifiche
/api/notifications/test   → POST: test endpoint notifiche
```

### Middleware (`src/middleware.ts`)

Gestisce redirect auth su ogni request:
- **Route protette** (`/dashboard`, `/budget`, `/transazioni`, `/fatture`, `/obiettivi`, `/settings`, `/onboarding`): redirect a `/login` se non autenticato
- **Route auth** (`/login`, `/signup`): redirect a `/dashboard/mensile` se già autenticato
- Rinnova la sessione Supabase SSR ad ogni request

---

## Database Schema (Supabase/PostgreSQL)

Tutte le tabelle usano RLS con policy `user_id = auth.uid()`.

| Tabella | Campi chiave | Note |
|---------|-------------|------|
| `profiles` | full_name, avatar_url | Metadati utente |
| `settings` | currency, locale, initial_balance, onboarding_completed, notify_email, notify_telegram, notification_email, telegram_chat_id | 1 riga per utente |
| `income_categories` | name, icon, color, sort_order, is_active | |
| `expense_categories` | name, icon, color, sort_order, is_active | |
| `expense_subcategories` | category_id (FK→expense_categories), name, icon | |
| `saving_categories` | name, icon, color, sort_order, is_active | |
| `debt_items` | total_amount, remaining_amount, interest_rate, monthly_payment, ... | Non ancora usati in UI |
| `monthly_budgets` | month, year, notes | Header budget |
| `monthly_budget_items` | budget_id, category_type, category_id, planned_amount | Dettaglio per categoria |
| `transactions` | type (income/expense/saving/debt), category_id?, subcategory_id?, amount, date, description, payment_method, tags[], notes, is_recurring, recurring_id | category_id nullable (import CSV) |
| `invoices` | name, amount, due_date, paid_date, recurrence (once/weekly/monthly/quarterly/yearly), status (pending/paid/overdue/cancelled), description, paid_amount, category_id?, reminder_days, auto_renew | |
| `goals` | name, type (saving/debt), target_amount, current_amount, deadline, icon, color, is_completed, completed_at | |
| `notifications` | type (budget_exceeded/bill_due/goal_achieved/goal_progress/system), title, message, data, is_read, read_at | Notifiche persistite nel DB |

### Funzione RPC

```sql
create_default_categories(p_user_id uuid)
```
Chiamata durante l'onboarding per creare le categorie default dell'utente.

### Tipi TypeScript

- `src/types/database.ts` — tipi Supabase 2.84 (Row/Insert/Update + Relationships)
- `src/types/index.ts` — tipi dominio (Goal, Transaction, Invoice, Settings, ecc.)

**Attenzione Supabase 2.84**: ogni tabella nel tipo Database richiede `Relationships: []` anche se vuota. Le relazioni FK vanno dichiarate esplicitamente con `foreignKeyName`, `columns`, `isOneToOne`, `referencedRelation`, `referencedColumns`. Il top-level dello schema `public` deve avere `Views`, `Enums`, `CompositeTypes`.

---

## Struttura File

```
src/
├── app/
│   ├── layout.tsx                  # Root layout, Providers, system font
│   ├── page.tsx                    # Redirect a /login
│   ├── middleware.ts               # Protected route redirects + session refresh
│   ├── api/
│   │   └── notifications/
│   │       ├── send/route.ts       # Invio email (Resend) + Telegram
│   │       ├── process/route.ts    # Job processor per coda notifiche
│   │       └── test/route.ts       # Endpoint di test
│   ├── auth/callback/route.ts      # Supabase OAuth callback
│   ├── login/page.tsx              # Login → check onboarding → redirect
│   ├── signup/page.tsx             # Registrazione
│   ├── onboarding/page.tsx         # Wizard 3-step
│   ├── dashboard/
│   │   ├── mensile/page.tsx        # KPI, donut chart spese, bar chart, delta%
│   │   └── annuale/page.tsx        # Year selector, line/bar charts, table
│   ├── transazioni/page.tsx        # Lista + form + import CSV modal
│   ├── budget/page.tsx             # Tab spese/entrate/risparmi, input inline
│   ├── fatture/page.tsx            # Lista + calendario + modal nuova fattura
│   ├── obiettivi/page.tsx          # Grid card + modal creazione + modal progresso
│   └── settings/page.tsx           # Preferenze + export + danger zone
├── components/
│   ├── DashboardLayout.tsx         # Sidebar (desktop) + header (mobile) + NotificationBell
│   ├── Providers.tsx               # QueryClientProvider wrapper
│   ├── Toast.tsx                   # ToastContext + ToastProvider + useToast
│   ├── NotificationBell.tsx        # Bell con badge, popover; unisce computed + DB notifications
│   └── ImportCSVModal.tsx          # Drag-drop CSV, preview, bulk insert
├── hooks/
│   ├── useAuth.ts                  # user, loading, signOut, isAuthenticated
│   ├── useSettings.ts              # useSettings, useUpdateSettings, useCompleteOnboarding
│   ├── useCategories.ts            # useIncomeCategories, useExpenseCategories, useDeleteCategory, ecc.
│   ├── useTransactions.ts          # useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction, useMonthlyKPIs
│   ├── useBudget.ts                # useMonthlyBudget, useEnsureMonthlyBudget, useUpsertBudgetItem, useActualAmountsByCategory
│   ├── useInvoices.ts              # useInvoices, useCreateInvoice, useUpdateInvoice, useMarkAsPaid, useDeleteInvoice
│   ├── useGoals.ts                 # useGoals, useCreateGoal, useUpdateGoal, useAddGoalProgress, useCompleteGoal, useDeleteGoal
│   ├── useAnnualData.ts            # useAnnualData (fetch anno intero, aggrega per mese)
│   ├── useImportTransactions.ts    # parseCSV + useImportTransactions (bulk insert)
│   └── useNotifications.ts         # Notifiche computed in-memory + usePersistedNotifications + useMarkNotificationRead
└── lib/
    ├── supabase.ts                 # createBrowserClient() — client singleton lato browser
    ├── supabase-server.ts          # createServerClient() — client lato server (cookies)
    ├── queryClient.ts              # QueryClient config (staleTime 5min, retry 1, no refocus)
    └── utils.ts                    # formatCurrency, formatDate, formatMonth, getMonthDateRange, classNames
```

---

## Pattern e Convenzioni

### Data fetching

Tutti gli hook usano React Query. Chiavi query:
```
['settings']
['transactions', { month, year, type?, category?, payment_method? }]
['monthly_kpis', month, year]
['annual_data', year]
['monthly_budget', { month, year }]
['budget_items', { month, year }]
['actual_amounts', { month, year }]
['invoices']
['goals']
['income_categories'] / ['expense_categories'] / ['saving_categories']
['notifications']
```

**React Query config** (in `src/lib/queryClient.ts`):
```ts
staleTime: 1000 * 60 * 5  // 5 minuti
retry: 1
refetchOnWindowFocus: false
```

### Mutation pattern

```ts
const mutation = useMutation({
  mutationFn: async (data) => { ... },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['...'] }),
})
```

### Toast

```ts
const { showToast } = useToast()
showToast('Messaggio', 'success' | 'error' | 'info')
```
`useToast` funziona solo dentro `<ToastProvider>` che è già dentro `DashboardLayout`.

### Valuta

```ts
const { data: settings } = useSettings()
const fmt = (n: number) => formatCurrency(n, settings?.currency || 'EUR')
```

### Date

Usare sempre `date.split('-')` invece di `new Date(date)` per estrarre mese/anno da stringhe `YYYY-MM-DD` — evita problemi timezone UTC vs locale.

`getMonthDateRange(month, year)` in `utils.ts` restituisce `{ startDate: 'YYYY-MM-01', endDate: 'YYYY-MM-31' }`.

### Invoice status dinamico

`applyDynamicStatus()` in `useInvoices.ts` calcola `overdue` confrontando `due_date < today` lato client, non si fida solo del valore nel DB.

### Client Supabase

- **Browser** (`src/lib/supabase.ts`): `import { supabase } from '@/lib/supabase'` — singleton, usato in tutti gli hook
- **Server** (`src/lib/supabase-server.ts`): usato in API routes e middleware, legge/scrive cookie SSR

### Path alias

`@/*` → `./src/*` (configurato in `tsconfig.json`)

---

## Notifiche In-App

Le notifiche hanno due livelli:

1. **Computed** (`useNotifications.ts`): calcolate dai dati esistenti (invoices, goals, transactions KPI, budget). Non persistite, reset al refresh.
   - Fatture in scadenza (finestra 7 giorni; warning se ≤2 giorni)
   - Fatture scadute aggregate
   - Obiettivi ≥90% completati
   - Budget spese superato (>110% del pianificato)
   - Saldo negativo

2. **Persistite** (`usePersistedNotifications`): lette dalla tabella `notifications` nel DB (`is_read = false`).
   - `useMarkNotificationRead()` aggiorna `is_read + read_at` nel DB

`NotificationBell.tsx` unisce entrambe le sorgenti e deduplica per id. Il dismiss locale (computed) si azzera al refresh; le persistite vengono marcate nel DB.

Per l'invio asincrono: API route `/api/notifications/send` gestisce email (Resend) e Telegram in base a `settings.notify_email` / `settings.notify_telegram`.

---

## Import CSV

`parseCSV()` in `useImportTransactions.ts`:
- Separatore auto-detect (`,` o `;`)
- Colonne: `data/date`, `tipo/type`, `importo/amount`, `descrizione/description`, `metodo/payment_method`
- Date: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`
- Tipo: `entrata/income` → income, `spesa/expense` → expense, `risparmio/saving` → saving
- Amount: parseFloat con normalizzazione virgola → punto
- Le transazioni importate hanno `category_id: null` (la colonna è nullable nel DB)

---

## Ambiente di Build

- `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored)
- Google Fonts non disponibili in container remoti → usare `font-sans` (system fonts)
- Warning `baseline-browser-mapping` a ogni build: non bloccante, ignorare
- Warning `middleware → proxy`: non bloccante (Next.js 16 depreca il nome `middleware`)

**Scripts**:
```
npm run dev    # next dev (Turbopack)
npm run build  # next build
npm run start  # next start
npm run lint   # eslint
```

### Testing

**Nessun test presente** — niente jest/vitest/playwright. Verificare le feature manualmente.

---

## Stato Implementazione

| Fase | Stato |
|------|-------|
| Phase 0–6 | ✅ Completato |
| Phase 7 — UX + Bug fix | 🔄 In corso |
| Phase 8 — Notifiche Email/Telegram | 🔄 In corso (API routes presenti) |
| Phase 9 — Import OFX + AI categorizzazione | 📋 Pianificato |
| Phase 10 — i18n, Multi-account | 🔮 Futuro |

### Bug noti
- Notifiche computed dismiss non persiste al refresh (stato locale)
- Transazioni CSV importate senza `category_id` → non filtrabili per categoria
- Delta% dashboard mensile mostra `NaN` se nessuna transazione mese precedente
- Calendario fatture: grid 7-col troppo stretto su schermi < 360px

### Feature implementate in Phase 7 (completate)
- ✅ Edit transazione (`useUpdateTransaction`)
- ✅ Edit fattura (`useUpdateInvoice`)
- ✅ Edit obiettivo (`useUpdateGoal`)

### Priority backlog (Phase 7)
- Categoria "Non categorizzato" per import CSV
- Paginazione/virtual scroll transazioni
- Budget: copia da mese precedente
- Dark mode toggle manuale in Settings
- `debt_items` — UI non ancora implementata

---

## Agenti consigliati

| Agente | Quando usarlo |
|--------|--------------|
| `vibe-dev` | Implementazione nuove feature, fix bug |
| `code-reviewer` | Revisione pre-deploy, audit sicurezza RLS |
| `plan` | Progettazione Phase 7+, decisioni architetturali |

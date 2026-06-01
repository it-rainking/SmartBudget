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
| Framework | Next.js (App Router, Turbopack) | 16.x |
| UI | React + TailwindCSS | 19.x / 4.x |
| Backend | Supabase (PostgreSQL + Auth + RLS) | 2.84 |
| State | React Query (`@tanstack/react-query`) | 5.x |
| Grafici | Chart.js + react-chartjs-2 | 4.x |
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
```

---

## Database Schema (Supabase/PostgreSQL)

Tutte le tabelle usano RLS con policy `user_id = auth.uid()`.

| Tabella | Campi chiave | Note |
|---------|-------------|------|
| `settings` | currency, locale, initial_balance, onboarding_completed | 1 riga per utente |
| `income_categories` | name, icon, color, sort_order, is_active | |
| `expense_categories` | name, icon, color, sort_order, is_active | |
| `expense_subcategories` | category_id (FK→expense_categories), name, icon | |
| `saving_categories` | name, icon, color, sort_order, is_active | |
| `monthly_budgets` | month, year, notes | Header budget |
| `monthly_budget_items` | budget_id, category_type, category_id, planned_amount | Dettaglio per categoria |
| `transactions` | type, category_id?, amount, date, description, payment_method | category_id nullable (import CSV) |
| `invoices` | name, amount, due_date, status, recurrence, auto_renew | status: pending/paid/overdue/cancelled |
| `goals` | name, type (saving/debt), target_amount, current_amount, deadline, is_completed | |
| `debt_items` | (presenti in schema, non ancora usati in UI) | |

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
│   ├── auth/callback/              # Supabase OAuth callback
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
│   ├── NotificationBell.tsx        # Bell con badge, popover notifiche, dismiss
│   └── ImportCSVModal.tsx          # Drag-drop CSV, preview, bulk insert
├── hooks/
│   ├── useAuth.ts                  # user, signIn, signOut, signUp
│   ├── useSettings.ts              # useSettings, useUpdateSettings, useCompleteOnboarding
│   ├── useCategories.ts            # useIncomeCategories, useExpenseCategories, ecc.
│   ├── useTransactions.ts          # useTransactions, useCreateTransaction, useMonthlyKPIs
│   ├── useBudget.ts                # useMonthlyBudget, useEnsureMonthlyBudget, useUpsertBudgetItem
│   ├── useInvoices.ts              # useInvoices, useCreateInvoice, useMarkAsPaid, ecc.
│   ├── useGoals.ts                 # useGoals, useCreateGoal, useAddGoalProgress, ecc.
│   ├── useAnnualData.ts            # useAnnualData (fetch anno intero, raggruppa per mese)
│   ├── useImportTransactions.ts    # parseCSV + useImportTransactions (bulk insert)
│   └── useNotifications.ts         # Notifiche calcolate in real-time da dati esistenti
└── lib/
    ├── supabase.ts                 # createBrowserClient()
    └── utils.ts                    # formatCurrency, formatDate, formatMonth, classNames
```

---

## Pattern e Convenzioni

### Data fetching

Tutti gli hook usano React Query. Chiavi query:
```
['settings']
['transactions', { month, year, type? }]
['monthly_kpis', month, year]
['annual_data', year]
['monthly_budget', { month, year }]
['invoices']
['goals']
['income_categories'] / ['expense_categories'] / ['saving_categories']
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

### Invoice status dinamico

`applyDynamicStatus()` in `useInvoices.ts` calcola `overdue` confrontando `due_date < today` lato client, non si fida solo del valore nel DB.

---

## Notifiche In-App

Le notifiche non hanno una tabella DB dedicata. Sono calcolate in `useNotifications.ts` dai dati esistenti (invoices, goals, transactions KPI, budget). Il dismiss è in stato locale del componente `NotificationBell` — si azzera al refresh.

Per persistere le notifiche (v2): aggiungere tabella `notifications` al DB e al tipo `database.ts`.

---

## Import CSV

`parseCSV()` in `useImportTransactions.ts`:
- Separatore auto-detect (`,` o `;`)
- Colonne: `data/date`, `tipo/type`, `importo/amount`, `descrizione/description`, `metodo/payment_method`
- Date: `YYYY-MM-DD` e `DD/MM/YYYY`
- Le transazioni importate hanno `category_id: null` (la colonna è nullable nel DB)

---

## Ambiente di Build

- `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored)
- Google Fonts non disponibili in container remoti → usare `font-sans` (system fonts)
- Warning `baseline-browser-mapping` a ogni build: non bloccante, ignorare
- Warning `middleware → proxy`: non bloccante (Next.js 16 depreca il nome `middleware`)

---

## Stato Implementazione

| Fase | Stato |
|------|-------|
| Phase 0–6 | ✅ Completato |
| Phase 7 — UX + Bug fix | 🔜 Prossimo |
| Phase 8 — Notifiche Email/Telegram | 📋 Pianificato |
| Phase 9 — Import OFX + AI categorizzazione | 📋 Pianificato |
| Phase 10 — i18n, Multi-account | 🔮 Futuro |

### Bug noti (Phase 7)
- Notifiche dismiss non persiste al refresh (stato locale, no DB)
- Transazioni CSV importate senza `category_id` → non filtrabili per categoria
- Delta% dashboard mensile mostra `NaN` se nessuna transazione mese precedente
- Budget: record `monthly_budgets` non creato fino al primo salvataggio importo
- Calendario fatture: grid 7-col troppo stretto su schermi < 360px

### Priority backlog (Phase 7)
- Edit transazione, fattura, obiettivo (attualmente solo delete/create)
- Categoria "Non categorizzato" per import CSV
- Paginazione/virtual scroll transazioni
- Budget: copia da mese precedente
- Dark mode toggle manuale in Settings

---

## Agenti consigliati

| Agente | Quando usarlo |
|--------|--------------|
| `vibe-dev` | Implementazione nuove feature, fix bug |
| `code-reviewer` | Revisione pre-deploy, audit sicurezza RLS |
| `my-library` | Prima di scrivere nuove utility (check `TutteLeMieFunzioni/`) |
| `plan` | Progettazione Phase 7+, decisioni architetturali |

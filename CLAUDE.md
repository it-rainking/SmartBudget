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
/recupera-password        → Richiesta reset password
/aggiorna-password        → Imposta nuova password (dopo link email)
/onboarding               → Wizard 3-step primo accesso
/dashboard/mensile        → KPI mensili + saldo disponibile + grafici (incl. andamento saldo giornaliero)
/dashboard/annuale        → Trend 12 mesi + grafici annuali
/transazioni              → CRUD transazioni + import CSV/OFX
/spese-ricorrenti         → Pannello modelli di spesa ricorrente: generazione automatica mensile + backfill su N mesi passati
/budget                   → Budget previsto vs effettivo (⚠️ non linkata in sidebar: accesso disattivato al momento, codice mantenuto)
/fatture                  → Fatture/abbonamenti + calendario (⚠️ non linkata in sidebar: strumento non in uso, codice mantenuto)
/obiettivi                → Obiettivi finanziari con progress bar
/debiti                   → Debiti: strategie snowball/avalanche, piano di rimborso (⚠️ non linkata in sidebar: accesso disattivato al momento, codice mantenuto)
/investimenti             → Portafoglio investimenti (import CSV Fineco, prezzi Google Finance/Yahoo)
/istruzioni               → Guida utente
/settings                 → Preferenze, export GDPR, danger zone
/auth/callback            → Callback OAuth Supabase
/api/account/delete       → POST: elimina dati utente + account Auth (GDPR)
/api/notifications/send   → POST: invio email/Telegram
/api/notifications/process → POST: job processor notifiche
/api/notifications/test   → POST: test endpoint notifiche
/api/ai/categorize        → POST: suggerimenti categoria via Claude
/api/ai/insights          → POST: insight finanziari mensili via Claude
/api/ai/simplify-categories → POST: suggerimenti di semplificazione categorie
/api/investments/import   → POST: import CSV Fineco (sostituisce integralmente le holdings)
/api/investments/summary  → GET: riepilogo portafoglio (market_value, P&L, pesi)
/api/investments/tickers  → GET: lista ticker_gf dell'utente, testo incollabile nel Sheet ponte
/api/cron/prices          → POST: price fetcher (Google Sheet ponte + fallback Yahoo) + aggiornamento cambi valuta (`fx_rates`), protetto da CRON_SECRET
/api/health               → GET: health check + commit della build in esecuzione (`commit`/`commit_short`, letto da VERCEL_/RAILWAY_GIT_COMMIT_SHA): serve a verificare che il deploy sia allineato al repo
```

### Middleware (`src/middleware.ts`)

Gestisce redirect auth su ogni request:
- **Route protette** (`/dashboard`, `/budget`, `/transazioni`, `/spese-ricorrenti`, `/fatture`, `/obiettivi`, `/debiti`, `/investimenti`, `/settings`, `/istruzioni`, `/onboarding`, `/aggiorna-password`): redirect a `/login` se non autenticato
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
| `debt_items` | total_amount, remaining_amount, interest_rate, monthly_payment, ... | UI in `/debiti` (strategie snowball/avalanche) |
| `monthly_budgets` | month, year, notes | Header budget |
| `monthly_budget_items` | budget_id, category_type, category_id, planned_amount | Dettaglio per categoria |
| `transactions` | type (income/expense/saving/debt), category_id?, subcategory_id?, amount, date, description, payment_method, tags[], notes, is_recurring, recurring_id, recurring_expense_id?, installment_plan_id?, installment_number?, installment_count?, is_exceptional | category_id nullable (import CSV); campi installment_* valorizzati solo sulle rate di spese dilazionate (vedi sezione "Spese a rate"); `recurring_expense_id` collega l'occorrenza al modello in `recurring_expenses` (vedi sezione "Spese ricorrenti"), NULL se non collegata; `is_exceptional` = movimento una tantum escluso dai trend |
| `invoices` | name, amount, due_date, paid_date, recurrence (once/weekly/monthly/quarterly/yearly), status (pending/paid/overdue/cancelled), description, paid_amount, category_id?, reminder_days, auto_renew | |
| `goals` | name, type (saving/debt), target_amount, current_amount, deadline, icon, color, is_completed, completed_at | |
| `notifications` | type (budget_exceeded/bill_due/goal_achieved/goal_progress/system), title, message, data, is_read, read_at | Notifiche persistite nel DB |
| `assets` | user_id, isin, ticker_gf, ticker_yahoo?, name, asset_class, currency, price_divisor | Un asset (ISIN) per utente, UI in `/investimenti`; `currency` popolata dalla colonna `Valuta` del CSV Fineco (default EUR); `price_divisor` = fattore di quotazione (1 per azioni/ETF, 100 per obbligazioni quotate in % del nominale) |
| `holdings` | user_id, asset_id (FK→assets), quantity, avg_cost, source, imported_at | Snapshot: sostituito integralmente a ogni import CSV, non delta |
| `price_snapshots` | asset_id (FK→assets), price, change_pct, currency, source (gsheet/yahoo), fetched_at | Scritto solo dal cron `/api/cron/prices` (service role) |
| `isin_ticker_lookup` | isin (PK), ticker_gf?, ticker_yahoo?, name?, asset_class? | Tabella globale (non per-utente) di riferimento ISIN→ticker, manutenuta manualmente |
| `fx_rates` | base, quote (PK composita), rate, source (gsheet/yahoo), fetched_at | Cambi valuta, tabella globale (non per-utente): una riga per coppia aggiornata in place dal cron `/api/cron/prices` (service role), letta da `/api/investments/summary` |
| `recurring_expenses` | name, category_id?, subcategory_id?, amount, day_of_month, payment_method?, notes?, start_date, is_active | Modello di spesa ricorrente, UI in `/spese-ricorrenti`; le occorrenze generate sono normali righe in `transactions` con `recurring_expense_id` valorizzato |

### Funzioni RPC

```sql
create_default_categories(p_user_id uuid)
```
Chiamata durante l'onboarding per creare le categorie default dell'utente.

```sql
get_investment_summary(p_user_id uuid)
```
Join holdings↔assets↔ultimo price_snapshot (LATERAL) in una sola query; usata da `GET /api/investments/summary` che calcola market_value/P&L/pesi lato TypeScript.

**Valute**: le posizioni in valuta diversa da `settings.currency` vengono convertite prima di entrare nei totali, usando i cambi che il cron prezzi salva in `fx_rates` (stesse due sorgenti dei prezzi: `CURRENCY:USDEUR` sul Sheet ponte, `USDEUR=X` su Yahoo). Ogni `InvestmentPosition` porta i valori nella propria valuta più `fx_rate`/`market_value_base`/`cost_base`/`pnl_abs_base`; totali, pesi e ripartizione per classe sono calcolati sui valori convertiti. Se il cambio di una valuta manca, `fx_rate` è `null`, quelle posizioni restano **fuori** dai totali (peso 0%) e la valuta finisce in `InvestmentSummary.unconverted_currencies`, che la pagina segnala — mai una somma di valute diverse. `base_currency` è la valuta dei totali, `fx_as_of` la data del cambio più vecchio usato. Migrazione DB: `supabase/migrate_investments_fx.sql`.

**Sorgenti prezzi**: il Sheet ponte è opzionale (senza `GSHEET_ID` il cron risponde con `sheet_error` e prosegue). Yahoo ha due canali in cascata: `quote` di `yahoo-finance2`, che dipende da un flusso cookie + crumb, e — quando quello non risponde — l'endpoint `chart`, che ne fa a meno (`src/lib/prices/yahooChart.ts`). Entrambi loggano con prefisso `[yahoo]` / `[yahoo:chart]`, successi di chart compresi: è così che si capisce quale canale ha servito un giro del cron.

**Controvalore**: sempre `quantità × prezzo / assets.price_divisor`. Il divisore vale 1 per azioni/ETF e 100 per i titoli quotati in percentuale del nominale (obbligazioni), dove la "quantità" Fineco è il valore nominale. Una posizione senza `price_snapshot` è valorizzata al costo di carico (`priced_at_cost: true`), non a zero. Migrazione DB: `supabase/migrate_investments_bond_quotation.sql`.

### Tipi TypeScript

- `src/types/database.ts` — tipi Supabase 2.84 (Row/Insert/Update + Relationships)
- `src/types/index.ts` — tipi dominio (Goal, Transaction, Invoice, Settings, ecc.)
- `src/types/investments.ts` — tipi dominio modulo investimenti (Asset, Holding, InvestmentSummary, ecc.)

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
│   │   ├── notifications/
│   │   │   ├── send/route.ts       # Invio email (Resend) + Telegram
│   │   │   ├── process/route.ts    # Job processor per coda notifiche
│   │   │   └── test/route.ts       # Endpoint di test
│   │   ├── investments/
│   │   │   ├── import/route.ts     # Import CSV Fineco (sostituisce le holdings)
│   │   │   ├── summary/route.ts    # Riepilogo portafoglio (market_value, P&L, pesi)
│   │   │   └── tickers/route.ts    # Lista ticker_gf per il Sheet ponte
│   │   └── cron/prices/route.ts    # Price fetcher (Sheet ponte + fallback Yahoo) + cambi valuta
│   ├── auth/callback/route.ts      # Supabase OAuth callback
│   ├── login/page.tsx              # Login → check onboarding → redirect
│   ├── signup/page.tsx             # Registrazione
│   ├── onboarding/page.tsx         # Wizard 3-step
│   ├── dashboard/
│   │   ├── mensile/page.tsx        # KPI, donut chart spese, bar chart, delta%
│   │   └── annuale/page.tsx        # Year selector, line/bar charts, table
│   ├── transazioni/page.tsx        # Lista + form + import CSV modal
│   ├── spese-ricorrenti/page.tsx   # Pannello modelli ricorrenti + backfill arretrati
│   ├── budget/page.tsx             # Tab spese/entrate/risparmi, input inline
│   ├── fatture/page.tsx            # Lista + calendario + modal nuova fattura
│   ├── obiettivi/page.tsx          # Grid card + modal creazione + modal progresso
│   ├── investimenti/page.tsx       # Header card, allocazione, tabella posizioni, import CSV
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
│   ├── useTransactions.ts          # useTransactions, useCreateTransaction, useCreateInstallmentPlan, useUpdateTransaction, useDeleteTransaction, useDeleteInstallmentPlan, useMonthlyKPIs
│   ├── useInstallments.ts          # useInstallmentPlans — ricostruisce i piani di spese a rate (PayPal) che toccano un mese
│   ├── useRecurringExpenses.ts     # useRecurringExpenses, useCreateRecurringExpense, useUpdateRecurringExpense, useDeleteRecurringExpense, useEnsureCurrentMonthRecurring, useGenerateRecurringBackfill
│   ├── useBudget.ts                # useMonthlyBudget, useEnsureMonthlyBudget, useUpsertBudgetItem, useActualAmountsByCategory
│   ├── useInvoices.ts              # useInvoices, useCreateInvoice, useUpdateInvoice, useMarkAsPaid, useDeleteInvoice
│   ├── useGoals.ts                 # useGoals, useCreateGoal, useUpdateGoal, useAddGoalProgress, useCompleteGoal, useDeleteGoal
│   ├── useAnnualData.ts            # useAnnualData (fetch anno intero, aggrega per mese)
│   ├── useImportTransactions.ts    # parseCSV + useImportTransactions (bulk insert)
│   ├── useNotifications.ts         # Notifiche computed in-memory + usePersistedNotifications + useMarkNotificationRead
│   └── useInvestments.ts           # useInvestments (summary), useImportCsv
└── lib/
    ├── supabase.ts                 # createBrowserClient() — client singleton lato browser
    ├── supabase-server.ts          # createServerClient() — client lato server (cookies)
    ├── queryClient.ts              # QueryClient config (staleTime 5min, retry 1, no refocus)
    ├── utils.ts                    # formatCurrency, formatDate, formatMonth, getMonthDateRange, classNames
    ├── investments/parseFinecoCsv.ts # Parser CSV Fineco: separatore/codifica/riga header auto-rilevati, colonne per significato, dedup ISIN, valuta e fattore di quotazione per posizione
    ├── investments/resolveTicker.ts   # Deriva ticker_gf/ticker_yahoo da Simbolo + Mercato del CSV (solo mercati mappati)
    ├── investments/classifyAsset.ts   # Classe dell'asset dedotta da tipo + nome del CSV quando il lookup non copre l'ISIN
    └── prices/                     # PriceProvider: googleSheets.ts (Sheet ponte), yahoo.ts + yahooChart.ts (due canali Yahoo in cascata), resolveQuote.ts, fx.ts (cambi valuta)
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
['installment_plans', { month, year }]
['recurring_expenses']
['investments_summary']
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

### Movimenti eccezionali (`is_exceptional`)

Una transazione marcata come eccezionale è una tantum (acquisto auto, rimborso, bonus). Regola generale: **conta nei totali reali, non conta nelle statistiche di andamento**.

Esclusa da:
- `useMonthlyKPIs`: `dailyAverage`, `deltaExpensePercent`, `prevMonthExpenses`, media storica delle entrate (`projectedIncome`), `ordinaryBalance`
- `useAnnualData`: serie `ordinary*` usate da grafici, mesi notevoli e confronto anno su anno (`/dashboard/annuale` ha un toggle reale/ordinario, default ordinario)
- `useBudget.useActualAmountsByCategory`: ritorna `{ actuals, exceptional }` — `actuals` è al netto degli eccezionali
- `useNotifications`: alert "budget superato" e "saldo negativo"
- `/api/ai/insights`: il prompt riceve i valori ordinari e cita gli eccezionali a parte

Inclusa in: `totalIncome`/`totalExpenses`/`totalSavings`/`balance`, `categoryBreakdown`, totali annuali, e nel saldo disponibile (vedi sotto: un movimento eccezionale è comunque denaro che si è mosso davvero).

### Saldo netto vs saldo disponibile

Due concetti distinti in `useMonthlyKPIs`, da non confondere:

- **`balance`** (card "Saldo netto") — *flusso* del mese: `entrate − spese − risparmi − debiti`. Può basarsi su `projectedIncome` quando lo stipendio del mese non è ancora registrato (`isIncomeEstimated`). Risponde a "quanto ho messo da parte questo mese".
- **`openingBalance` / `closingBalance` / `dailyBalances`** (card "Saldo disponibile" + grafico "Andamento del saldo") — *stock*: `settings.initial_balance` + somma cumulata di tutti i movimenti realmente registrati. **Mai** basato su stime: mostrerebbe denaro non ancora incassato. I risparmi sono sottratti (escono dal conto corrente).

`dailyBalances` è la curva giorno per giorno del mese selezionato; nel mese corrente la pagina la tronca a oggi per non far sembrare una previsione la linea piatta fino a fine mese.

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
- Colonne obbligatorie: `data/date`, `importo/amount`
- Colonne opzionali: `tipo/type` (default `expense` se assente/non riconosciuto), `descrizione/description`, `categoria/category`, `sottocategoria/subcategory` (solo spese), `metodo/method/payment_method/pagamento`, `tag/tags/etichette` (valori separati da `|`), `note/nota/notes`, `eccezionale/exceptional/una tantum` (`si/sì/yes/true/1/x` → `true`)
- Date: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`
- Tipo: `entrata/income` → income, `spesa/expense` → expense, `risparmio/saving` → saving (nessun supporto per `debt` in bulk import — i debiti si gestiscono da `/debiti`)
- Amount: parseFloat con normalizzazione virgola → punto
- `categoria`/`sottocategoria` sono testo libero nel CSV: `resolveCategoryNames()` (stesso file) li confronta case-insensitive con le categorie reali dell'utente (caricate in `ImportCSVModal.tsx` via `useIncomeCategories`/`useExpenseCategories`/`useSavingCategories`) e popola `category_id`/`subcategory_id`. Se il nome non corrisponde a nessuna categoria, la riga resta con `category_id: undefined` — verrà mostrata con badge ⚠️ nell'anteprima e può ricevere una categoria dal pulsante "Categorizza con AI" o dal fallback "Non categorizzato" (solo spese) al momento dell'insert
- `useImportTransactions()` inserisce anche `subcategory_id`, `tags`, `notes`, `is_exceptional` insieme ai campi già esistenti

---

## Spese a rate (PayPal "Paga in 3 rate")

Nel form di nuova transazione (`transazioni/page.tsx`), quando `type = expense` e il metodo di pagamento contiene "paypal" (case-insensitive, vedi `isPaypalMethod()` in `utils.ts`) compare il toggle **"Paga in 3 rate"**.

- L'importo inserito è il **totale** dell'acquisto. `splitInstallments()` lo divide in `PAYPAL_INSTALLMENT_COUNT` (3) rate arrotondate al centesimo, con l'eventuale resto sulla prima rata.
- `installmentDates()` calcola le date delle rate successive: stesso giorno del mese, mese per mese (`addMonthsClamped()`), con clamp all'ultimo giorno se il mese di destinazione è più corto.
- `useCreateInstallmentPlan()` (in `useTransactions.ts`) inserisce le N rate come normali righe in `transactions`, tutte con lo stesso `installment_plan_id` (un nuovo UUID) e `installment_number` / `installment_count` valorizzati. Non c'è una tabella separata: ogni rata è una transazione a sé, quindi pesa su KPI/budget del proprio mese fin da subito (anche le rate future, non ancora addebitate).
- Una rata è considerata **addebitata** quando `date <= oggi`, **programmata** altrimenti — calcolato lato client in `useInstallmentPlans()` (`useInstallments.ts`), non c'è un flag nel DB.
- `useInstallmentPlans(month, year)` ricostruisce i piani che toccano il mese richiesto (query ±5 mesi per raggruppare tutte le rate di un piano), usata nella sezione "💳 Spese PayPal a rate" della dashboard mensile (`dashboard/mensile/page.tsx`) per mostrare stato (`programmato` / `in_corso` / `completato`), rate addebitate/residue e importo totale.
- Modifica: editare una rata (`transazioni/page.tsx`) modifica solo quella riga, non l'intero piano.
- Eliminazione: il modal di conferma elimina offre la scelta fra "solo questa rata" (`useDeleteTransaction`) o "tutte le rate" (`useDeleteInstallmentPlan`, cancella per `installment_plan_id`).
- Migrazione DB: `supabase/migrate_paypal_installments.sql` aggiunge `installment_plan_id UUID`, `installment_number INTEGER`, `installment_count INTEGER` a `transactions` (anche in `schema.sql` per i nuovi progetti).

---

## Spese ricorrenti (pannello `/spese-ricorrenti`)

Sistema separato dal semplice toggle "ricorrente" del form transazioni: qui una spesa ricorrente è un **modello** (`recurring_expenses`) da cui le occorrenze mensili vengono generate automaticamente, non solo marcate.

- Un modello ha `name`, `category_id`/`subcategory_id` (categorie spesa), `amount`, `day_of_month` (1-31), `payment_method`, `notes`, `start_date` (prima ricorrenza generabile) e `is_active`.
- Ogni occorrenza generata è una **normale riga in `transactions`** (`type: 'expense'`, `is_recurring: true`), con `recurring_expense_id` valorizzato — nessuna tabella di storico separata, stesso pattern delle rate PayPal: pesa su KPI/budget del proprio mese fin da subito.
- **Generazione automatica in avanti**: `useEnsureCurrentMonthRecurring()` (in `useRecurringExpenses.ts`) crea le occorrenze mancanti del mese corrente per tutti i modelli attivi già iniziati (`start_date <= fine mese`). Viene chiamato una volta per sessione da `DashboardLayout` (hook `useAutoGenerateRecurringExpenses`), quindi si propaga automaticamente ad ogni apertura dell'app — non serve un cron dedicato.
- **Backfill nel passato**: nel pannello, il controllo "Genera arretrati" chiama `useGenerateRecurringBackfill(mesi)`, che applica la stessa logica di generazione a ciascuno degli ultimi N mesi (fino a 24), sempre idempotente (salta i mesi che hanno già un'occorrenza per quel modello).
- **Duplicati dal form transazioni**: quando si aggiunge manualmente una spesa con il toggle "Transazione ricorrente" attivo, `findSimilarRecurringExpense()` (in `utils.ts`) confronta categoria + importo (tolleranza 10%) con i modelli esistenti. Se trova un modello simile, il form mostra all'utente tre opzioni (collega al modello esistente / crea comunque un nuovo modello separato / registra solo questa transazione); se non trova nulla, propone una checkbox opzionale per salvarla anche come nuovo modello nel pannello.
- **Ordine di salvataggio dal form transazioni**: la transazione viene inserita per prima; il modello ricorrente (opzione "crea nuovo modello" o checkbox) viene creato dopo e collegato con un update di `recurring_expense_id`. Se la creazione del modello fallisce, la spesa resta salvata e il toast riporta il messaggio d'errore reale — il salvataggio della transazione non dipende mai dall'operazione accessoria sul pannello.
- Eliminare un modello non tocca le occorrenze già generate: `transactions.recurring_expense_id` passa a `NULL` (`ON DELETE SET NULL`), la transazione resta nello storico ma smette di ricevere nuove occorrenze.
- Migrazione DB: `supabase/migrate_recurring_expenses.sql` (anche in `schema.sql`/`rls_policies.sql` per i nuovi progetti).

## Ambiente di Build

- `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored)
- Google Fonts non disponibili in container remoti → usare `font-sans` (system fonts)
- Warning `baseline-browser-mapping` a ogni build: non bloccante, ignorare
- Warning `middleware → proxy`: non bloccante (Next.js 16 depreca il nome `middleware`)

**Job schedulati**: gli endpoint `/api/cron/prices` e `/api/notifications/process` sono POST protetti da `CRON_SECRET` e vanno chiamati dall'esterno. `vercel.json` li schedula **solo su Vercel**; il deploy attuale è su Railway, dove quelle entry sono inerti, quindi lo scheduler vive in `.github/workflows/cron-prices.yml` e `cron-notifications.yml` (secret del repository: `APP_URL`, `CRON_SECRET`; entrambi lanciabili a mano da Actions con `workflow_dispatch`).

**Scripts**:
```
npm run dev    # next dev (Turbopack)
npm run build  # next build
npm run start  # next start
npm run lint   # eslint
npm test       # vitest run (solo modulo investimenti, vedi sezione Testing)
```

### Testing

**Vitest** (introdotto per il modulo investimenti, `npm test`): copre solo `src/lib/investments/parseFinecoCsv.ts` e `src/lib/prices/*` (`tests/investments/*.test.ts`), niente altro nel repo ha test — verificare il resto delle feature manualmente. Niente jest/playwright.

---

## Stato Implementazione

| Fase | Stato |
|------|-------|
| Phase 0–6 | ✅ Completato |
| Phase 7 — UX + Bug fix | 🔄 In corso |
| Phase 8 — Notifiche Email/Telegram | 🔄 In corso (API routes presenti) |
| Phase 9 — Import OFX + AI categorizzazione | 📋 Pianificato |
| Phase 10 — i18n, Multi-account | 🔮 Futuro |
| Phase 11 — Modulo Investimenti | 🔄 Codice completo; richiede setup manuale (migration SQL, Sheet ponte + service account Google, vedi `docs/investimenti-setup.md`) prima di essere pienamente operativo |

### Bug noti
- Notifiche computed dismiss non persiste al refresh (stato locale in `NotificationBell.tsx`; solo le notifiche persistite nel DB sopravvivono al refresh)

### Feature implementate in Phase 7 (completate)
- ✅ Edit transazione (`useUpdateTransaction`)
- ✅ Edit fattura (`useUpdateInvoice`)
- ✅ Edit obiettivo (`useUpdateGoal`)
- ✅ Dark mode (toggle manuale in Settings + rilevamento `prefers-color-scheme`, `ThemeProvider.tsx`)
- ✅ Categoria "Non categorizzato" per import CSV/OFX senza categoria riconosciuta
- ✅ Paginazione transazioni (`PAGE_SIZE` in `transazioni/page.tsx`)
- ✅ `debt_items` — UI completa in `/debiti`
- ✅ Import OFX/QFX oltre a CSV (`parseOFX` in `useImportTransactions.ts`)
- ✅ Suggerimenti AI per categorizzazione/insight/semplificazione categorie (`/api/ai/*`, richiede `ANTHROPIC_API_KEY`)
- ✅ Budget: copia da mese precedente (`handleCopyFromPrevMonth` in `budget/page.tsx`)
- ✅ Filtro per categoria nella lista transazioni
- ✅ Spese PayPal a rate (toggle "Paga in 3 rate", generazione automatica delle rate nei 2 mesi successivi, sommario con stato nella dashboard mensile)
- ✅ Spese ricorrenti (pannello `/spese-ricorrenti`: modelli con generazione automatica mensile in avanti + backfill su N mesi passati; rilevamento duplicati con collegamento/creazione modello dal form transazioni)

### Priority backlog
- Aggregazione annuale lato SQL (view/RPC) invece di fetch raw + riduzione client-side (`useAnnualData.ts`)

---

## Agenti consigliati

| Agente | Quando usarlo |
|--------|--------------|
| `vibe-dev` | Implementazione nuove feature, fix bug |
| `code-reviewer` | Revisione pre-deploy, audit sicurezza RLS |
| `plan` | Progettazione Phase 7+, decisioni architetturali |

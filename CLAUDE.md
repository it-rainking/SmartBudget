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
/fondo-pensione           → Confronto fondo pensione con medie COVIP e principali fondi aperti + simulazione restare/spostarsi, vedi sezione dedicata
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
- **Route protette** (`/dashboard`, `/budget`, `/transazioni`, `/spese-ricorrenti`, `/fatture`, `/obiettivi`, `/debiti`, `/investimenti`, `/fondo-pensione`, `/settings`, `/istruzioni`, `/onboarding`, `/aggiorna-password`): redirect a `/login` se non autenticato
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
| `expense_categories` | name, icon, color, sort_order, is_active, spending_group? | `spending_group` = gruppo Kakebo (`fixed`/`essential`/`optional`/`leisure`/`extra`, NULL = da classificare), vedi sezione "Portamonete del mese" |
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
| `manual_prices` | user_id, asset_id (FK→assets), price, priced_at, note? | Prezzo inserito a mano dalla pagina `/investimenti` per le posizioni senza quotazione automatica (titoli di stato sul MOT). Una riga per (utente, asset), UNIQUE, aggiornata in place |
| `pension_comparisons` | user_id (PK), params (jsonb), updated_at | Dati inseriti in `/fondo-pensione`, una riga per utente (vedi sezione "Confronto fondo pensione") |
| `dismissed_duplicates` | transaction_a, transaction_b (FK→transactions, ON DELETE CASCADE, `a < b`) | Coppie confermate come "non doppioni" dal controllo doppioni di `/transazioni`; UNIQUE (user_id, a, b) |
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

**Controvalore**: sempre `quantità × prezzo / assets.price_divisor`. Il divisore vale 1 per azioni/ETF e 100 per i titoli quotati in percentuale del nominale (obbligazioni), dove la "quantità" Fineco è il valore nominale. Migrazione DB: `supabase/migrate_investments_bond_quotation.sql`.

**Quale prezzo viene usato** (`InvestmentPosition.price_origin`), in ordine di precedenza:
1. `market` — ultimo `price_snapshot` scritto dal cron;
2. `manual` — riga in `manual_prices`, inserita dall'utente per le posizioni senza quotazione automatica;
3. `cost` — nessuno dei due: la posizione è valorizzata al costo di carico, non a zero (a zero sparirebbe dal totale mostrando una perdita del 100% mai avvenuta).

Lo snapshot di mercato vince sul manuale perché è automatico e fresco: un prezzo scritto a mano mesi fa e dimenticato non deve coprire il dato reale quando questo esiste. Il prezzo manuale va inserito **nella stessa unità del prezzo di mercato**: per i titoli quotati in percentuale del nominale è la percentuale (es. 96,44), non il controvalore — al resto pensa `price_divisor`. Migrazione DB: `supabase/migrate_investments_manual_prices.sql`.

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
│   ├── fondo-pensione/page.tsx     # Form dati, KPI di confronto, classifica categoria, simulazione, tabelle COVIP
│   ├── investimenti/page.tsx       # Header card, allocazione, tabella posizioni a tab (ETF/Azioni/Obbligazioni/Altro), modal prezzo manuale, import CSV
│   └── settings/page.tsx           # Preferenze + export + danger zone
├── components/
│   ├── DashboardLayout.tsx         # Sidebar + "Nuovo movimento" (desktop), header + barra in basso + foglio "Altro" (mobile), tasto N
│   ├── Providers.tsx               # QueryClientProvider + ThemeProvider + ToastProvider
│   ├── Toast.tsx                   # ToastContext + ToastProvider + useToast
│   ├── NotificationBell.tsx        # Bell con badge, popover; unisce computed + DB notifications
│   ├── MonthSwitcher.tsx           # "‹ Ottobre 2026 ›" + selettore a griglia, legge/scrive ?m= via useSelectedMonth
│   ├── QuickAddSheet.tsx           # Inserimento rapido dal "+" (importo, categorie più usate, data, metodo)
│   ├── ImportCSVModal.tsx          # Drag-drop CSV, preview, bulk insert
│   ├── ui/                         # Componenti base: Modal, Section, Card, Button, KpiTile, Skeleton, EmptyState, SwipeRow
│   ├── SpendingGroupsPanel.tsx     # Impostazioni: gruppo Kakebo di ogni categoria di spesa
│   ├── pension/                    # PensionCharts (classifica a barre con linee di riferimento, simulazione), format.ts
│   └── dashboard/                  # Blocchi della dashboard mensile: BalanceHero, SpendingPlanSection, CategoryBreakdownSection, IncomeSplitSection, AiInsightsSection, InstallmentPlansSummary, RecurringExpensesBox, CategoryExpensesModal
├── hooks/
│   ├── useAuth.ts                  # user, loading, signOut, isAuthenticated
│   ├── useSettings.ts              # useSettings, useUpdateSettings, useCompleteOnboarding
│   ├── useCategories.ts            # useIncomeCategories, useExpenseCategories, useDeleteCategory, ecc.
│   ├── useTransactions.ts          # useTransactions, useCreateTransaction, useCreateInstallmentPlan, useConvertToInstallmentPlan, useUpdateTransaction, useDeleteTransaction, useDeleteInstallmentPlan, useMonthlyKPIs
│   ├── useInstallments.ts          # useInstallmentPlans, useSettleInstallmentPlanEarly, useCancelRemainingInstallments
│   ├── useRecurringExpenses.ts     # useRecurringExpenses, useCreateRecurringExpense, useUpdateRecurringExpense, useDeleteRecurringExpense, useEnsureCurrentMonthRecurring, useGenerateRecurringBackfill
│   ├── useDismissedDuplicates.ts   # useDismissedDuplicates, useDismissDuplicates, useRestoreDuplicates (coppie "non doppioni", fallback localStorage)
│   ├── useBudget.ts                # useMonthlyBudget, useEnsureMonthlyBudget, useUpsertBudgetItem, useActualAmountsByCategory
│   ├── useInvoices.ts              # useInvoices, useCreateInvoice, useUpdateInvoice, useMarkAsPaid, useDeleteInvoice
│   ├── useGoals.ts                 # useGoals, useCreateGoal, useUpdateGoal, useAddGoalProgress, useCompleteGoal, useDeleteGoal
│   ├── useAnnualData.ts            # useAnnualData (fetch anno intero, aggrega per mese)
│   ├── useImportTransactions.ts    # parseCSV + useImportTransactions (bulk insert)
│   ├── useNotifications.ts         # Notifiche computed in-memory + usePersistedNotifications + useMarkNotificationRead
│   ├── useInvestments.ts           # useInvestments (summary), useImportCsv
│   ├── usePensionComparison.ts     # usePensionComparison, useSavePensionComparison (dati /fondo-pensione, fallback localStorage)
│   ├── useModalA11y.ts             # Esc, focus trap, [data-autofocus], blocco scroll, ripristino focus (usato da ui/Modal)
│   ├── useSelectedMonth.ts         # Mese condiviso dashboard/transazioni nell'URL (?m=YYYY-MM)
│   └── useHorizontalSwipe.ts       # Swipe orizzontale per cambiare mese (dashboard)
└── lib/
    ├── supabase.ts                 # createBrowserClient() — client singleton lato browser
    ├── supabase-server.ts          # createServerClient() — client lato server (cookies)
    ├── queryClient.ts              # QueryClient config (staleTime 5min, retry 1, no refocus)
    ├── utils.ts                    # formatCurrency, formatDate, formatMonth, getMonthDateRange, classNames
    ├── kakebo.ts                   # computeSpendingPlan (portamonete del mese), expenseGroup, monthWeeks, isCashMethod (logica pura)
    ├── duplicates.ts               # findPossibleDuplicates (doppioni per importo/descrizione), dayBandIndexes (colori alternati per giorno)
    ├── pension/compare.ts          # Confronto fondo pensione: dati COVIP (pension/data/*.json), proiezione, pareggio (logica pura)
    ├── installments.ts             # buildInstallmentPlans, findImportedInstallmentDuplicates, soglie PayPal (logica pura rate)
    ├── investments/parseFinecoCsv.ts # Parser CSV Fineco: separatore/codifica/riga header auto-rilevati, colonne per significato, dedup ISIN, valuta e fattore di quotazione per posizione
    ├── investments/resolveTicker.ts   # Deriva ticker_gf/ticker_yahoo da Simbolo + Mercato del CSV (solo mercati mappati)
    ├── investments/classifyAsset.ts   # Classe dell'asset dedotta da tipo + nome del CSV quando il lookup non copre l'ISIN
    └── prices/                     # PriceProvider: googleSheets.ts (Sheet ponte), yahoo.ts + yahooChart.ts (due canali Yahoo in cascata), resolveQuote.ts, fx.ts (cambi valuta)
```

### Pagina investimenti: tab per tipo di strumento

La tabella posizioni è divisa in tab come il portafoglio Fineco: **Tutte**, **ETF**, **Azioni**, **Obbligazioni**, **Altro** (`cash` + `other`). Un tab senza posizioni non viene mostrato. Dentro **ETF** le righe restano raggruppate per sotto-classe (azionari / obbligazionari / tematici): il tab unico serve a rispondere a "quanto ho in ETF", il raggruppamento a non confondere un ETF obbligazionario con uno azionario.

Ogni tab mostra i propri totali (controvalore, P&L, peso sul portafoglio) calcolati **sui valori convertiti** in valuta di riferimento, con le posizioni prive di cambio escluse — stessa regola dei totali di portafoglio.

### Prezzi manuali: promemoria e aggiornamento in blocco

Le posizioni con `price_origin` diverso da `market` espongono un pulsante *inserisci* / *aggiorna* nella colonna del prezzo. Sopra i totali compare inoltre un banner che le riassume:

- **ambra + "Aggiorna prezzi"** quando almeno una non ha prezzo o ce l'ha più vecchio di `MANUAL_PRICE_STALE_DAYS` (30 giorni);
- **neutro** quando sono tutte aggiornate, con l'età del prezzo più vecchio.

Entrambi i percorsi aprono lo stesso componente, `ManualPricesPanel`: riceve una lista di posizioni — una sola dalla riga, tutte quelle da rinfrescare dal banner. Il pannello genera una **query pronta da copiare** con gli ISIN, che chiede esplicitamente prezzo, valuta, data e unità di quotazione (un numero nudo non sarebbe verificabile né inseribile senza ambiguità); si compilano i campi, si scelgono data e fonte comuni, e si salva tutto in un unico upsert. Le righe lasciate vuote non vengono toccate: in un giro su nove titoli è normale non recuperarli tutti.

Hook: `useSetManualPrices` (input sempre array, anche per una riga sola) e `useDeleteManualPrice` in `useInvestments.ts`, che scrivono via client browser — tabella per-utente protetta da RLS, nessuna API route di mezzo.

```
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
['dismissed_duplicates']
['investments_summary']
['pension_comparison']
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
`<ToastProvider>` sta in `Providers.tsx` (radice dell'app), quindi `useToast` funziona ovunque, anche nel corpo di una pagina sopra `DashboardLayout`. Fino a ottobre 2026 il provider era dentro il layout e i toast chiamati dalle pagine finivano nel no-op di default.

### Navigazione e UI condivisa

- **Mobile** (sotto `lg`): header da 56px con logo, selettore del mese (su dashboard e transazioni) o titolo della pagina, campanella. In basso una barra con Home, Movimenti, "+" (inserimento rapido), Investimenti, Altro (foglio con le altre sezioni ed Esci). Il contenuto ha `pb-tabbar` (utility in `globals.css`).
- **Desktop**: sidebar con il pulsante "Nuovo movimento" in cima. Tasto **N** (fuori dai campi di testo) apre l'inserimento rapido ovunque, **/** porta il cursore nella ricerca di `/transazioni`.
- **Mese selezionato**: dashboard mensile e transazioni lo leggono da `useSelectedMonth()`, salvato nell'URL come `?m=YYYY-MM` (assente = mese corrente). I link di navigazione verso queste due pagine se lo portano dietro. Su mobile la dashboard cambia mese anche con lo swipe orizzontale (`data-no-swipe` esclude un elemento, es. i grafici).
- **Modali**: usare sempre `Modal` da `@/components/ui` (bottom sheet su mobile, finestra centrata da `sm`). `dismissOnBackdrop={false}` nei form, per non perdere quanto scritto con un tocco fuori. Un campo con `data-autofocus` riceve il focus all'apertura.
- **Inserimento rapido** (`QuickAddSheet`): importo per primo (`inputMode="decimal"`, accetta `1.234,56`), categorie ordinate per uso nel mese, data di oggi, ultimo metodo di pagamento (in `localStorage`). Rate, ricorrenze ed eccezionali restano nel form completo: "Più opzioni" apre `/transazioni?nuova=1&...` precompilato (o manda un evento se la pagina è già aperta).
- **Importi**: tutti i campi numerici hanno `inputMode` (`decimal` o `numeric`). Il `body` usa cifre tabulari e il font di sistema (stack `font-sans` di Tailwind).
- **Dashboard mensile**, dall'alto: `BalanceHero` (saldo disponibile + curva del mese), entrate/spese/risparmi, griglia degli indicatori secondari, poi `Section` richiudibili (stato aperto/chiuso in `localStorage` per browser), la prima è il portamonete del mese.

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

### Portamonete del mese (metodo Kakebo)

Sezione `SpendingPlanSection` della dashboard mensile, calcolo in `computeSpendingPlan()` (`src/lib/kakebo.ts`, testato in `tests/kakebo/`). Idea presa dal Kakebo: a inizio mese entrate − uscite fisse = denaro per le spese variabili.

- **Gruppi**: ogni categoria di spesa ha `spending_group`. `expenseGroup()` decide il gruppo di una spesa: ricorrenze (`recurring_expense_id`/`is_recurring`) e rate (`installment_plan_id`) sono sempre `fixed`; altrimenti vale il gruppo della categoria; senza gruppo, un eccezionale va in `extra` e un ordinario resta "da classificare" (conta come variabile, fuori dalla ripartizione). Il gruppo si sceglie in Impostazioni (`SpendingGroupsPanel`, ancora `#gruppi-spesa`). Granularità a livello di categoria, non di sottocategoria.
- **Budget variabile** = entrate − uscite fisse − risparmi − debiti. Entrate = le stesse del saldo netto (stima storica + eccezionali finché lo stipendio non è registrato). Uscite fisse = fisse registrate nel mese (anche con data futura, es. rate) + modelli ricorrenti attivi senza occorrenza nel mese (`plannedFixed`, ignorati nei mesi passati).
- **Residuo e ritmo**: `remaining` = budget − spese variabili; nel mese corrente `perDayLeft` = residuo / giorni rimasti, oggi incluso.
- **Settimane**: da lunedì a domenica, tagliate ai confini del mese (`monthWeeks()`); la quota di ogni settimana è il budget in proporzione ai giorni. Il Kakebo assegna le settimane a cavallo a un solo mese: scartato per restare allineati all'estratto conto.
- **Contanti/carte**: `isCashMethod()` riconosce i contanti dal nome del metodo (`contant`/`cash`), tutto il resto è "carte e altri metodi".
- Dati: `useMonthlyKPIs` espone `expenseRows` (spese del mese con i campi necessari); nessuna query in più oltre a `useRecurringExpenses`.
- Migrazione DB: `supabase/migrate_spending_groups.sql` (colonna + valori iniziali per le categorie di default); `seed_categories.sql` crea le categorie nuove con il gruppo già valorizzato.

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

## Lista transazioni: colori per giorno e possibili doppioni

- Le righe alternano due sfondi a ogni **cambio di data** tra righe consecutive (`dayBandIndexes()` in `src/lib/duplicates.ts`), non a ogni giorno di calendario: due giorni con movimenti separati da un giorno vuoto hanno colori diversi. L'indice è calcolato sull'elenco filtrato intero, così la sequenza continua tra una pagina e l'altra.
- Sopra la lista compare un banner ambra con i **possibili doppioni** del mese caricato (`findPossibleDuplicates()`, prima dei filtri client-side). Criteri, stesso tipo di transazione: stesso importo (scarto ≤1%) a ≤1 giorno di distanza; oppure descrizione simile (Jaccard ≥0,6 sulle parole significative, esclusi numeri e parole da estratto conto come "pagamento", "pos") con importo entro il 10% e ≤3 giorni. Le rate dello stesso piano PayPal sono escluse. Ogni coppia ha una spunta "Non è un doppione"; il tasto **Conferma** salva le coppie spuntate in `dismissed_duplicates` e da quel momento non compaiono più. Sotto il banner, "Ripristina" riporta in elenco le coppie del mese già confermate. Hook in `src/hooks/useDismissedDuplicates.ts`: se la tabella non esiste ancora (migrazione non eseguita) ripiegano su `localStorage` e il banner lo segnala; dopo la migrazione le conferme locali vengono copiate nel DB al primo caricamento. Migrazione DB: `supabase/migrate_dismissed_duplicates.sql`. Limite: il controllo lavora sul mese selezionato, una coppia a cavallo di due mesi (31 → 1) non viene vista.
- La lista è **raggruppata per giorno**: ogni gruppo ha un'intestazione fissa in alto durante lo scroll con il totale del giorno (entrate in positivo, il resto in negativo), calcolato sull'intero elenco filtrato così un giorno spezzato tra due pagine mostra lo stesso totale. Ha sostituito le bande di colore alternate: `dayBandIndexes()` in `src/lib/duplicates.ts` resta (testata) ma la UI non la usa più.
- Filtri dietro il pulsante "Filtri" (badge con il numero di filtri attivi); quelli attivi compaiono come chip rimovibili sotto la ricerca.
- Su touch una riga si scorre a sinistra per Modifica/Elimina (`SwipeRow`, una aperta alla volta); su desktop le icone restano visibili. Toccare la riga apre la modifica.
- Sopra la lista compare un banner ambra con i **possibili doppioni** del mese caricato (`findPossibleDuplicates()`, prima dei filtri client-side). Criteri, stesso tipo di transazione: stesso importo (scarto ≤1%) a ≤1 giorno di distanza; oppure descrizione simile (Jaccard ≥0,6 sulle parole significative, esclusi numeri e parole da estratto conto come "pagamento", "pos") con importo entro il 10% e ≤3 giorni. Le rate dello stesso piano PayPal sono escluse. "Non è un doppione" salva la coppia in `localStorage` (preferenza del solo browser corrente). Limite: il controllo lavora sul mese selezionato, una coppia a cavallo di due mesi (31 → 1) non viene vista.

## Spese a rate (PayPal "Paga in 3 rate")

Nel form transazioni (`transazioni/page.tsx`), per ogni spesa compare sempre il toggle **"Paga in 3 rate con PayPal"**: attivarlo imposta come metodo di pagamento il primo metodo dell'utente che contiene "paypal" (case-insensitive, vedi `isPaypalMethod()` in `utils.ts`), o `PayPal` se l'elenco non ne ha. Il piano si crea solo se al salvataggio il metodo è ancora PayPal: cambiandolo, il toggle si spegne. Prima era visibile solo dopo aver scelto PayPal e passava inosservato.

- L'importo inserito è il **totale** dell'acquisto. `splitInstallments()` lo divide in `PAYPAL_INSTALLMENT_COUNT` (3) rate arrotondate al centesimo, con l'eventuale resto sulla prima rata.
- `installmentDates()` calcola le date delle rate successive: stesso giorno del mese, mese per mese (`addMonthsClamped()`), con clamp all'ultimo giorno se il mese di destinazione è più corto.
- `useCreateInstallmentPlan()` (in `useTransactions.ts`) inserisce le N rate come normali righe in `transactions`, tutte con lo stesso `installment_plan_id` (un nuovo UUID) e `installment_number` / `installment_count` valorizzati. Non c'è una tabella separata: ogni rata è una transazione a sé, quindi pesa su KPI/budget del proprio mese fin da subito (anche le rate future, non ancora addebitate).
- Una rata è considerata **addebitata** quando `date <= oggi`, **programmata** altrimenti — calcolato lato client in `useInstallmentPlans()` (`useInstallments.ts`), non c'è un flag nel DB.
- `useInstallmentPlans(month, year)` ricostruisce i piani che toccano il mese richiesto in due passi (id dei piani con una rata nel mese → tutte le rate di quei piani, senza finestre di mesi fisse); il calcolo è in `buildInstallmentPlans()` (`src/lib/installments.ts`, testato). Usata nella sezione "💳 Spese PayPal a rate" della dashboard mensile per mostrare stato (`programmato` / `in_corso` / `completato`), rate addebitate/residue, prossima rata e importo totale. Il numero di rate previsto viene da `installment_count`, non dalle righe presenti: una rata eliminata compare come `missingCount` invece di far sembrare il piano chiuso a 2/2.
- **Azioni sulle rate residue** (dashboard, con conferma a doppio tap, e modal elimina in `/transazioni`): *Salda ora* (`useSettleInstallmentPlanEarly`) sposta a oggi le rate non ancora addebitate, come il pagamento anticipato di PayPal; *Annulla residue* (`useCancelRemainingInstallments`) cancella solo le rate future (reso/rimborso), lasciando nello storico quelle già pagate.
- **Conversione**: modificando una spesa PayPal singola, il toggle diventa "Converti in 3 rate" (`useConvertToInstallmentPlan`): la riga esistente diventa la rata 1, le altre vengono inserite prima dell'update e rimosse se l'update fallisce (nessun piano a metà).
- **Salvataggio del form**: il form è `noValidate` e valida categoria/importo/data in `handleSubmit` con toast espliciti (il fumetto nativo finiva fuori schermo nel modal su mobile e il salvataggio sembrava non partire). Una categoria disattivata resta selezionabile come "Categoria non più attiva". Se mancano le colonne `installment_*` il toast rimanda a `migrate_paypal_installments.sql`. L'id del piano usa `crypto.randomUUID` con ripiego su `getRandomValues`.
- Importo minimo: almeno un centesimo per rata. Fuori da `PAYPAL_INSTALLMENT_MIN`/`MAX` (30–2.000 €, soglie commerciali PayPal da ricontrollare periodicamente) il form mostra solo un avviso, non blocca.
- Modifica: editare una rata (`transazioni/page.tsx`) modifica solo quella riga, non l'intero piano; tipo (sempre spesa) e toggle "ricorrente" sono bloccati sulle rate.
- Eliminazione: il modal di conferma elimina offre "solo questa rata" (`useDeleteTransaction`), "annulla le rate non ancora addebitate" o "tutte le rate" (`useDeleteInstallmentPlan`, cancella per `installment_plan_id`).
- **Import CSV**: una rata già registrata ricompare nell'estratto conto con descrizione diversa e qualche giorno di scarto; `findImportedInstallmentDuplicates()` la salta come duplicata (stesso tipo, stesso importo al centesimo, data entro `INSTALLMENT_IMPORT_TOLERANCE_DAYS` = 3 giorni, una riga importata per rata).
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

## Confronto fondo pensione (`/fondo-pensione`)

Confronta il comparto del fondo pensione dell'utente con le medie COVIP e con le linee dei principali fondi aperti, e simula il capitale finale restando o spostandosi in un fondo aperto.

- **Logica**: `src/lib/pension/compare.ts`, pura e testata in `tests/pension/` (i casi di `simulate` sono confrontati con i risultati dello strumento HTML originale da cui la pagina deriva). Proiezione `m(i) = m(i-1) × (1 + r) + C` con versamento a fine anno; rendimento di pareggio per bisezione tra −10% e 30%.
- **Rendimento usato**: quello a 10 anni, altrimenti a 5 (`comparisonPeriod`); classifica e medie COVIP usano lo stesso periodo. I due comparti obbligazionari condividono l'ISC medio COVIP (`OBB`).
- **Contributi**: lavoratore + datore + TFR (`TFR_RATE` = 6,91% della retribuzione utile × quota versata). Nel fondo aperto il contributo del datore conta solo con "il contributo del datore segue" attivo.
- **Dati di riferimento**: `src/lib/pension/data/*.json` (`fondi_aperti`, `covip_rendimenti`, `covip_isc`), importati staticamente. COVIP pubblica i rendimenti annuali di solito a giugno; le linee dei fondi aperti vengono dalle schede ciaoelsa.com su dati COVIP (lette il 01/11/2026). Aggiornando i JSON vanno aggiornate le date "31/12/2025" nei testi della pagina.
- **Dati utente**: tabella `pension_comparisons` (una riga per utente, `params` jsonb letto con `normalizeParams`), hook `usePensionComparison` / `useSavePensionComparison`. Ogni campo si salva all'uscita (blur), con aggiornamento ottimistico della cache. Senza migrazione ripiega su `localStorage` (`smartbudget:pension-comparison`); alla prima lettura riprende anche i dati della vecchia versione in iframe (`fp-confronto-params`). Migrazione DB: `supabase/migrate_pension_comparison.sql`.
- **Importi** sempre in euro (`src/components/pension/format.ts`), indipendenti da `settings.currency`: i fondi sono italiani.
- **Limiti del calcolo**: rendimento e contributi costanti, esclusi spese fisse annue, aumenti di stipendio e tassazione finale.

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

**Vitest** (`npm test`): copre `src/lib/investments/parseFinecoCsv.ts`, `src/lib/prices/*` (`tests/investments/*.test.ts`) la logica delle spese a rate (`src/lib/installments.ts` + helper in `utils.ts`, `tests/installments/*.test.ts`) il rilevamento doppioni (`src/lib/duplicates.ts`, `tests/duplicates/*.test.ts`) e il portamonete Kakebo (`src/lib/kakebo.ts`, `tests/kakebo/*.test.ts`) e il confronto fondo pensione (`src/lib/pension/compare.ts`, `tests/pension/*.test.ts`); niente altro nel repo ha test — verificare il resto delle feature manualmente. Niente jest/playwright.

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

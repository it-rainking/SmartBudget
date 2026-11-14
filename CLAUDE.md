# CLAUDE.md — SmartBudget

Gestione finanze personali (privati, coppie, famiglie, autonomi). UI in italiano (i18n inglese in roadmap).
**Dettagli per feature (schema DB completo, rate PayPal, Kakebo, investimenti/FX, fondo pensione, import CSV, doppioni): `docs/ARCHITETTURA.md`** — leggere la sezione pertinente prima di toccare quella feature.

## Stack

Next.js 16.0.3 (App Router, Turbopack) · React 19.2 + Tailwind 4 · Supabase 2.84 (Postgres + Auth + RLS) · `@supabase/ssr` 0.7 · React Query 5.90 · Chart.js 4.5 + react-chartjs-2 5.3 · TypeScript strict · Vitest.

## Routing

Pubbliche: `/login`, `/signup`, `/recupera-password`, `/aggiorna-password`, `/auth/callback`.
Protette (middleware → `/login`): `/onboarding`, `/dashboard/mensile`, `/dashboard/annuale`, `/transazioni`, `/spese-ricorrenti`, `/obiettivi`, `/investimenti`, `/fondo-pensione`, `/istruzioni`, `/settings`.
Codice mantenuto ma **non linkate in sidebar**: `/budget`, `/fatture`, `/debiti`.

API (`src/app/api/`): `account/delete`, `notifications/{send,process,test}`, `ai/{categorize,insights,simplify-categories}`, `investments/{import,summary,tickers}`, `cron/prices`, `health` (espone `commit_short`).
Il middleware (`src/middleware.ts`) rinnova la sessione con `getClaims()`, non gira su `/api/*` (ogni route verifica l'utente) né sugli statici.

## Database (Supabase)

RLS su tutte le tabelle con `user_id = auth.uid()`. Tabelle globali (non per-utente): `isin_ticker_lookup`, `fx_rates`.
Principali: `profiles`, `settings`, `{income,expense,saving}_categories`, `expense_subcategories`, `transactions`, `recurring_expenses`, `invoices`, `goals`, `debt_items`, `monthly_budgets(+_items)`, `notifications`, `assets`, `holdings`, `price_snapshots`, `manual_prices`, `pension_comparisons`, `dismissed_duplicates`. Colonne chiave e note: `docs/ARCHITETTURA.md`.
RPC: `get_balance_flow_before(p_date)`, `create_default_categories(p_user_id)`, `get_investment_summary(p_user_id)`.
Migrazioni in `supabase/` (`migrate_*.sql`, anche riflesse in `schema.sql`/`rls_policies.sql`).

**Supabase 2.84**: ogni tabella del tipo `Database` richiede `Relationships: []` (anche vuota); FK dichiarate con `foreignKeyName`, `columns`, `isOneToOne`, `referencedRelation`, `referencedColumns`; lo schema `public` deve avere `Views`, `Enums`, `CompositeTypes`.

## Struttura

```
src/app/        pagine (App Router) + api/
src/components/ DashboardLayout, Providers, Toast, NotificationBell, MonthSwitcher, QuickAddSheet,
                ImportCSVModal, ui/ (Modal, Section, Card, Button, KpiTile, ...), charts/, dashboard/, pension/
src/hooks/      un hook React Query per dominio (useTransactions, useRecurringExpenses, useInvestments, ...)
src/lib/        supabase(.ts|-server.ts), utils, kakebo, duplicates, installments, pension/, investments/, prices/,
                ai/ (facts.ts: fatti calcolati per /api/ai/insights; claude.ts: client Anthropic con tool use)
src/types/      database.ts (Supabase), index.ts (dominio), investments.ts
tests/          vitest: investments, installments, duplicates, kakebo, pension
```

## Convenzioni

- **Data fetching**: solo React Query (`staleTime` 5 min, `retry` 1, no refocus). Chiavi: `['transactions', {month, year, ...}]`, `['monthly_kpis', m, y]`, `['annual_data', y]`, `['settings']`, `['recurring_expenses']`, `['investments_summary']`, ecc. Mutation → `invalidateQueries` in `onSuccess`.
- **Toast**: `useToast().showToast(msg, 'success'|'error'|'info')` (provider in `Providers.tsx`, funziona ovunque).
- **Valuta**: `formatCurrency(n, settings?.currency || 'EUR')`.
- **Date**: `date.split('-')` su stringhe `YYYY-MM-DD`, mai `new Date(date)` (problemi fuso). `getMonthDateRange(month, year)` in `utils.ts`.
- **Client Supabase**: browser `@/lib/supabase` (singleton), server `@/lib/supabase-server` (API route, middleware). Alias `@/*` → `src/*`.
- **Modali**: sempre `Modal` da `@/components/ui` (`dismissOnBackdrop={false}` nei form, `data-autofocus` per il focus iniziale).
- **Grafici**: importare `Line`/`Bar`/`Doughnut` da `@/components/charts/LazyCharts`, mai da `react-chartjs-2`. Modali pesanti con `next/dynamic`.
- **Input numerici**: sempre con `inputMode` (`decimal`/`numeric`). Font di sistema (`font-sans`), niente Google Fonts.
- **Mobile-first**: sotto `lg` header + barra in basso (`pb-tabbar`); mese selezionato in URL `?m=YYYY-MM` (`useSelectedMonth`); `?rapido=1` apre l'inserimento rapido.
- **Notifiche**: computed (`useNotifications`, in-memory) + persistite (tabella `notifications`), unite e deduplicate in `NotificationBell`.

## Regole di dominio (non ovvie)

- **Eccezionali** (`is_exceptional`): contano nei totali reali, **esclusi** da trend/medie/budget/alert/insight AI (serie `ordinary*`).
- **Saldo netto vs disponibile**: `balance` = flusso del mese (può usare stime di stipendio); `openingBalance/closingBalance/dailyBalances` = stock reale da `initial_balance`, **mai** basato su stime.
- **Rate PayPal**: ogni rata è una normale riga in `transactions` (stesso `installment_plan_id`); "addebitata" = `date <= oggi`, calcolato lato client. Il numero di rate viene da `installment_count`.
- **Spese ricorrenti**: modello in `recurring_expenses`; le occorrenze sono righe `transactions` con `recurring_expense_id`. Generazione idempotente (`useEnsureCurrentMonthRecurring`, backfill fino a 24 mesi). Eliminare un modello non tocca lo storico.
- **Portamonete Kakebo**: logica pura in `src/lib/kakebo.ts` (budget variabile = entrate − fisse − risparmi − debiti).
- **Investimenti**: controvalore = `quantità × prezzo / price_divisor`; prezzo con precedenza `market` > `manual` > `cost`; posizioni in valuta senza cambio **escluse** dai totali, mai sommare valute diverse. `holdings` sostituite integralmente a ogni import CSV.
- **Invoice status**: `overdue` calcolato lato client (`applyDynamicStatus`).
- **Import CSV/OFX**: categorie risolte per nome case-insensitive; senza match → "Non categorizzato" (spese) o badge ⚠️ in anteprima.
- **AI**: il codice calcola i fatti (`src/lib/ai/facts.ts`, testati), Claude li sceglie e li formula (tool use, mai numeri inventati). Le route leggono i dati da sé (il client invia solo mese/anno). Modelli: `ANTHROPIC_MODEL` (default Sonnet 5.5), `ANTHROPIC_MODEL_SMALL` (categorize, default Haiku 5.5). `categorize` risolve prima dallo storico dell'utente.
- **Fondo pensione**: logica pura in `src/lib/pension/compare.ts`; importi sempre in euro; dati COVIP in `src/lib/pension/data/*.json`.

## Agenti consigliati

- **vibe-dev**: nuove feature, fix bug
- **code-reviewer**: pre-deploy, audit RLS e sicurezza
- **Plan**: decisioni architetturali Phase 7+
- **railway-ops**: deploy/crash su Railway
- **my-library**: verificare riuso da `TutteLeMieFunzioni/` prima di scrivere nuove funzioni

## Build e deploy

- `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (gitignored). Server (non in `.env.example`): `ANTHROPIC_API_KEY` (route `/api/ai/*`), `CRON_SECRET`, `GSHEET_ID` (opzionale), chiavi Resend/Telegram per le notifiche.
- Scripts: `npm run dev | build | start | lint | test` (vitest, copre solo logica pura in `src/lib/`; il resto va verificato a mano).
- Warning `baseline-browser-mapping` e `middleware → proxy`: non bloccanti.
- **Deploy**: Railway (`railway.toml`: build `npm run build`, start `npm run start`, healthcheck `/`). Verifica allineamento con `GET /api/health` → `commit_short`. Dettagli in `DEPLOY.md`.
- **Cron**: `/api/cron/prices` e `/api/notifications/process` sono POST con `CRON_SECRET`; `vercel.json` è inerte su Railway, lo scheduler è in `.github/workflows/cron-*.yml` (secret `APP_URL`, `CRON_SECRET`).

## Stato

Phase 0–6 ✅ · 7 (UX/bug fix) 🔄 · 8 (notifiche email/Telegram) 🔄 · 9 (OFX + AI) 📋 · 10 (i18n, multi-account) 🔮 · 11 (investimenti) 🔄 richiede setup manuale (`docs/investimenti-setup.md`).
Bug noto: dismiss delle notifiche computed non persiste al refresh. Backlog: aggregazione annuale lato SQL (`useAnnualData.ts`).

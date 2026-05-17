# CLAUDE.md -- SmartBudget

## Panoramica Progetto

**SmartBudget** - Piattaforma completa per la gestione delle finanze personali.

- **Web App** (core): Next.js + React + Supabase
- **Template Excel** (complementare/asset a valore aggiunto)
- **Target**: Privati, coppie, famiglie, lavoratori autonomi
- **Lingue**: Italiano (v1), Inglese in roadmap (i18n-ready)

---

## Tech Stack

### Frontend
- Next.js, React, TailwindCSS, Chart.js, React Query

### Backend
- Supabase (DB PostgreSQL + Auth + RLS + API)

### Routing Principale
```
/login, /signup, /onboarding
/dashboard/mensile, /dashboard/annuale
/budget, /transazioni, /fatture, /obiettivi, /settings
```

---

## Database Schema (Supabase/Postgres)

Tabelle principali (tutte con RLS user_id-based):

| Tabella | Descrizione |
|---------|-------------|
| `users` | Utenti registrati |
| `settings` | Impostazioni utente |
| `income_categories` | Categorie reddito |
| `expense_categories` | Categorie spese (macro) |
| `expense_subcategories` | Sottocategorie spese |
| `saving_categories` | Categorie risparmi |
| `debt_items` | Voci debiti |
| `monthly_budgets` | Budget mensili |
| `monthly_budget_items` | Voci budget mensile |
| `transactions` | Transazioni |
| `invoices` | Fatture/abbonamenti |
| `goals` | Obiettivi finanziari |
| `notifications` | Notifiche (v2) |

---

## Moduli Funzionali Core

- **Onboarding**: Saldo iniziale, categorie iniziali, primo mese budget
- **Category Management**: CRUD categorie reddito/spese/risparmi/debiti, icone personalizzabili
- **Monthly Budget**: Budget previsto vs effettivo, KPI, % raggiungimento
- **Transactions**: CRUD con filtri per mese/categoria/metodo pagamento
- **Bills Monitoring**: Fatture con scadenza, periodicita, stati (Pagata/In scadenza/Scaduta), calendario
- **Monthly Dashboard**: KPI (% reddito/spese/risparmi), grafici donut e bar chart
- **Annual Dashboard**: Entrate/spese/saldo per mese, trend, grafico 12 mesi
- **Goals**: Obiettivi risparmio/riduzione debiti, progresso %, timeline
- **Notifications (v2)**: Superamento budget, fatture in scadenza, canali Email/Telegram
- **Import/Export**: CSV/XLS (v1), Import CSV/OFX (v2), PSD2 (v3)
- **Security**: Supabase Auth, RLS, GDPR export/delete, HTTPS

---

## Excel Architecture

### Fogli
1. Settings, 2. Transazioni, 3. Budget, 4. Dashboard Mensile, 5. Dashboard Annuale, 6. Fatture + Calendario, 7. Obiettivi

### Funzioni Principali
SUMIFS, XLOOKUP, INDIRECT, Tabelle Pivot, Formattazione condizionale

### Macro Opzionali
Duplicazione mese, Reset anno, Backup

---

## Roadmap e Backlog

| Fase | Descrizione | Stato |
|------|-------------|-------|
| Phase 0 | Setup (Repo, Supabase, Next.js + Tailwind) | Completato |
| Phase 1 | Auth + DB (Schema, RLS, API Auth) | Completato |
| Phase 2 | Budget & Transactions (UI, CRUD, KPI) | Da fare |
| Phase 3 | Monthly Dashboard (Grafici, KPI) | Da fare |
| Phase 4 | Bills + Calendar | Da fare |
| Phase 5 | Annual Dashboard + Goals | Da fare |
| Phase 6 | Import CSV + Notifications | Da fare |

**Totale Story Points**: 83 (schema Fibonacci 1-2-3-5-8)

---

## Struttura Cartelle

```
/src
  /app          # Next.js App Router
  /components   # Componenti React riutilizzabili
  /lib          # Utilities, Supabase client
  /hooks        # Custom React hooks
  /types        # TypeScript types
  /styles       # Tailwind config, global styles
```

### Naming Conventions
- **Componenti**: PascalCase (`BudgetCard.tsx`)
- **Hooks**: camelCase con prefisso `use` (`useBudget.ts`)
- **Utilities**: camelCase (`formatCurrency.ts`)
- **DB Tables**: snake_case (`monthly_budgets`)

---

## NFR (Non-Functional Requirements)

| Requisito | Target |
|-----------|--------|
| Caricamento dashboard | < 1.5s |
| UI | Responsive (desktop + mobile) |
| Uptime | 99% |
| Backup | Automatici Supabase |
| Compliance | GDPR-ready |

---

## Evoluzioni Future (v2-v3+)

- Auto-categorizzazione transazioni e AI insights
- Collegamento PSD2, multi-account
- Modulo investimenti (Azioni/ETF/Crypto)
- Debiti avanzati (Snowball/Avalanche)
- Envelope system, regole automatiche
- Report PDF, sync Google Sheets
- Budget condivisi, ruoli Viewer/Editor
- Gamification (badge, missioni)
- Mobile app Flutter con OCR scontrini

---

## File di Riferimento

| File | Descrizione |
|------|-------------|
| `SMARTBUDGET -- TECH SPEC COMPLETA (V.3).txt` | Specifiche tecniche complete (IT) |
| `SmartBudget_TechSpec.md` | Tech spec markdown (EN) |
| `SmartBudget_TechSpec_Notion.md` | Tech spec per Notion (IT) |
| `SmartBudget_Kanban_Notion.csv` | Template Kanban per import Notion |

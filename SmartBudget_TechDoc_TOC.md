# SmartBudget – Documentazione Tecnica

## Indice

1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Moduli principali](#moduli-principali)
4. [Data Model](#data-model)
5. [Architettura Web](#architettura-web)
6. [Architettura Excel](#architettura-excel)
7. [Requisiti non funzionali](#requisiti-non-funzionali)
8. [Roadmap tecnica](#roadmap-tecnica)
9. [Evoluzioni future](#evoluzioni-future)

---

## Overview
SmartBudget è una piattaforma per la gestione delle finanze personali composta da:
- Web App (core)
- Template Excel avanzato (supporto / asset a valore aggiunto)

Obiettivi:
- Gestire budget, transazioni, risparmi, debiti e fatture
- Fornire dashboard mensili e annuali con grafici sintetici
- Supportare evoluzioni future (AI, integrazione bancaria, mobile)

## User Roles
- User (v1): utilizzo personale
- Admin (v2): gestione contenuti, piani, strumenti avanzati

## Moduli principali
- Onboarding
- Gestione categorie
- Budget mensile
- Transazioni
- Monitoraggio fatture
- Dashboard mensile
- Dashboard annuale
- Obiettivi (Goals)
- Notifiche (v2)
- Import/Export

## Data Model
Il modello dati è basato su Supabase/Postgres con tabelle:
- users, settings, income_categories, expense_categories, expense_subcategories
- saving_categories, debt_items, monthly_budgets, monthly_budget_items
- transactions, invoices, goals, notifications

Tutte le tabelle rispettano il principio multi-tenant grazie alle Row Level Security basate su user_id.

## Architettura Web
Frontend:
- Next.js, React, TailwindCSS, Chart.js, React Query

Backend:
- Supabase per DB, Auth, API e RLS

Routing di base:
- /login, /signup, /onboarding, /dashboard/mensile, /dashboard/annuale,
  /budget, /transazioni, /fatture, /obiettivi, /settings

## Architettura Excel
Fogli principali:
- Settings, Transazioni, Budget, Dashboard Mensile, Dashboard Annuale, Fatture + Calendario, Obiettivi

Funzioni chiave:
- SOMMA.PIÙ.SE, CERCA.X, INDIRETTO, Tabelle Pivot, Formattazione condizionale

## Requisiti non funzionali
- Dashboard caricata in < 1.5 secondi
- UI responsive
- GDPR-ready
- Backup automatici

## Roadmap tecnica
- Fase 0: Setup
- Fase 1: Auth + DB
- Fase 2: Budget + Transazioni
- Fase 3: Dashboard mensile
- Fase 4: Fatture + Calendario
- Fase 5: Dashboard annuale + Obiettivi
- Fase 6: Import CSV + Notifiche + UX

## Evoluzioni future
- Automazioni e AI
- Integrazione bancaria PSD2
- Modulo Investimenti
- Gestione avanzata debiti e risparmi
- Reporting avanzato
- Multi-utente
- Gamification
- Marketplace
- Mobile App
- Integrazioni esterne (YNAB, Notion, webhooks)

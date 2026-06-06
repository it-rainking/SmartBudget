# TODO — SmartBudget

Ultimo aggiornamento: 2026-06-06

---

## Stato Roadmap

| Fase | Descrizione | Stato |
|------|-------------|-------|
| Phase 0 | Setup repo, Supabase, Next.js + Tailwind | ✅ Completato |
| Phase 1 | Auth + DB (schema, RLS, onboarding) | ✅ Completato |
| Phase 2 | Budget & Transazioni (CRUD, KPI) | ✅ Completato |
| Phase 3 | Dashboard Mensile (grafici, KPI avanzati) | ✅ Completato |
| Phase 4 | Fatture + Calendario | ✅ Completato |
| Phase 5 | Dashboard Annuale + Obiettivi | ✅ Completato |
| Phase 6 | Import CSV + Notifiche in-app | ✅ Completato |
| Phase 7 | Miglioramenti UX + Bug fix | ✅ Completato |
| Phase 8 | Notifiche Email/Telegram (v2) | 🔄 In corso (API routes presenti) |
| Phase 9 | Import OFX + Auto-categorizzazione AI | 📋 Pianificato |
| Phase 10 | i18n (Inglese), Multi-account, Budget condivisi | 🔮 Futuro |

---

## Bug Noti

- [ ] **Notifiche dismiss non persiste**: le notifiche ricompaiono al refresh (stato in memoria, nessuna persistenza)
- [x] **Import CSV**: le transazioni importate non hanno `category_id` — ora assegna automaticamente "Non categorizzato" se la categoria esiste
- [x] **Calendario fatture**: fix overflow-x-auto + min-h ridotta a 40px su schermi < 360px
- [x] **Dashboard Mensile**: delta% mostra null (non NaN) — fix isNaN + isFinite guard
- [ ] **Budget**: la pagina non crea automaticamente il record `monthly_budgets` fino al primo salvataggio di un importo

---

## Miglioramenti UX (Phase 7)

### Alta priorità

- [x] **Categoria "Non categorizzato"**: import CSV ora assegna la categoria se presente
- [x] **Edit transazione**: modal modifica implementato
- [x] **Edit fattura**: modal modifica implementato
- [x] **Edit obiettivo**: modal modifica implementato
- [x] **Pagina istruzioni**: guida utente integrata nell'app (`/istruzioni`)
- [x] **Paginazione transazioni**: paginazione client-side 20 voci/pagina con Prev/Next
- [x] **Ricerca transazioni**: campo di ricerca per descrizione implementato

### Media priorità

- [x] **Dark mode toggle**: toggle manuale nelle impostazioni implementato
- [ ] **Onboarding**: aggiungere la gestione dei debiti iniziali al wizard
- [x] **Budget copia mese precedente**: pulsante implementato
- [ ] **Ricorrenza transazioni**: supporto a transazioni ricorrenti (is_recurring, recurring_id già presenti in DB)
- [x] **Grafici**: tooltip con % del totale nel donut chart già implementato
- [ ] **Fatture**: notifica via toast quando una fattura viene segnata come pagata con successo
- [x] **Obiettivi**: proiezione mensile già mostrata nelle card

### Bassa priorità

- [ ] **Statistiche**: aggiungere una sezione statistiche multi-anno (confronto anno su anno)
- [x] **Export CSV**: pulsante "Esporta transazioni (CSV)" in Settings implementato
- [x] **Shortcut tastiera**: Ctrl+N per nuova transazione, Esc per chiudere modal
- [x] **Filtro avanzato**: filtro per range importo e metodo di pagamento implementato

---

## Evolutive v2 (Phase 8-9)

### Notifiche Push / Email

- [ ] Aggiungere tabella `notifications` al DB (id, user_id, type, title, body, read_at, created_at)
- [ ] Persistere le notifiche nel DB invece che calcolarle in tempo reale
- [ ] Integrazione email via Supabase Edge Functions + Resend/SendGrid
- [ ] Webhook Telegram per notifiche budget/fatture
- [ ] Preferenze notifiche: abilitare/disabilitare per canale e tipo nelle impostazioni

### Import Avanzato

- [ ] Import file OFX/QIF (formato bancario standard)
- [ ] Mapping colonne manuale nell'import CSV (drag-and-drop delle colonne)
- [ ] Auto-categorizzazione AI tramite Claude API (descrizione → categoria suggerita)
- [ ] Rilevamento duplicati nell'import (stessa data + importo + descrizione)
- [ ] Import da Excel (.xlsx) oltre che CSV

### Analisi AI

- [ ] Insights mensili generati da AI: "Hai speso il 23% in più al ristorante rispetto al mese scorso"
- [ ] Suggerimenti budget: "In base alle tue abitudini, ti suggeriamo €X per la categoria Y"
- [ ] Chat con i propri dati finanziari (Claude API)

---

## Evolutive v3 (Future)

- [ ] **i18n**: traduzioni inglese con `next-intl`; i18n-ready per design ma non implementato
- [ ] **Multi-account**: gestire più conti correnti/carte separati
- [ ] **Budget condivisi**: ruoli Viewer/Editor, collaborazione familiare
- [ ] **Modulo investimenti**: portafoglio Azioni/ETF/Crypto, tracking rendimenti
- [ ] **Debiti avanzati**: strategie Snowball / Avalanche con piano di rimborso
- [ ] **Envelope system**: allocazione proattiva del reddito per categoria
- [ ] **Report PDF**: generazione report mensile/annuale esportabile
- [ ] **Sync Google Sheets**: export automatico verso Google Sheets
- [ ] **Mobile app**: Flutter con OCR scontrini per inserimento rapido
- [ ] **Gamification**: badge, missioni, streak giornaliero
- [ ] **PSD2**: collegamento diretto ai conti bancari europei

---

## Tech Debt

- [x] Sostituire `confirm()` nativo (delete transazione, delete obiettivo) con modal di conferma custom
- [ ] Aggiungere error boundary globale per i componenti chart
- [ ] Testare e fissare il comportamento del middleware auth su deploy production (attualmente usa `proxy` deprecato)
- [ ] Aggiungere test E2E con Playwright almeno per i flussi auth + onboarding
- [ ] Upgrade dipendenze: `baseline-browser-mapping` è outdated (warning a ogni build)
- [ ] Valutare migrazione da Supabase client-side RLS a Server Actions per operazioni sensibili
- [ ] Aggiungere `loading.tsx` e `error.tsx` per ogni route dell'App Router

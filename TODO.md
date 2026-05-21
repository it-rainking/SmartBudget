# TODO — SmartBudget

Ultimo aggiornamento: 2026-05-21

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
| Phase 7 | Miglioramenti UX + Bug fix | 🔜 Prossimo |
| Phase 8 | Notifiche Email/Telegram (v2) | 📋 Pianificato |
| Phase 9 | Import OFX + Auto-categorizzazione AI | 📋 Pianificato |
| Phase 10 | i18n (Inglese), Multi-account, Budget condivisi | 🔮 Futuro |

---

## Bug Noti

- [ ] **Notifiche dismiss non persiste**: le notifiche ricompaiono al refresh (stato in memoria, nessuna persistenza)
- [ ] **Import CSV**: le transazioni importate non hanno `category_id` — appaiono senza categoria nelle viste filtrate per categoria
- [ ] **Calendario fatture**: su mobile il grid a 7 colonne può risultare troppo stretto su schermi < 360px
- [ ] **Dashboard Mensile**: se non ci sono transazioni del mese precedente, il delta% mostra NaN
- [ ] **Budget**: la pagina non crea automaticamente il record `monthly_budgets` fino al primo salvataggio di un importo

---

## Miglioramenti UX (Phase 7)

### Alta priorità

- [ ] **Categoria "Non categorizzato"**: creare una categoria default per le transazioni importate da CSV
- [ ] **Edit transazione**: aggiungere la possibilità di modificare una transazione esistente (attualmente solo delete)
- [ ] **Edit fattura**: completare il flusso di modifica dati fattura (amount, name, periodicità)
- [ ] **Edit obiettivo**: possibilità di modificare nome/target di un obiettivo esistente
- [ ] **Paginazione transazioni**: la lista carica tutto il mese, aggiungere virtual scroll o paginazione per mesi con molte voci
- [ ] **Ricerca transazioni**: campo di ricerca testo libero per descrizione

### Media priorità

- [ ] **Dark mode toggle**: attualmente il tema dark segue il sistema; aggiungere toggle manuale nelle impostazioni
- [ ] **Onboarding**: aggiungere la gestione dei debiti iniziali al wizard
- [ ] **Budget copia mese precedente**: pulsante "Copia budget da mese precedente" per non dover reinserire tutto
- [ ] **Ricorrenza transazioni**: supporto a transazioni ricorrenti (is_recurring, recurring_id già presenti in DB)
- [ ] **Grafici**: aggiungere tooltip con % del totale nel donut chart delle spese
- [ ] **Fatture**: notifica via toast quando una fattura viene segnata come pagata con successo
- [ ] **Obiettivi**: mostrare la proiezione "risparmia X/mese per raggiungere l'obiettivo entro la scadenza"

### Bassa priorità

- [ ] **Statistiche**: aggiungere una sezione statistiche multi-anno (confronto anno su anno)
- [ ] **Export CSV**: possibilità di esportare le transazioni in CSV (oltre al JSON GDPR completo)
- [ ] **Shortcut tastiera**: Ctrl+N per nuova transazione, Esc per chiudere modal
- [ ] **Filtro avanzato**: filtro transazioni per range di importo, descrizione, metodo di pagamento

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

- [ ] Sostituire `confirm()` nativo (delete transazione, delete obiettivo) con modal di conferma custom
- [ ] Aggiungere error boundary globale per i componenti chart
- [ ] Testare e fissare il comportamento del middleware auth su deploy production (attualmente usa `proxy` deprecato)
- [ ] Aggiungere test E2E con Playwright almeno per i flussi auth + onboarding
- [ ] Upgrade dipendenze: `baseline-browser-mapping` è outdated (warning a ogni build)
- [ ] Valutare migrazione da Supabase client-side RLS a Server Actions per operazioni sensibili
- [ ] Aggiungere `loading.tsx` e `error.tsx` per ogni route dell'App Router

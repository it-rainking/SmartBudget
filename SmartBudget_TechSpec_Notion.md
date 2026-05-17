# 💰 SmartBudget – Technical Specification

> 💡 **Callout:** Questo documento descrive l'architettura tecnica e funzionale di SmartBudget, una web app + template Excel per la gestione delle finanze personali.

## 🧩 1. Overview
- **Titolo:** SmartBudget  
- **Piattaforme:** Web App + Template Excel  
- **Obiettivo:** Gestione completa di budget, entrate, spese, risparmi, fatture e dashboard.  
- **Target:** Utenti individuali, coppie, famiglie  
- **Lingue:** IT (v1), predisposto per i18n  

---

## 👥 2. User Roles
- **User** (v1)
- **Admin** (v2, per gestione contenuti/piani)

---

## 🧱 3. Core Modules

### 🚀 3.1 Onboarding
- Inserimento saldo iniziale  
- Configurazione categorie iniziali  
- Setup primo mese di budget  

### 🗂️ 3.2 Category Management
- Categorie reddito  
- Categorie spese (macro + sottocategorie)  
- Categorie risparmi  
- Debiti  
- Fatture/abbonamenti  
- Icone per categorie  
- CRUD completo  

### 📅 3.3 Monthly Budget
- Budget previsto vs effettivo  
- Totali mensili  
- KPI (reddito, spese, risparmi, saldo)  
- % raggiungimento obiettivi  

### 💳 3.4 Transactions
- CRUD transazioni  
- Data, tipo, categoria, importo, metodo pagamento, note, tag  
- Filtri (per mese, categoria, metodo pagamento)  
- Assegnazione automatica del mese  

### 🧾 3.5 Bills Monitoring
- Tabella fatture: scadenza, importo dovuto, importo pagato, periodicità, stato  
- Vista calendario mensile con scadenze evidenziate  

### 📊 3.6 Monthly Dashboard
**KPI:**
- % reddito raggiunto  
- % spese  
- % risparmi  
- % debiti (v2)  
- Reddito residuo  

**Grafici:**
- Donut reddito  
- Donut spese (dettaglio categorie)  
- Donut risparmi  
- Donut debiti (v2)  
- Bar chart risparmi  
- Barra “Budget vs Effettivo”  

### 📈 3.7 Annual Dashboard
- Entrate, spese e saldo per mese  
- Totali annuali  
- Trend e confronti mensili  

### 🎯 3.8 Goals
- Obiettivi di risparmio  
- Obiettivi di riduzione debiti  
- Progresso in % e in €  
- Visualizzazione grafica  

### 🔔 3.9 Notifications (v2)
- Notifiche superamento budget  
- Fatture in scadenza  
- Obiettivi raggiunti  
- Canali: Email / Telegram  

### 🔁 3.10 Import/Export
- Export CSV/XLS  
- Import CSV (v2)  
- Import OFX/QFX (v2)  
- Integrazione PSD2 (v3)  

### 🔐 3.11 Security
- Supabase Auth  
- Row Level Security  
- Export & delete (GDPR)  
- HTTPS + cifratura dati at-rest  

---

## 🗄️ 4. Data Model (Supabase/Postgres)

> 🧱 **Callout:** Tutte le tabelle sono protette da Row Level Security basata su `user_id`.

- `users`  
- `settings`  
- `income_categories`  
- `expense_categories`  
- `expense_subcategories`  
- `saving_categories`  
- `debt_items`  
- `monthly_budgets`  
- `monthly_budget_items`  
- `transactions`  
- `invoices`  
- `goals`  
- `notifications` (v2)  

---

## 🌐 5. Web Architecture

### 🎨 Frontend
- Next.js  
- React  
- TailwindCSS  
- Chart.js  
- React Query  

### 🛠️ Backend
- Supabase (DB + Auth + RLS + API)  

### 🧭 Routing
- `/login`  
- `/signup`  
- `/onboarding`  
- `/dashboard/mensile`  
- `/dashboard/annuale`  
- `/budget`  
- `/transazioni`  
- `/fatture`  
- `/obiettivi`  
- `/settings`  

---

## 📊 6. Excel Architecture

### 📄 Sheets
1. Settings  
2. Transazioni  
3. Budget  
4. Dashboard Mensile  
5. Dashboard Annuale  
6. Fatture + Calendario  
7. Obiettivi  

### 🧮 Functions
- SOMMA.PIÙ.SE  
- CERCA.X  
- INDIRETTO  
- Tabelle Pivot  
- Formattazione condizionale  

### 🤖 Macro opzionali
- Duplicazione mese  
- Reset anno  
- Backup  

---

## ⚙️ 7. Non Functional Requirements
- Tempo di caricamento dashboard < 1.5s  
- UI responsive (desktop + mobile)  
- 99% uptime (provider)  
- GDPR-ready  
- Backup automatici su Supabase  

---

## 🧭 8. Technical Roadmap

### Fase 0 – Setup
- Repo  
- Supabase  
- Struttura base progetto  

### Fase 1 – Auth + DB
- Schema DB  
- RLS  
- API base  

### Fase 2 – Budget + Transazioni
- UI Budget  
- UI Transazioni  
- KPI base  

### Fase 3 – Dashboard Mensile
- Grafici  
- KPI  
- Selettore mese  

### Fase 4 – Fatture + Calendario

### Fase 5 – Dashboard Annuale + Obiettivi

### Fase 6 – Import CSV + Notifiche + UX

---

## 🚀 9. Future Evolutions

### 🧠 9.1 Automation & AI
- Auto-categorizzazione  
- Rilevamento anomalie  
- Forecast spese  
- Suggerimenti ottimizzazione  
- Chatbot AI integrato  

### 💳 9.2 Bank Integrations
- Collegamento PSD2  
- Multi-account  

### 📈 9.3 Investments Module
- Azioni / ETF / Crypto  
- Prezzi via API  
- KPI ROI  

### 💰 9.4 Advanced Debts
- Ammortamento  
- Strategie Snowball / Avalanche  

### 🧺 9.5 Advanced Savings
- Envelope system  
- Regole automatiche  

### 📑 9.6 Reporting
- Report PDF mensili/annuali  
- Sync Google Sheets  

### 🧑‍🤝‍🧑 9.7 Multi-User
- Budget condivisi  
- Ruoli Viewer/Editor  

### 🎮 9.8 Gamification
- Badge  
- Missioni settimanali  

### 🛒 9.9 Marketplace
- Template premium  
- Modelli AI  
- Plugin  

### ☁️ 9.10 Backup & Cloud
- Sync Drive / iCloud / Dropbox  

### 📱 9.11 Mobile App
- Flutter  
- OCR scontrini  
- Widget saldo  

### 🔗 9.12 Integrations
- YNAB  
- Notion  
- Webhooks  

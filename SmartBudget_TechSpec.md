# SmartBudget – Technical Specification

## 1. Overview
**Title:** SmartBudget  
**Platform:** Web App + Excel Template  
**Goal:** Complete personal finance management: budget, income, expenses, savings, invoices, dashboards.  
**Target:** Individuals & families  
**Languages:** IT (v1), ready for i18n  

---

## 2. User Roles
- **User** (v1)
- **Admin** (v2)

---

## 3. Core Modules

### 3.1 Onboarding
- Initial balance  
- Category setup  
- First month budget setup  

### 3.2 Category Management
- Income  
- Expenses (macro + subcategories)  
- Savings  
- Debts  
- Bills  
- Icons  
- Full CRUD  

### 3.3 Monthly Budget
- Planned vs Actual  
- KPIs  
- Automatic totals  
- Percent achieved  

### 3.4 Transactions
- CRUD  
- Filters  
- Tags  
- Payment method  
- Automatic month assignment  

### 3.5 Bills Monitoring
- Due dates  
- Recurrence  
- Status  
- Monthly calendar view  

### 3.6 Monthly Dashboard
**KPIs**
- Income %  
- Expenses %  
- Savings %  
- Debts %  
- Remaining income  

**Charts**
- Income donut  
- Expenses donut  
- Savings donut  
- Debts donut  
- Savings bar chart  
- Budget vs Actual bar  

### 3.7 Annual Dashboard
- Year totals  
- Monthly trends  
- Income/Expenses/Balance  
- Comparisons  

### 3.8 Goals
- Savings goals  
- Debt goals  
- % and € progress  

### 3.9 Notifications (v2)
- Overbudget  
- Bills due  
- Goals achieved  
- Email / Telegram  

### 3.10 Import/Export
- CSV/XLS  
- CSV Import (v2)  
- OFX/QFX Import (v2)  
- PSD2 bank integration (v3)  

### 3.11 Security
- Supabase Auth  
- RLS  
- GDPR-compliant  
- HTTPS + encryption  

---

## 4. Data Model (Supabase/Postgres)
Tables:
- users  
- settings  
- income_categories  
- expense_categories  
- expense_subcategories  
- saving_categories  
- debt_items  
- monthly_budgets  
- monthly_budget_items  
- transactions  
- invoices  
- goals  
- notifications (v2)

---

## 5. Web Architecture
### Frontend
- Next.js  
- React  
- TailwindCSS  
- Chart.js  
- React Query  

### Backend
- Supabase (DB, Auth, RLS, API)

### Routes
- /login  
- /signup  
- /onboarding  
- /dashboard/mensile  
- /dashboard/annuale  
- /budget  
- /transazioni  
- /fatture  
- /obiettivi  
- /settings  

---

## 6. Excel Architecture
### Sheets
1. Settings  
2. Transactions  
3. Budget  
4. Monthly Dashboard  
5. Annual Dashboard  
6. Bills + Calendar  
7. Goals  

### Functions
- SUMIFS  
- XLOOKUP  
- INDIRECT  
- PivotTables  
- Conditional formatting  

### Optional macros
- Duplicate month  
- Reset year  
- Backup  

---

## 7. Non Functional Requirements
- Dashboard < 1.5 seconds  
- Mobile-ready UI  
- 99% uptime  
- GDPR ready  
- Automatic Supabase backups  

---

## 8. Technical Roadmap

### Phase 0 – Setup
- Repo  
- Supabase  
- Project structure  

### Phase 1 – Auth + DB
- Schema  
- RLS  
- API  

### Phase 2 – Budget + Transactions
- Budget UI  
- Transactions UI  
- KPIs  

### Phase 3 – Monthly Dashboard
- Charts  
- KPIs  
- Month selector  

### Phase 4 – Bills + Calendar  

### Phase 5 – Annual Dashboard + Goals  

### Phase 6 – Import CSV + Notifications + UX  

---

## 9. Future Evolutions

### 9.1 Automation & AI
- Auto categorization  
- Spending anomaly detection  
- Forecasts  
- Optimization suggestions  
- AI chatbot  

### 9.2 Bank Integrations
- PSD2 connections  
- Multi-account  

### 9.3 Investments Module
- Stocks / ETF / Crypto  
- API prices  
- ROI  

### 9.4 Advanced Debts
- Amortization  
- Snowball/Avalanche  

### 9.5 Advanced Savings
- Envelope system  
- Automatic rules  

### 9.6 Reporting
- PDF monthly/annual  
- Google Sheets sync  

### 9.7 Multi-User
- Shared budgets  
- Roles  

### 9.8 Gamification
- Badges  
- Missions  

### 9.9 Marketplace
- Templates  
- AI models  
- Plugins  

### 9.10 Backup & Cloud
- Drive / iCloud / Dropbox sync  

### 9.11 Mobile App
- Flutter  
- OCR receipts  
- Widgets  

### 9.12 Integrations
- YNAB  
- Notion  
- Webhooks  


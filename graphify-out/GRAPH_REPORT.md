# Graph Report - /Volumes/Dati/Dropbox/GitHub/SmartBudget  (2026-05-30)

## Corpus Check
- Corpus is ~28,904 words - fits in a single context window. You may not need a graph.

## Summary
- 251 nodes · 466 edges · 28 communities (11 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 4,200 input · 1,800 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Supabase Data Layer|Supabase Data Layer]]
- [[_COMMUNITY_Category Management|Category Management]]
- [[_COMMUNITY_Dashboard & Pages|Dashboard & Pages]]
- [[_COMMUNITY_Layout & Navigation|Layout & Navigation]]
- [[_COMMUNITY_Notification System|Notification System]]
- [[_COMMUNITY_Auth & Goals|Auth & Goals]]
- [[_COMMUNITY_Budget Planning|Budget Planning]]
- [[_COMMUNITY_CSV Import|CSV Import]]
- [[_COMMUNITY_App Bootstrap|App Bootstrap]]
- [[_COMMUNITY_Middleware|Middleware]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Seed Data|Seed Data]]
- [[_COMMUNITY_Project Docs|Project Docs]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Home Redirect|Home Redirect]]
- [[_COMMUNITY_Auth Callback|Auth Callback]]
- [[_COMMUNITY_Login|Login]]
- [[_COMMUNITY_Signup|Signup]]
- [[_COMMUNITY_Providers|Providers]]
- [[_COMMUNITY_Format Currency|Format Currency]]
- [[_COMMUNITY_Format Date|Format Date]]
- [[_COMMUNITY_Format Month|Format Month]]
- [[_COMMUNITY_ClassNames Util|ClassNames Util]]
- [[_COMMUNITY_Settings Types|Settings Types]]

## God Nodes (most connected - your core abstractions)
1. `supabase singleton` - 23 edges
2. `Database Schema` - 14 edges
3. `useSettings()` - 13 edges
4. `supabase` - 13 edges
5. `useToast()` - 11 edges
6. `BudgetPage()` - 10 edges
7. `DashboardLayout Component` - 10 edges
8. `TransazioniPage()` - 9 edges
9. `DashboardLayout()` - 9 edges
10. `ObiettiviPage()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `SmartBudget TODO & Roadmap` --references--> `useNotifications`  [INFERRED]
  TODO.md → src/hooks/useNotifications.ts
- `package.json dependencies` --references--> `supabase singleton`  [INFERRED]
  package.json → src/lib/supabase.ts
- `SmartBudget TODO & Roadmap` --references--> `parseCSV`  [INFERRED]
  TODO.md → src/hooks/useImportTransactions.ts
- `Onboarding Page` --calls--> `RPC: create_default_categories`  [INFERRED]
  src/app/onboarding/page.tsx → supabase/schema.sql
- `Fatture Page` --shares_data_with--> `DB Table: invoices`  [INFERRED]
  src/app/fatture/page.tsx → supabase/schema.sql

## Hyperedges (group relationships)
- **Authentication Flow** — useauth_ts, login_page, signup_page, auth_callback_route, db_profiles [INFERRED 0.95]
- **Category Management System** — usecategories_ts, db_income_categories, db_expense_categories, db_saving_categories, db_expense_subcategories, fn_create_default_categories, seed_categories_sql [INFERRED 0.90]
- **Budget Planning Flow** — budget_page, db_monthly_budgets, db_monthly_budget_items, usecategories_ts [INFERRED 0.85]
- **In-App Notification System** — notificationbell_tsx, db_notifications, dashboardlayout_tsx [INFERRED 0.85]
- **React Query Mutation Pattern (invalidate on success)** — usetransactions_usecreatetransaction, usetransactions_useupdatetransaction, usetransactions_usedeletetransaction, useinvoices_usecreateinvoice, usegoals_usecreategoal, usebudget_useupsertbudgetitem [EXTRACTED 1.00]
- **All Supabase data hooks sharing singleton client** — usetransactions_usetransactions, usebudget_usemonthlybudget, useinvoices_useinvoices, usegoals_usegoals, useannualdata_useannualdata, useimporttransactions_useimporttransactions [EXTRACTED 1.00]

## Communities (28 total, 17 thin omitted)

### Community 0 - "Supabase Data Layer"
Cohesion: 0.07
Nodes (35): createClient, supabase singleton, getMonthDateRange, Notifications computed in-memory, no DB persistence, package.json dependencies, SmartBudget TODO & Roadmap, Goal type, Invoice type (+27 more)

### Community 1 - "Category Management"
Cohesion: 0.1
Nodes (24): useIncomeCategories(), useInitializeCategories(), useSavingCategories(), TransactionFilters, useCreateTransaction(), useDeleteTransaction(), useTransactions(), MONTHS (+16 more)

### Community 2 - "Dashboard & Pages"
Cohesion: 0.12
Nodes (32): Budget Page, Dashboard Annuale Page, Dashboard Mensile Page, DashboardLayout Component, DB Table: expense_categories, DB Table: expense_subcategories, DB Table: goals, DB Table: income_categories (+24 more)

### Community 3 - "Layout & Navigation"
Cohesion: 0.12
Nodes (20): DashboardAnnualePage(), DashboardLayout(), DashboardLayoutProps, navigation, MONTH_LABELS, MonthlyAnnualData, useAnnualData(), useAuth() (+12 more)

### Community 4 - "Notification System"
Cohesion: 0.13
Nodes (19): NotificationBell(), TYPE_BG, TYPE_BODY, TYPE_TITLE, DAYS_IT, FatturePage(), MONTHS_IT, RECURRENCE_LABELS (+11 more)

### Community 5 - "Auth & Goals"
Cohesion: 0.13
Nodes (18): GET(), useAddGoalProgress(), useCompleteGoal(), useCreateGoal(), useDeleteGoal(), createServerSupabaseClient(), emptyForm, NewGoalForm (+10 more)

### Community 6 - "Budget Planning"
Cohesion: 0.22
Nodes (14): BudgetPage(), MONTHS, TabType, useActualAmountsByCategory(), useEnsureMonthlyBudget(), useMonthlyBudget(), useUpsertBudgetItem(), useExpenseCategories() (+6 more)

### Community 7 - "CSV Import"
Cohesion: 0.17
Nodes (13): ImportCSVModal(), Props, TYPE_COLORS, TYPE_LABELS, ToastContext, ToastContextValue, ToastItem, ToastProvider() (+5 more)

### Community 8 - "App Bootstrap"
Cohesion: 0.32
Nodes (4): metadata, Providers(), ProvidersProps, queryClient

## Knowledge Gaps
- **83 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `config`, `metadata` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `Layout & Navigation` to `Category Management`, `Notification System`, `Auth & Goals`, `Budget Planning`, `CSV Import`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `useSettings()` connect `Layout & Navigation` to `Auth & Goals`, `Budget Planning`, `CSV Import`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Supabase Data Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Category Management` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Dashboard & Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Layout & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
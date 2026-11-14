# Graph Report - .  (2026-11-14)

## Corpus Check
- 170 files · ~127,321 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 728 nodes · 1607 edges · 39 communities (32 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Budget e Notifiche|Budget e Notifiche]]
- [[_COMMUNITY_API e Cron Prezzi|API e Cron Prezzi]]
- [[_COMMUNITY_Import CSV e Quick Add|Import CSV e Quick Add]]
- [[_COMMUNITY_Fondo Pensione|Fondo Pensione]]
- [[_COMMUNITY_Layout Dashboard|Layout Dashboard]]
- [[_COMMUNITY_Pagine Annuale e Debiti|Pagine Annuale e Debiti]]
- [[_COMMUNITY_Hook Investimenti|Hook Investimenti]]
- [[_COMMUNITY_Parser Fineco CSV|Parser Fineco CSV]]
- [[_COMMUNITY_Concetti Documentati|Concetti Documentati]]
- [[_COMMUNITY_Doppioni Transazioni|Doppioni Transazioni]]
- [[_COMMUNITY_Portamonete Kakebo|Portamonete Kakebo]]
- [[_COMMUNITY_Sezioni Dashboard|Sezioni Dashboard]]
- [[_COMMUNITY_UI Base|UI Base]]
- [[_COMMUNITY_Suggerimenti AI Categorie|Suggerimenti AI Categorie]]
- [[_COMMUNITY_Grafici e BalanceHero|Grafici e BalanceHero]]
- [[_COMMUNITY_Rate PayPal|Rate PayPal]]
- [[_COMMUNITY_Rilevamento Doppioni|Rilevamento Doppioni]]
- [[_COMMUNITY_Test Rate|Test Rate]]
- [[_COMMUNITY_Test Fineco|Test Fineco]]
- [[_COMMUNITY_MonthSwitcher|MonthSwitcher]]
- [[_COMMUNITY_Rate Limit API|Rate Limit API]]
- [[_COMMUNITY_Risoluzione Ticker|Risoluzione Ticker]]
- [[_COMMUNITY_Import Investimenti|Import Investimenti]]
- [[_COMMUNITY_Classificazione Asset|Classificazione Asset]]
- [[_COMMUNITY_Config Next|Config Next]]
- [[_COMMUNITY_Middleware|Middleware]]
- [[_COMMUNITY_ConfigAltro 26|Config/Altro 26]]
- [[_COMMUNITY_ConfigAltro 27|Config/Altro 27]]
- [[_COMMUNITY_ConfigAltro 28|Config/Altro 28]]
- [[_COMMUNITY_ConfigAltro 37|Config/Altro 37]]
- [[_COMMUNITY_ConfigAltro 38|Config/Altro 38]]

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 32 edges
2. `useSettings()` - 29 edges
3. `classNames()` - 26 edges
4. `TransazioniPage()` - 25 edges
5. `supabase` - 22 edges
6. `DashboardLayout()` - 19 edges
7. `formatCurrency()` - 19 edges
8. `SmartBudget Platform` - 18 edges
9. `useExpenseCategories()` - 17 edges
10. `getLocalDateString()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `ARCHITETTURA reference doc` --conceptually_related_to--> `SmartBudget Platform`  [INFERRED]
  docs/ARCHITETTURA.md → CLAUDE.md
- `README feature overview` --conceptually_related_to--> `SmartBudget Platform`  [INFERRED]
  README.md → CLAUDE.md
- `Roadmap and bugs` --conceptually_related_to--> `SmartBudget Platform`  [INFERRED]
  TODO.md → CLAUDE.md
- `TechSpec / TechDoc (Excel + Web)` --conceptually_related_to--> `SmartBudget Platform`  [INFERRED]
  SmartBudget_TechSpec.md → CLAUDE.md
- `Investments setup guide` --conceptually_related_to--> `Investments Module`  [INFERRED]
  docs/investimenti-setup.md → CLAUDE.md

## Hyperedges (group relationships)
- **Install and deploy docs** — installazione_local_guide, deploy_vercel_guide, cloud_install_platforms [INFERRED 0.85]
- **Transaction-generating expense models** — claude_installments, claude_recurring, claude_import_csv [INFERRED 0.75]

## Communities (39 total, 7 thin omitted)

### Community 0 - "Budget e Notifiche"
Cohesion: 0.06
Nodes (63): BudgetPage(), MONTHS, TabType, DB_TYPE_MAP, ExtendedNotification, NotificationBell(), TYPE_BG, TYPE_BODY (+55 more)

### Community 1 - "API e Cron Prezzi"
Cohesion: 0.06
Nodes (48): GET(), POST(), t, table, old, quote, quotes, recent (+40 more)

### Community 2 - "Import CSV e Quick Add"
Cohesion: 0.06
Nodes (55): ImportCSVModal(), Props, TYPE_COLORS, TYPE_LABELS, parseAmountInput(), QuickAddSheet(), QuickAddSheetProps, QuickType (+47 more)

### Community 3 - "Fondo Pensione"
Cohesion: 0.07
Nodes (53): FondoPensionePage(), NumberField(), NumericKey, shown(), PensionComparisonState, QUERY_KEY, usePensionComparison(), useSavePensionComparison() (+45 more)

### Community 4 - "Layout Dashboard"
Cohesion: 0.06
Nodes (35): metadata, viewport, DashboardLayout(), DashboardLayoutProps, MONTH_PAGES, MORE_ITEMS, navigation, NavItem (+27 more)

### Community 5 - "Pagine Annuale e Debiti"
Cohesion: 0.1
Nodes (19): DashboardAnnualePage(), NumericMonthField, DebitiPage(), emptyForm, Strategy, AnnualHighlights, AnnualTotals, MONTH_LABELS (+11 more)

### Community 6 - "Hook Investimenti"
Cohesion: 0.11
Nodes (25): ManualPriceInput, useDeleteManualPrice(), useImportCsv(), useInvestments(), useSetManualPrices(), ASSET_CLASS_COLORS, ASSET_CLASS_LABELS, daysSince() (+17 more)

### Community 7 - "Parser Fineco CSV"
Cohesion: 0.08
Nodes (17): CANDIDATE_DIVISORS, ColumnMap, DecimalSeparator, DELIMITERS, detectHeader(), findNameColumn(), HeaderDetection, mapColumns() (+9 more)

### Community 8 - "Concetti Documentati"
Cohesion: 0.07
Nodes (30): AI endpoints (Claude), Saldo netto vs saldo disponibile, GitHub Actions cron scheduler on Railway, Database Schema with RLS, Possible duplicates detection, Exceptional movements (is_exceptional), fx_rates currency conversion, Import CSV/OFX (+22 more)

### Community 9 - "Doppioni Transazioni"
Cohesion: 0.11
Nodes (20): useInitializeCategories(), DismissedDuplicates, QUERY_KEY, useDismissDuplicates(), useDismissedDuplicates(), useRestoreDuplicates(), useCancelRemainingInstallments(), useConvertToInstallmentPlan() (+12 more)

### Community 10 - "Portamonete Kakebo"
Cohesion: 0.1
Nodes (25): MONTHS_SHORT, SpendingPlanSection(), SpendingPlanSectionProps, base, current, groups, past, plan (+17 more)

### Community 11 - "Sezioni Dashboard"
Cohesion: 0.14
Nodes (16): AiInsightsSection(), AiInsightsSectionProps, Kpis, CategoryExpensesModal(), useHorizontalSwipe(), useInstallmentPlans(), generateOccurrencesForMonth(), TransactionFilters (+8 more)

### Community 12 - "UI Base"
Cohesion: 0.16
Nodes (12): TabLink(), Field(), classNames(), Button(), ButtonProps, VARIANTS, Card(), KpiTile() (+4 more)

### Community 13 - "Suggerimenti AI Categorie"
Cohesion: 0.15
Nodes (13): AiCategorySuggestionsPanel(), CAT_TYPE_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_COLORS, TYPE_ICONS, TYPE_LABELS, CategorySuggestion (+5 more)

### Community 14 - "Grafici e BalanceHero"
Cohesion: 0.17
Nodes (10): Bar, Doughnut, Line, BalanceHero(), BalanceHeroProps, CategoryBreakdownSection(), CategoryBreakdownSectionProps, CategoryTotal (+2 more)

### Community 15 - "Rate PayPal"
Cohesion: 0.17
Nodes (11): INSTALLMENT_STATUS_CLASS, INSTALLMENT_STATUS_LABEL, InstallmentPlansSummary(), useSettleInstallmentPlanEarly(), buildInstallmentPlans(), ExistingInstallmentRow, findImportedInstallmentDuplicates(), ImportCandidate (+3 more)

### Community 16 - "Rilevamento Doppioni"
Cohesion: 0.21
Nodes (11): pairs, dayBandIndexes(), descriptionSimilarity(), DuplicateCandidate, DuplicatePair, duplicatePairKey(), DuplicateReason, findPossibleDuplicates() (+3 more)

### Community 17 - "Test Rate"
Cohesion: 0.19
Nodes (12): dup, existing, [plan], rows, sumCents, addDays(), addMonthsClamped(), clampDayInMonth() (+4 more)

### Community 18 - "Test Fineco"
Cohesion: 0.13
Nodes (14): apple, btp, byIsin, bytes, csv, fixture, latin1, { rows } (+6 more)

### Community 19 - "MonthSwitcher"
Cohesion: 0.21
Nodes (7): MONTHS, MONTHS_SHORT, MonthSwitcher(), MonthSwitcherProps, parseMonthParam(), useSelectedMonth(), withMonthParam()

### Community 20 - "Rate Limit API"
Cohesion: 0.33
Nodes (6): POST(), POST(), buckets, checkRateLimit(), POST(), POST()

### Community 21 - "Risoluzione Ticker"
Cohesion: 0.25
Nodes (10): isKnownMarket(), MARKET_SUFFIXES, MarketMapping, MARKETS, normalizeMarket(), normalizeSymbol(), ResolvedTicker, resolveTickerFromCsv() (+2 more)

### Community 22 - "Import Investimenti"
Cohesion: 0.31
Nodes (8): POST(), decodeCsvBuffer(), detectDecimalSeparator(), detectIsinColumn(), detectNonCsvFormat(), extractIsin(), parseFinecoCsv(), readFixture()

### Community 23 - "Classificazione Asset"
Cohesion: 0.48
Nodes (5): classifyFromCsv(), detectPriceDivisor(), isFundLike(), isPercentQuotedType(), AssetClass

## Knowledge Gaps
- **220 isolated node(s):** `eslintConfig`, `securityHeaders`, `nextConfig`, `config`, `config` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Database` connect `API e Cron Prezzi` to `Pagine Annuale e Debiti`, `Import Investimenti`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `useToast()` connect `Import CSV e Quick Add` to `Budget e Notifiche`, `Fondo Pensione`, `Layout Dashboard`, `Pagine Annuale e Debiti`, `Hook Investimenti`, `Doppioni Transazioni`, `Suggerimenti AI Categorie`, `Rate PayPal`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `supabase` connect `Pagine Annuale e Debiti` to `Budget e Notifiche`, `Import CSV e Quick Add`, `Fondo Pensione`, `Layout Dashboard`, `Hook Investimenti`, `Doppioni Transazioni`, `Sezioni Dashboard`, `Rate PayPal`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `securityHeaders`, `nextConfig` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Budget e Notifiche` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `API e Cron Prezzi` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Import CSV e Quick Add` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
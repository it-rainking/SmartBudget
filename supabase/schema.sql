-- ============================================
-- SMARTBUDGET DATABASE SCHEMA
-- Version: 1.0
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 2. SETTINGS
-- ============================================
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    currency TEXT DEFAULT 'EUR' NOT NULL,
    locale TEXT DEFAULT 'it-IT' NOT NULL,
    initial_balance DECIMAL(12,2) DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    notify_email BOOLEAN DEFAULT FALSE NOT NULL,
    notify_telegram BOOLEAN DEFAULT FALSE NOT NULL,
    telegram_chat_id TEXT,
    notification_email TEXT,
    payment_methods TEXT[] DEFAULT ARRAY['Contanti', 'Carta', 'Bonifico', 'PayPal', 'Altro'],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- ============================================
-- 3. INCOME CATEGORIES
-- ============================================
CREATE TABLE public.income_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#10b981',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 4. EXPENSE CATEGORIES
-- ============================================
CREATE TABLE public.expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#ef4444',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 5. EXPENSE SUBCATEGORIES
-- ============================================
CREATE TABLE public.expense_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.expense_categories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 6. SAVING CATEGORIES
-- ============================================
CREATE TABLE public.saving_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 7. DEBT ITEMS
-- ============================================
CREATE TABLE public.debt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    total_amount DECIMAL(12,2) NOT NULL,
    remaining_amount DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2),
    start_date DATE,
    due_date DATE,
    monthly_payment DECIMAL(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 8. MONTHLY BUDGETS
-- ============================================
CREATE TABLE public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, month, year)
);

-- ============================================
-- 9. MONTHLY BUDGET ITEMS
-- ============================================
CREATE TABLE public.monthly_budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID REFERENCES public.monthly_budgets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'saving')),
    category_id UUID NOT NULL,
    planned_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(budget_id, category_type, category_id)
);

-- ============================================
-- 10. TRANSACTIONS
-- ============================================
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'saving', 'debt')),
    category_id UUID NOT NULL,
    subcategory_id UUID,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    payment_method TEXT,
    tags TEXT[],
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_id UUID,
    -- Movimento eccezionale/una tantum: escluso da medie, delta e trend
    is_exceptional BOOLEAN NOT NULL DEFAULT FALSE,
    -- Spese dilazionate (es. PayPal "Paga in 3 rate"): le rate di uno stesso
    -- acquisto condividono installment_plan_id e si numerano 1..installment_count
    installment_plan_id UUID,
    installment_number INTEGER,
    installment_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT transactions_installment_check CHECK (
        (installment_plan_id IS NULL AND installment_number IS NULL AND installment_count IS NULL)
        OR (
            installment_plan_id IS NOT NULL
            AND installment_count >= 2
            AND installment_number >= 1
            AND installment_number <= installment_count
        )
    )
);

-- ============================================
-- 11. INVOICES (Bills/Subscriptions)
-- ============================================
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    paid_amount DECIMAL(12,2),
    recurrence TEXT CHECK (recurrence IN ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    category_id UUID,
    reminder_days INTEGER DEFAULT 3,
    auto_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 12. GOALS
-- ============================================
CREATE TABLE public.goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('saving', 'debt')),
    target_amount DECIMAL(12,2) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    deadline DATE,
    category_id UUID,
    icon TEXT,
    color TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 13. NOTIFICATIONS (v2 - prepared)
-- ============================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('budget_exceeded', 'bill_due', 'goal_achieved', 'goal_progress', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 14. ASSETS (Investimenti)
-- ============================================
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    isin TEXT NOT NULL,
    ticker_gf TEXT NOT NULL DEFAULT '',
    ticker_yahoo TEXT,
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('etf_equity', 'etf_bond', 'etf_thematic', 'stock', 'cash', 'other')),
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, isin)
);

-- ============================================
-- 15. HOLDINGS (Investimenti)
-- ============================================
CREATE TABLE public.holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    quantity NUMERIC(18,6) NOT NULL,
    avg_cost NUMERIC(18,4) NOT NULL,
    source TEXT NOT NULL DEFAULT 'fineco_csv',
    imported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, asset_id)
);

-- ============================================
-- 16. PRICE SNAPSHOTS (Investimenti)
-- ============================================
-- Scritto solo dal cron price fetcher (service role, bypassa RLS).
CREATE TABLE public.price_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    price NUMERIC(18,4) NOT NULL,
    change_pct NUMERIC(8,4),
    currency TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gsheet', 'yahoo')),
    fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 17. ISIN TICKER LOOKUP (Investimenti)
-- ============================================
-- Tabella di riferimento globale (non per-utente): mappa ISIN noti al ticker
-- Google Finance / Yahoo, usata dall'import CSV per risolvere il ticker.
CREATE TABLE public.isin_ticker_lookup (
    isin TEXT PRIMARY KEY,
    ticker_gf TEXT,
    ticker_yahoo TEXT,
    name TEXT,
    asset_class TEXT CHECK (asset_class IN ('etf_equity', 'etf_bond', 'etf_thematic', 'stock', 'cash', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES for better performance
-- ============================================

-- Transactions indexes
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX idx_transactions_user_exceptional ON public.transactions(user_id, is_exceptional);
CREATE INDEX idx_transactions_installment_plan ON public.transactions(installment_plan_id) WHERE installment_plan_id IS NOT NULL;

-- Budget indexes
CREATE INDEX idx_monthly_budgets_user_id ON public.monthly_budgets(user_id);
CREATE INDEX idx_monthly_budgets_period ON public.monthly_budgets(user_id, year, month);
CREATE INDEX idx_monthly_budget_items_budget_id ON public.monthly_budget_items(budget_id);

-- Categories indexes
CREATE INDEX idx_income_categories_user_id ON public.income_categories(user_id);
CREATE INDEX idx_expense_categories_user_id ON public.expense_categories(user_id);
CREATE INDEX idx_expense_subcategories_category_id ON public.expense_subcategories(category_id);
CREATE INDEX idx_saving_categories_user_id ON public.saving_categories(user_id);

-- Invoices indexes
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- Goals indexes
CREATE INDEX idx_goals_user_id ON public.goals(user_id);
CREATE INDEX idx_goals_type ON public.goals(type);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Investments indexes
CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_holdings_user_id ON public.holdings(user_id);
CREATE INDEX idx_holdings_asset_id ON public.holdings(asset_id);
CREATE INDEX idx_price_snapshots_asset_fetched ON public.price_snapshots(asset_id, fetched_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_income_categories_updated_at BEFORE UPDATE ON public.income_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_subcategories_updated_at BEFORE UPDATE ON public.expense_subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saving_categories_updated_at BEFORE UPDATE ON public.saving_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_debt_items_updated_at BEFORE UPDATE ON public.debt_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_budgets_updated_at BEFORE UPDATE ON public.monthly_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_budget_items_updated_at BEFORE UPDATE ON public.monthly_budget_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_isin_ticker_lookup_updated_at BEFORE UPDATE ON public.isin_ticker_lookup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

    INSERT INTO public.settings (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update invoice status based on due date
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.paid_date IS NOT NULL THEN
        NEW.status = 'paid';
    ELSIF NEW.due_date < CURRENT_DATE AND NEW.status = 'pending' THEN
        NEW.status = 'overdue';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoice_status_trigger
    BEFORE INSERT OR UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- Riepilogo portafoglio investimenti: join holdings <-> assets <-> ultimo
-- price_snapshot in una sola query (LATERAL). L'aggregazione (market_value,
-- P&L, pesi, badge di provenienza) resta lato API route (/api/investments/summary).
CREATE OR REPLACE FUNCTION public.get_investment_summary(p_user_id UUID)
RETURNS TABLE (
    holding_id UUID,
    asset_id UUID,
    isin TEXT,
    ticker_gf TEXT,
    ticker_yahoo TEXT,
    name TEXT,
    asset_class TEXT,
    currency TEXT,
    quantity NUMERIC,
    avg_cost NUMERIC,
    imported_at TIMESTAMPTZ,
    last_price NUMERIC,
    change_pct NUMERIC,
    price_source TEXT,
    fetched_at TIMESTAMPTZ
) AS $$
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    RETURN QUERY
    SELECT
        h.id,
        a.id,
        a.isin,
        a.ticker_gf,
        a.ticker_yahoo,
        a.name,
        a.asset_class,
        a.currency,
        h.quantity,
        h.avg_cost,
        h.imported_at,
        ps.price,
        ps.change_pct,
        ps.source,
        ps.fetched_at
    FROM public.holdings h
    JOIN public.assets a ON a.id = h.asset_id
    LEFT JOIN LATERAL (
        SELECT price_snapshots.price, price_snapshots.change_pct, price_snapshots.source, price_snapshots.fetched_at
        FROM public.price_snapshots
        WHERE price_snapshots.asset_id = a.id
        ORDER BY price_snapshots.fetched_at DESC
        LIMIT 1
    ) ps ON true
    WHERE h.user_id = p_user_id;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Righe di esempio per isin_ticker_lookup (pattern da estendere con i propri ISIN).
INSERT INTO public.isin_ticker_lookup (isin, ticker_gf, ticker_yahoo, name, asset_class) VALUES
    ('IE00BK5BQT80', 'BIT:VWCE', 'VWCE.MI', 'Vanguard FTSE All-World UCITS ETF', 'etf_equity'),
    ('IE00B4L5Y983', 'BIT:SWDA', 'SWDA.MI', 'iShares Core MSCI World UCITS ETF', 'etf_equity')
ON CONFLICT (isin) DO NOTHING;

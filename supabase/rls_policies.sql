-- ============================================
-- SMARTBUDGET ROW LEVEL SECURITY POLICIES
-- Version: 1.0
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saving_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isin_ticker_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================
-- SETTINGS POLICIES
-- ============================================
CREATE POLICY "Users can view own settings"
    ON public.settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON public.settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON public.settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- INCOME CATEGORIES POLICIES
-- ============================================
CREATE POLICY "Users can view own income categories"
    ON public.income_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income categories"
    ON public.income_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income categories"
    ON public.income_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income categories"
    ON public.income_categories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- EXPENSE CATEGORIES POLICIES
-- ============================================
CREATE POLICY "Users can view own expense categories"
    ON public.expense_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense categories"
    ON public.expense_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense categories"
    ON public.expense_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense categories"
    ON public.expense_categories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- EXPENSE SUBCATEGORIES POLICIES
-- ============================================
CREATE POLICY "Users can view own expense subcategories"
    ON public.expense_subcategories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense subcategories"
    ON public.expense_subcategories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense subcategories"
    ON public.expense_subcategories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense subcategories"
    ON public.expense_subcategories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- SAVING CATEGORIES POLICIES
-- ============================================
CREATE POLICY "Users can view own saving categories"
    ON public.saving_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saving categories"
    ON public.saving_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saving categories"
    ON public.saving_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saving categories"
    ON public.saving_categories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- DEBT ITEMS POLICIES
-- ============================================
CREATE POLICY "Users can view own debt items"
    ON public.debt_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debt items"
    ON public.debt_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debt items"
    ON public.debt_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debt items"
    ON public.debt_items FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- MONTHLY BUDGETS POLICIES
-- ============================================
CREATE POLICY "Users can view own monthly budgets"
    ON public.monthly_budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly budgets"
    ON public.monthly_budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly budgets"
    ON public.monthly_budgets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly budgets"
    ON public.monthly_budgets FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- MONTHLY BUDGET ITEMS POLICIES
-- ============================================
CREATE POLICY "Users can view own monthly budget items"
    ON public.monthly_budget_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly budget items"
    ON public.monthly_budget_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly budget items"
    ON public.monthly_budget_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly budget items"
    ON public.monthly_budget_items FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- INVOICES POLICIES
-- ============================================
CREATE POLICY "Users can view own invoices"
    ON public.invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
    ON public.invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
    ON public.invoices FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
    ON public.invoices FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- GOALS POLICIES
-- ============================================
CREATE POLICY "Users can view own goals"
    ON public.goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
    ON public.goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
    ON public.goals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
    ON public.goals FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- RECURRING EXPENSES POLICIES
-- ============================================
CREATE POLICY "Users can view own recurring expenses"
    ON public.recurring_expenses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring expenses"
    ON public.recurring_expenses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring expenses"
    ON public.recurring_expenses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring expenses"
    ON public.recurring_expenses FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
-- Idempotent cleanup: an earlier schema version created a permissive INSERT
-- policy on this table that let any authenticated user insert fake
-- notifications. Drop it on every (re-)apply so upgraded projects can't be
-- left with it active.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- INSERT notifiche: solo service role (bypassa RLS). Nessuna policy client-side necessaria.

-- ============================================
-- ASSETS POLICIES (Investimenti)
-- ============================================
CREATE POLICY "Users can view own assets"
    ON public.assets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
    ON public.assets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
    ON public.assets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
    ON public.assets FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- HOLDINGS POLICIES (Investimenti)
-- ============================================
CREATE POLICY "Users can view own holdings"
    ON public.holdings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings"
    ON public.holdings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings"
    ON public.holdings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings"
    ON public.holdings FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- PRICE SNAPSHOTS POLICIES (Investimenti)
-- ============================================
-- Sola lettura per l'utente proprietario dell'asset referenziato (via join);
-- nessuna policy INSERT/UPDATE/DELETE lato client: il cron scrive con la
-- service role key, che bypassa RLS (stesso pattern di public.notifications).
CREATE POLICY "Users can view own price snapshots"
    ON public.price_snapshots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assets
            WHERE assets.id = price_snapshots.asset_id
              AND assets.user_id = auth.uid()
        )
    );

-- ============================================
-- ISIN TICKER LOOKUP POLICIES (Investimenti)
-- ============================================
-- Dato di riferimento condiviso: sola lettura per utenti autenticati,
-- nessuna scrittura client-side (manutenzione manuale via SQL Editor).
CREATE POLICY "Authenticated users can view isin ticker lookup"
    ON public.isin_ticker_lookup FOR SELECT
    TO authenticated
    USING (true);

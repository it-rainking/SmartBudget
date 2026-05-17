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
-- NOTIFICATIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- System can insert notifications (via service role)
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

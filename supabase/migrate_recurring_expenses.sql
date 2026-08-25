-- ============================================
-- SPESE RICORRENTI (pannello /spese-ricorrenti)
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Introduce i "modelli" di spesa ricorrente: importo, categoria, giorno del
-- mese, gestiti dal pannello /spese-ricorrenti. Ogni occorrenza mensile
-- generata resta una normale riga in `transactions` (pesa su KPI/budget del
-- proprio mese fin da subito, come le rate PayPal), collegata al modello
-- tramite `transactions.recurring_expense_id`.

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.expense_subcategories(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    payment_method TEXT,
    notes TEXT,
    start_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_expense_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_recurring_expense_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_recurring_expense_id_fkey
      FOREIGN KEY (recurring_expense_id) REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id ON public.recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_active ON public.recurring_expenses(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_expense
  ON public.transactions(recurring_expense_id)
  WHERE recurring_expense_id IS NOT NULL;

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can view own recurring expenses"
    ON public.recurring_expenses FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can insert own recurring expenses"
    ON public.recurring_expenses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can update own recurring expenses"
    ON public.recurring_expenses FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can delete own recurring expenses"
    ON public.recurring_expenses FOR DELETE
    USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_recurring_expenses_updated_at'
  ) THEN
    CREATE TRIGGER update_recurring_expenses_updated_at
      BEFORE UPDATE ON public.recurring_expenses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

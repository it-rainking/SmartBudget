-- ============================================
-- CONFRONTO FONDO PENSIONE (/fondo-pensione)
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Una riga per utente con i dati inseriti nel confronto (rendimento del
-- comparto, retribuzione, contributi, orizzonte...). I campi stanno in un
-- jsonb: sono parametri di una simulazione, non dati contabili, e la loro
-- forma segue lo strumento (normalizeParams in src/lib/pension/compare.ts).

CREATE TABLE IF NOT EXISTS public.pension_comparisons (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.pension_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pension comparison" ON public.pension_comparisons;
CREATE POLICY "Users can view own pension comparison"
    ON public.pension_comparisons FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pension comparison" ON public.pension_comparisons;
CREATE POLICY "Users can insert own pension comparison"
    ON public.pension_comparisons FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pension comparison" ON public.pension_comparisons;
CREATE POLICY "Users can update own pension comparison"
    ON public.pension_comparisons FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pension comparison" ON public.pension_comparisons;
CREATE POLICY "Users can delete own pension comparison"
    ON public.pension_comparisons FOR DELETE
    USING (auth.uid() = user_id);

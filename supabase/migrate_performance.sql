-- ============================================
-- OTTIMIZZAZIONI DI PERFORMANCE
-- Eseguire una volta nel SQL Editor di Supabase (si può rieseguire)
-- ============================================

-- 1. Saldo di apertura calcolato nel DB
-- La dashboard mensile scaricava tutte le transazioni precedenti al mese per
-- sommarle nel browser: payload che cresce con lo storico e, oltre le 1000
-- righe (limite di default delle API Supabase), una somma troncata in
-- silenzio. Qui la somma torna come un solo numero.
-- SECURITY INVOKER: valgono le policy RLS dell'utente che chiama.
CREATE OR REPLACE FUNCTION public.get_balance_flow_before(p_date DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
    FROM public.transactions
    WHERE user_id = (SELECT auth.uid())
      AND date < p_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_balance_flow_before(DATE) TO authenticated;

-- 2. Policy RLS: auth.uid() valutato una volta per query, non per riga
-- `auth.uid() = user_id` richiama la funzione su ogni riga letta;
-- `(SELECT auth.uid()) = user_id` diventa un initPlan calcolato una volta
-- sola (raccomandazione del Performance Advisor di Supabase). Il controllo
-- di sicurezza è identico. Le policy già convertite vengono saltate.
DO $$
DECLARE
    pol RECORD;
    new_qual TEXT;
    new_check TEXT;
    stmt TEXT;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
              (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%SELECT auth.uid()%')
              OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%SELECT auth.uid()%')
          )
    LOOP
        new_qual := replace(pol.qual, 'auth.uid()', '(SELECT auth.uid())');
        new_check := replace(pol.with_check, 'auth.uid()', '(SELECT auth.uid())');
        stmt := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        IF new_qual IS NOT NULL THEN
            stmt := stmt || format(' USING (%s)', new_qual);
        END IF;
        IF new_check IS NOT NULL THEN
            stmt := stmt || format(' WITH CHECK (%s)', new_check);
        END IF;
        EXECUTE stmt;
    END LOOP;
END $$;

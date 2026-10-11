-- ============================================
-- DOPPIONI CONFERMATI COME "NON DOPPIONI" (/transazioni)
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Ogni riga è una coppia di transazioni che l'utente ha confermato come
-- distinte: il controllo doppioni della lista transazioni non la mostra più.
-- La coppia è salvata in ordine (transaction_a < transaction_b) così ha una
-- sola rappresentazione. Eliminando una delle due transazioni la riga sparisce.

CREATE TABLE IF NOT EXISTS public.dismissed_duplicates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    transaction_a UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
    transaction_b UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (transaction_a < transaction_b),
    UNIQUE (user_id, transaction_a, transaction_b)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_duplicates_user ON public.dismissed_duplicates(user_id);

ALTER TABLE public.dismissed_duplicates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dismissed duplicates" ON public.dismissed_duplicates;
CREATE POLICY "Users can view own dismissed duplicates"
    ON public.dismissed_duplicates FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dismissed duplicates" ON public.dismissed_duplicates;
CREATE POLICY "Users can insert own dismissed duplicates"
    ON public.dismissed_duplicates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dismissed duplicates" ON public.dismissed_duplicates;
CREATE POLICY "Users can delete own dismissed duplicates"
    ON public.dismissed_duplicates FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- MODULO INVESTIMENTI — prezzi inseriti a mano
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- I titoli di stato quotati sul MOT (BTP, titoli greci) non hanno un ticker
-- utilizzabile su Google Finance o Yahoo: restano quindi valorizzati al costo
-- di carico, e il loro P&L è fermo a zero. Per quelle posizioni serve un
-- prezzo che l'utente aggiorna quando vuole, letto dal riepilogo come ripiego
-- quando non esiste una quotazione di mercato.
--
-- Una riga per (utente, asset), aggiornata in place: interessa l'ultimo prezzo
-- noto, non la serie storica.

CREATE TABLE IF NOT EXISTS public.manual_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    -- Nella stessa unità del prezzo di mercato: per i titoli quotati in
    -- percentuale del nominale si inserisce la percentuale (es. 96,44), non il
    -- controvalore — ci pensa price_divisor.
    price NUMERIC(18,6) NOT NULL CHECK (price > 0),
    -- Data a cui il prezzo si riferisce, scelta dall'utente: un prezzo di
    -- settimana scorsa dichiarato tale è utile, spacciato per attuale no.
    priced_at DATE DEFAULT CURRENT_DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_manual_prices_user_asset ON public.manual_prices(user_id, asset_id);

ALTER TABLE public.manual_prices ENABLE ROW LEVEL SECURITY;

-- Dato per-utente: a differenza di price_snapshots e fx_rates, qui l'utente
-- scrive dalla UI, quindi servono tutte e quattro le policy.
DROP POLICY IF EXISTS "Users can view own manual prices" ON public.manual_prices;
CREATE POLICY "Users can view own manual prices"
    ON public.manual_prices FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own manual prices" ON public.manual_prices;
CREATE POLICY "Users can insert own manual prices"
    ON public.manual_prices FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own manual prices" ON public.manual_prices;
CREATE POLICY "Users can update own manual prices"
    ON public.manual_prices FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own manual prices" ON public.manual_prices;
CREATE POLICY "Users can delete own manual prices"
    ON public.manual_prices FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ============================================
-- RPC: il riepilogo deve restituire anche il prezzo manuale
-- ============================================
-- Aggiungere colonne a un RETURNS TABLE richiede DROP + CREATE: CREATE OR
-- REPLACE fallisce con 42P13 perché cambia il tipo di ritorno.
DROP FUNCTION IF EXISTS public.get_investment_summary(UUID);

CREATE FUNCTION public.get_investment_summary(p_user_id UUID)
RETURNS TABLE (
    holding_id UUID,
    asset_id UUID,
    isin TEXT,
    ticker_gf TEXT,
    ticker_yahoo TEXT,
    name TEXT,
    asset_class TEXT,
    currency TEXT,
    price_divisor NUMERIC,
    quantity NUMERIC,
    avg_cost NUMERIC,
    imported_at TIMESTAMPTZ,
    last_price NUMERIC,
    change_pct NUMERIC,
    price_source TEXT,
    fetched_at TIMESTAMPTZ,
    manual_price NUMERIC,
    manual_priced_at DATE
) AS $$
BEGIN
    -- SECURITY DEFINER bypassa RLS: l'ownership va verificata esplicitamente.
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
        a.price_divisor,
        h.quantity,
        h.avg_cost,
        h.imported_at,
        ps.price,
        ps.change_pct,
        ps.source,
        ps.fetched_at,
        mp.price,
        mp.priced_at
    FROM public.holdings h
    JOIN public.assets a ON a.id = h.asset_id
    LEFT JOIN LATERAL (
        SELECT price_snapshots.price, price_snapshots.change_pct, price_snapshots.source, price_snapshots.fetched_at
        FROM public.price_snapshots
        WHERE price_snapshots.asset_id = a.id
        ORDER BY price_snapshots.fetched_at DESC
        LIMIT 1
    ) ps ON true
    LEFT JOIN public.manual_prices mp ON mp.asset_id = a.id AND mp.user_id = p_user_id
    WHERE h.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICA (dopo l'apply)
-- ============================================
-- select isin, name, last_price, manual_price, manual_priced_at
--   from public.get_investment_summary(auth.uid());
--   -> le posizioni senza quotazione hanno last_price NULL; dopo il primo
--      inserimento dalla pagina investimenti compare manual_price

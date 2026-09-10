-- ============================================
-- MODULO INVESTIMENTI — quotazione in percentuale + classe "bond"
-- Eseguire una volta nel SQL Editor di Supabase (dopo migrate_investments.sql)
-- ============================================
--
-- Le obbligazioni sono quotate in percentuale del valore nominale: Fineco
-- riporta la quantità come nominale (es. 10.000) e il prezzo come percentuale
-- (es. 98,50). Il controvalore è quindi quantità * prezzo / 100, non
-- quantità * prezzo. Senza questa informazione il portafoglio sovrastimava le
-- posizioni obbligazionarie di 100 volte.
--
-- price_divisor tiene esplicito il fattore di quotazione (1 per azioni/ETF,
-- 100 per titoli quotati in percentuale) invece di dedurlo dalla classe: la
-- classe è una scelta di presentazione, il divisore è un fatto di mercato.

-- 1. Fattore di quotazione
ALTER TABLE public.assets
    ADD COLUMN IF NOT EXISTS price_divisor NUMERIC(10,4) NOT NULL DEFAULT 1;

ALTER TABLE public.assets
    DROP CONSTRAINT IF EXISTS assets_price_divisor_check;
ALTER TABLE public.assets
    ADD CONSTRAINT assets_price_divisor_check CHECK (price_divisor > 0);

-- 2. Nuova classe 'bond' per le obbligazioni dirette (distinte dagli ETF
--    obbligazionari, che restano 'etf_bond' e non sono quotati in percentuale).
ALTER TABLE public.assets
    DROP CONSTRAINT IF EXISTS assets_asset_class_check;
ALTER TABLE public.assets
    ADD CONSTRAINT assets_asset_class_check
    CHECK (asset_class IN ('etf_equity', 'etf_bond', 'etf_thematic', 'stock', 'bond', 'cash', 'other'));

ALTER TABLE public.isin_ticker_lookup
    DROP CONSTRAINT IF EXISTS isin_ticker_lookup_asset_class_check;
ALTER TABLE public.isin_ticker_lookup
    ADD CONSTRAINT isin_ticker_lookup_asset_class_check
    CHECK (asset_class IN ('etf_equity', 'etf_bond', 'etf_thematic', 'stock', 'bond', 'cash', 'other'));

-- 3. Il riepilogo deve esporre il divisore: il controvalore si calcola nella
--    API route e senza questo campo non saprebbe quando dividere.
--
-- La funzione va eliminata prima di ricrearla: aggiungere una colonna al
-- RETURNS TABLE cambia il tipo di ritorno, e CREATE OR REPLACE non lo consente
-- ("cannot change return type of existing function").
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
    fetched_at TIMESTAMPTZ
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICA (dopo l'apply)
-- ============================================
-- select isin, name, asset_class, price_divisor from public.assets order by asset_class;
--   -> le obbligazioni importate dal CSV devono avere price_divisor = 100

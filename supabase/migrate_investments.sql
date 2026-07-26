-- ============================================
-- MODULO INVESTIMENTI
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Aggiunge le tabelle per il modulo /investimenti: portafoglio importato da
-- CSV Fineco (source of truth) e prezzi live letti da un Google Sheet ponte
-- (formule GOOGLEFINANCE) con fallback Yahoo Finance.
--
-- Tabelle:
--   assets              - un asset (ISIN) per utente
--   holdings            - quantità/carico posseduti per asset (snapshot, sostituito a ogni import)
--   price_snapshots     - storico prezzi, scritto solo dal cron (service role)
--   isin_ticker_lookup  - tabella di riferimento globale ISIN -> ticker Google Finance/Yahoo

-- ============================================
-- 1. ASSETS
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
-- 2. HOLDINGS
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
-- 3. PRICE SNAPSHOTS
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
-- 4. ISIN TICKER LOOKUP
-- ============================================
-- Tabella di riferimento globale (non per-utente): mappa ISIN noti al ticker
-- Google Finance / Yahoo. Popolata manualmente via SQL Editor; l'import CSV
-- la consulta per risolvere il ticker e non inventa mai un valore per ISIN
-- sconosciuti (l'asset viene comunque creato con ticker_gf vuoto).
CREATE TABLE public.isin_ticker_lookup (
    isin TEXT PRIMARY KEY,
    ticker_gf TEXT,
    ticker_yahoo TEXT,
    name TEXT,
    asset_class TEXT CHECK (asset_class IN ('etf_equity', 'etf_bond', 'etf_thematic', 'stock', 'cash', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Righe di esempio (pattern da estendere con i propri ISIN): ETF UCITS comuni.
INSERT INTO public.isin_ticker_lookup (isin, ticker_gf, ticker_yahoo, name, asset_class) VALUES
    ('IE00BK5BQT80', 'BIT:VWCE', 'VWCE.MI', 'Vanguard FTSE All-World UCITS ETF', 'etf_equity'),
    ('IE00B4L5Y983', 'BIT:SWDA', 'SWDA.MI', 'iShares Core MSCI World UCITS ETF', 'etf_equity')
ON CONFLICT (isin) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_holdings_user_id ON public.holdings(user_id);
CREATE INDEX idx_holdings_asset_id ON public.holdings(asset_id);
CREATE INDEX idx_price_snapshots_asset_fetched ON public.price_snapshots(asset_id, fetched_at DESC);

-- ============================================
-- TRIGGERS (updated_at)
-- ============================================
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_isin_ticker_lookup_updated_at BEFORE UPDATE ON public.isin_ticker_lookup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isin_ticker_lookup ENABLE ROW LEVEL SECURITY;

-- ASSETS POLICIES
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

-- HOLDINGS POLICIES
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

-- PRICE SNAPSHOTS POLICIES
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

-- ISIN TICKER LOOKUP POLICIES
-- Dato di riferimento condiviso: sola lettura per utenti autenticati,
-- nessuna scrittura client-side (manutenzione manuale via SQL Editor).
CREATE POLICY "Authenticated users can view isin ticker lookup"
    ON public.isin_ticker_lookup FOR SELECT
    TO authenticated
    USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Riepilogo portafoglio: join holdings <-> assets <-> ultimo price_snapshot
-- in una sola query (LATERAL). L'aggregazione (market_value, P&L, pesi,
-- badge di provenienza) resta lato API route (src/app/api/investments/summary).
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
-- TEST MANUALE (da eseguire in SQL Editor dopo l'apply)
-- ============================================
-- 1. Inserisci un asset/holding come utente autenticato (sostituisci l'UUID
--    con auth.uid() della sessione loggata, es. tramite l'app stessa o
--    "select auth.uid()" nell'editor con un JWT utente):
--
--    insert into public.assets (user_id, isin, ticker_gf, name, asset_class)
--    values (auth.uid(), 'IE00BK5BQT80', 'BIT:VWCE', 'Vanguard FTSE All-World', 'etf_equity');
--
-- 2. Verifica che un altro utente non veda la riga (RLS attiva):
--    query con il JWT di un secondo utente:
--    select * from public.assets; -- deve tornare 0 righe per l'asset sopra
--
-- 3. Verifica isin_ticker_lookup leggibile da qualunque utente autenticato:
--    select * from public.isin_ticker_lookup; -- deve tornare le righe seed

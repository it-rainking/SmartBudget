-- ============================================
-- MODULO INVESTIMENTI — cambi valuta
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Un portafoglio con posizioni in valute diverse non ha un totale finché i
-- valori non sono riportati a una valuta comune. I cambi sono un dato di
-- riferimento condiviso (non per-utente), scritti dal cron prezzi con la
-- service role key e letti da /api/investments/summary.
--
-- Una riga per coppia, aggiornata in place: dell'ultimo cambio noto serve solo
-- il valore corrente, non lo storico (a differenza di price_snapshots, che
-- tiene la serie per calcolare la variazione giornaliera).

CREATE TABLE IF NOT EXISTS public.fx_rates (
    base TEXT NOT NULL,
    quote TEXT NOT NULL,
    -- Quante unità di `quote` per una unità di `base`: con base USD, quote EUR
    -- e rate 0,92, 100 USD valgono 92 EUR.
    rate NUMERIC(18,8) NOT NULL CHECK (rate > 0),
    source TEXT NOT NULL CHECK (source IN ('gsheet', 'yahoo')),
    fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (base, quote)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Dato di riferimento condiviso: sola lettura per utenti autenticati, nessuna
-- scrittura client-side (scrive il cron con la service role key, che bypassa
-- RLS — stesso pattern di price_snapshots e isin_ticker_lookup).
DROP POLICY IF EXISTS "Authenticated users can view fx rates" ON public.fx_rates;
CREATE POLICY "Authenticated users can view fx rates"
    ON public.fx_rates FOR SELECT
    TO authenticated
    USING (true);

-- ============================================
-- VERIFICA (dopo il primo giro del cron prezzi)
-- ============================================
-- select base, quote, rate, source, fetched_at from public.fx_rates;
--   -> con posizioni in USD e valuta di conto EUR deve comparire USD -> EUR

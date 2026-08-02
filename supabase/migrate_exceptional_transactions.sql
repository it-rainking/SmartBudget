-- ============================================
-- MOVIMENTI ECCEZIONALI (esclusi dai trend)
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Aggiunge la colonna `is_exceptional` alla tabella transactions. Serve a
-- marcare entrate o spese una tantum di importo anomalo (es. acquisto auto,
-- rimborso, bonus straordinario) che non rappresentano le condizioni normali
-- del mese. I totali reali continuano a includerle, ma vengono escluse da
-- medie, delta mese su mese, trend annuali, stime e alert.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_exceptional BOOLEAN NOT NULL DEFAULT FALSE;

-- Le righe esistenti restano ordinarie (DEFAULT FALSE), nessun backfill necessario.

CREATE INDEX IF NOT EXISTS idx_transactions_user_exceptional
  ON public.transactions(user_id, is_exceptional);

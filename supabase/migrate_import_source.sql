-- ============================================
-- IMPORT ESTRATTI CONTO (Fineco, Revolut)
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- import_source: estratto da cui arriva la riga ('fineco', 'revolut'),
--   NULL per le transazioni inserite a mano o con il CSV generico.
-- external_id: impronta del movimento bancario (banca, data, importo,
--   descrizione). Reimportare lo stesso estratto non crea doppioni: le righe
--   con external_id già presente vengono scartate.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Indice unico: in Postgres i NULL sono distinti, quindi le transazioni
-- senza external_id non sono vincolate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_external_id
  ON public.transactions(user_id, external_id);

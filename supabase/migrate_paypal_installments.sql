-- ============================================
-- SPESE A RATE (PayPal "Paga in 3 rate")
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Aggiunge alla tabella `transactions` i campi che legano fra loro le rate di
-- una stessa spesa dilazionata. Le tre rate restano tre transazioni normali
-- (una per mese, stesso giorno), così continuano a contare nei KPI e nei
-- budget del mese in cui vengono effettivamente addebitate; i campi qui sotto
-- servono solo a ricostruire il piano di rateizzazione.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS installment_plan_id UUID,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS installment_count INTEGER;

-- Coerenza: o i tre campi sono tutti valorizzati (rata di un piano) o tutti
-- NULL (transazione normale), con 1 <= numero <= totale rate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_installment_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_installment_check CHECK (
        (installment_plan_id IS NULL AND installment_number IS NULL AND installment_count IS NULL)
        OR (
          installment_plan_id IS NOT NULL
          AND installment_count >= 2
          AND installment_number >= 1
          AND installment_number <= installment_count
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_installment_plan
  ON public.transactions(installment_plan_id)
  WHERE installment_plan_id IS NOT NULL;

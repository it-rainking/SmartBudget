-- ============================================
-- METODI DI PAGAMENTO PERSONALIZZABILI
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Aggiunge la colonna `payment_methods` (array di testo) alla tabella settings,
-- così ogni utente può gestire il proprio elenco di metodi di pagamento dalla
-- pagina Impostazioni. Il default replica la lista finora hardcoded nel client.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[]
  DEFAULT ARRAY['Contanti', 'Carta', 'Bonifico', 'PayPal', 'Altro'];

-- Popola le righe esistenti che non hanno ancora un valore.
UPDATE public.settings
SET payment_methods = ARRAY['Contanti', 'Carta', 'Bonifico', 'PayPal', 'Altro']
WHERE payment_methods IS NULL;

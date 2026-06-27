-- Normalizza i metodi di pagamento esistenti verso la nuova lista semplificata
-- Eseguire una volta in Supabase SQL Editor

UPDATE transactions
SET payment_method = 'Carta'
WHERE payment_method IN ('Carta di Credito', 'Carta di Debito');

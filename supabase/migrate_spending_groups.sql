-- ============================================
-- GRUPPI DI SPESA (metodo Kakebo)
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Aggiunge `spending_group` alle categorie di spesa: dice quanto è
-- necessaria una spesa, in modo indipendente da cosa si è comprato.
--   fixed     = uscite fisse (affitto, mutuo, utenze, abbonamenti)
--   essential = prima necessità (spesa, farmacia, trasporti)
--   optional  = optional (shopping, cosmetica, regali)
--   leisure   = cultura e tempo libero (ristoranti, bar, libri, spettacoli)
--   extra     = extra e imprevisti (riparazioni, spese mediche, viaggi)
-- NULL = non ancora assegnato: la dashboard lo mostra come "da classificare"
-- e l'utente lo sceglie da Impostazioni.

ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS spending_group TEXT
  CHECK (spending_group IN ('fixed', 'essential', 'optional', 'leisure', 'extra'));

-- Valori iniziali per le categorie di default (create da seed_categories.sql
-- o da migrate_categories_v2.sql). Tocca solo le righe ancora senza gruppo,
-- quindi si può rieseguire senza perdere le scelte fatte a mano.
UPDATE public.expense_categories SET spending_group = CASE name
    WHEN 'Casa'            THEN 'fixed'
    WHEN 'Utenze'          THEN 'fixed'
    WHEN 'Abbonamenti'     THEN 'fixed'
    WHEN 'Alimentari'      THEN 'essential'
    WHEN 'Trasporti'       THEN 'essential'
    WHEN 'Salute'          THEN 'essential'
    WHEN 'Istruzione'      THEN 'essential'
    WHEN 'Shopping'        THEN 'optional'
    WHEN 'Intrattenimento' THEN 'leisure'
    WHEN 'Ristoranti'      THEN 'leisure'
    WHEN 'Viaggi'          THEN 'extra'
    ELSE NULL
  END
WHERE spending_group IS NULL;

-- Per i nuovi utenti: rieseguire anche seed_categories.sql, che ora crea le
-- categorie di default con il gruppo già valorizzato.

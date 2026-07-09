-- ============================================
-- DEDUPLICA CATEGORIE DUPLICATE — utenti esistenti
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================
--
-- Contesto: prima che `create_default_categories` avesse la guardia di
-- idempotenza, la funzione poteva essere invocata due volte per lo stesso
-- utente (una durante l'onboarding via `useCompleteOnboarding`, una tramite
-- il pulsante "Inizializza Categorie" in /transazioni). Il risultato è l'intero
-- set di categorie default duplicato: in UI ogni categoria compariva due volte.
--
-- Questo script unisce i duplicati per (user_id, name): mantiene la riga più
-- vecchia, riassegna le righe collegate (transazioni, sottocategorie, voci di
-- budget) alla riga mantenuta, poi elimina i duplicati. Infine crea indici
-- univoci parziali che impediscono la ricomparsa di duplicati attivi.

BEGIN;

-- ---------- EXPENSE CATEGORIES ----------
-- Mappa ogni categoria spesa al "keeper" (più vecchia) del suo gruppo (user_id, name).
CREATE TEMP TABLE _expense_dupes ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (PARTITION BY user_id, name ORDER BY created_at, id) AS keep_id
FROM public.expense_categories;

-- Riassegna le sottocategorie ai keeper.
UPDATE public.expense_subcategories es
SET category_id = d.keep_id
FROM _expense_dupes d
WHERE es.category_id = d.id AND d.id <> d.keep_id;

-- Riassegna le transazioni di spesa ai keeper.
UPDATE public.transactions t
SET category_id = d.keep_id
FROM _expense_dupes d
WHERE t.category_id = d.id AND d.id <> d.keep_id AND t.type = 'expense';

-- Voci di budget: elimina quelle sui duplicati che entrerebbero in conflitto
-- con il keeper (stesso budget/tipo/categoria), poi riassegna le rimanenti.
DELETE FROM public.monthly_budget_items bi
USING _expense_dupes d
WHERE bi.category_id = d.id AND d.id <> d.keep_id
  AND bi.category_type = 'expense'
  AND EXISTS (
    SELECT 1 FROM public.monthly_budget_items k
    WHERE k.budget_id = bi.budget_id
      AND k.category_type = 'expense'
      AND k.category_id = d.keep_id
  );

UPDATE public.monthly_budget_items bi
SET category_id = d.keep_id
FROM _expense_dupes d
WHERE bi.category_id = d.id AND d.id <> d.keep_id AND bi.category_type = 'expense';

-- Elimina le categorie spesa duplicate.
DELETE FROM public.expense_categories ec
USING _expense_dupes d
WHERE ec.id = d.id AND d.id <> d.keep_id;

-- ---------- INCOME CATEGORIES ----------
CREATE TEMP TABLE _income_dupes ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (PARTITION BY user_id, name ORDER BY created_at, id) AS keep_id
FROM public.income_categories;

UPDATE public.transactions t
SET category_id = d.keep_id
FROM _income_dupes d
WHERE t.category_id = d.id AND d.id <> d.keep_id AND t.type = 'income';

DELETE FROM public.monthly_budget_items bi
USING _income_dupes d
WHERE bi.category_id = d.id AND d.id <> d.keep_id
  AND bi.category_type = 'income'
  AND EXISTS (
    SELECT 1 FROM public.monthly_budget_items k
    WHERE k.budget_id = bi.budget_id
      AND k.category_type = 'income'
      AND k.category_id = d.keep_id
  );

UPDATE public.monthly_budget_items bi
SET category_id = d.keep_id
FROM _income_dupes d
WHERE bi.category_id = d.id AND d.id <> d.keep_id AND bi.category_type = 'income';

DELETE FROM public.income_categories ic
USING _income_dupes d
WHERE ic.id = d.id AND d.id <> d.keep_id;

-- ---------- SAVING CATEGORIES ----------
CREATE TEMP TABLE _saving_dupes ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (PARTITION BY user_id, name ORDER BY created_at, id) AS keep_id
FROM public.saving_categories;

UPDATE public.transactions t
SET category_id = d.keep_id
FROM _saving_dupes d
WHERE t.category_id = d.id AND d.id <> d.keep_id AND t.type = 'saving';

DELETE FROM public.monthly_budget_items bi
USING _saving_dupes d
WHERE bi.category_id = d.id AND d.id <> d.keep_id
  AND bi.category_type = 'saving'
  AND EXISTS (
    SELECT 1 FROM public.monthly_budget_items k
    WHERE k.budget_id = bi.budget_id
      AND k.category_type = 'saving'
      AND k.category_id = d.keep_id
  );

UPDATE public.monthly_budget_items bi
SET category_id = d.keep_id
FROM _saving_dupes d
WHERE bi.category_id = d.id AND d.id <> d.keep_id AND bi.category_type = 'saving';

DELETE FROM public.saving_categories sc
USING _saving_dupes d
WHERE sc.id = d.id AND d.id <> d.keep_id;

-- ---------- GUARDIA CONTRO DUPLICATI FUTURI ----------
-- Indice univoco parziale sulle sole categorie attive: due categorie attive
-- con lo stesso nome per lo stesso utente non sono più consentite. Le categorie
-- eliminate soft (is_active = false) restano fuori dal vincolo, così un nome può
-- essere riutilizzato dopo la disattivazione.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_expense_categories_user_name_active
  ON public.expense_categories (user_id, name) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_income_categories_user_name_active
  ON public.income_categories (user_id, name) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saving_categories_user_name_active
  ON public.saving_categories (user_id, name) WHERE is_active;

COMMIT;

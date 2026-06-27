-- ============================================
-- MIGRAZIONE CATEGORIE v2 — utenti esistenti
-- Eseguire una volta nel SQL Editor di Supabase
-- ============================================

-- 1. Elimina categorie risparmio rimosse
--    Le transazioni collegate diventano non categorizzate (category_id → NULL)
UPDATE transactions
SET category_id = NULL
WHERE type = 'saving'
  AND category_id IN (
    SELECT id FROM saving_categories
    WHERE name IN ('Fondo Emergenza', 'Casa', 'Vacanze')
  );

DELETE FROM saving_categories
WHERE name IN ('Fondo Emergenza', 'Casa', 'Vacanze');

-- Risistemica sort_order risparmi rimasti
UPDATE saving_categories sc
SET sort_order = sub.new_order
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY sort_order) AS new_order
    FROM saving_categories
) sub
WHERE sc.id = sub.id;


-- 2. Unisci "Ristoranti" in "Intrattenimento"
--    Riassegna le transazioni e poi elimina la categoria Ristoranti
UPDATE transactions t
SET category_id = (
    SELECT ec.id FROM expense_categories ec
    WHERE ec.user_id = (
        SELECT user_id FROM expense_categories WHERE id = t.category_id
    )
    AND ec.name = 'Intrattenimento'
    LIMIT 1
)
WHERE t.category_id IN (
    SELECT id FROM expense_categories WHERE name = 'Ristoranti'
);

DELETE FROM expense_subcategories
WHERE category_id IN (SELECT id FROM expense_categories WHERE name = 'Ristoranti');

DELETE FROM expense_categories WHERE name = 'Ristoranti';

-- Risistemica sort_order spese
UPDATE expense_categories ec
SET sort_order = sub.new_order
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY sort_order) AS new_order
    FROM expense_categories
) sub
WHERE ec.id = sub.id;


-- 3. Aggiungi sottocategorie ad "Alimentari" (solo se non esistono già)
INSERT INTO expense_subcategories (category_id, user_id, name, icon, sort_order)
SELECT ec.id, ec.user_id, sub.name, sub.icon, sub.sort_order
FROM expense_categories ec
CROSS JOIN (VALUES
    ('Conad',  '🏪', 1),
    ('Pane',   '🍞', 2),
    ('Frutta', '🍎', 3)
) AS sub(name, icon, sort_order)
WHERE ec.name = 'Alimentari'
  AND NOT EXISTS (
      SELECT 1 FROM expense_subcategories es
      WHERE es.category_id = ec.id AND es.name = sub.name
  );


-- 4. Aggiungi sottocategorie ad "Intrattenimento" (Ristoranti + altre se non esistono)
INSERT INTO expense_subcategories (category_id, user_id, name, icon, sort_order)
SELECT ec.id, ec.user_id, sub.name, sub.icon, sub.sort_order
FROM expense_categories ec
CROSS JOIN (VALUES
    ('Ristoranti', '🍽️', 1),
    ('Cinema',     '🎥', 2),
    ('Sport',      '⚽', 3),
    ('Musica',     '🎵', 4)
) AS sub(name, icon, sort_order)
WHERE ec.name = 'Intrattenimento'
  AND NOT EXISTS (
      SELECT 1 FROM expense_subcategories es
      WHERE es.category_id = ec.id AND es.name = sub.name
  );

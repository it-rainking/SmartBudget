-- ============================================
-- SMARTBUDGET DEFAULT CATEGORIES
-- Run this function during user onboarding
-- ============================================

CREATE OR REPLACE FUNCTION public.create_default_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Default Income Categories
    INSERT INTO public.income_categories (user_id, name, icon, color, sort_order) VALUES
    (p_user_id, 'Stipendio',     '💼', '#10b981', 1),
    (p_user_id, 'Freelance',     '💻', '#059669', 2),
    (p_user_id, 'Investimenti',  '📈', '#047857', 3),
    (p_user_id, 'Bonus',         '🎁', '#065f46', 4),
    (p_user_id, 'Altro Reddito', '💰', '#064e3b', 5);

    -- Default Expense Categories
    INSERT INTO public.expense_categories (user_id, name, icon, color, sort_order) VALUES
    (p_user_id, 'Casa',            '🏠', '#ef4444',  1),
    (p_user_id, 'Trasporti',       '🚗', '#f97316',  2),
    (p_user_id, 'Alimentari',      '🛒', '#eab308',  3),
    (p_user_id, 'Utenze',          '💡', '#84cc16',  4),
    (p_user_id, 'Salute',          '🏥', '#22c55e',  5),
    (p_user_id, 'Intrattenimento', '🎬', '#14b8a6',  6),
    (p_user_id, 'Shopping',        '🛍️', '#06b6d4',  7),
    (p_user_id, 'Istruzione',      '📚', '#6366f1',  8),
    (p_user_id, 'Viaggi',          '✈️', '#8b5cf6',  9),
    (p_user_id, 'Abbonamenti',     '📱', '#a855f7', 10),
    (p_user_id, 'Altro',           '📦', '#71717a', 11);

    -- Subcategories for Casa
    INSERT INTO public.expense_subcategories (category_id, user_id, name, icon, sort_order)
    SELECT id, p_user_id, sub.name, sub.icon, sub.sort_order
    FROM public.expense_categories ec,
    (VALUES
        ('Affitto',      '🔑', 1),
        ('Mutuo',        '🏦', 2),
        ('Manutenzione', '🔧', 3),
        ('Arredamento',  '🛋️', 4)
    ) AS sub(name, icon, sort_order)
    WHERE ec.user_id = p_user_id AND ec.name = 'Casa';

    -- Subcategories for Trasporti
    INSERT INTO public.expense_subcategories (category_id, user_id, name, icon, sort_order)
    SELECT id, p_user_id, sub.name, sub.icon, sub.sort_order
    FROM public.expense_categories ec,
    (VALUES
        ('Carburante',        '⛽', 1),
        ('Assicurazione Auto','📋', 2),
        ('Manutenzione Auto', '🔧', 3),
        ('Trasporto Pubblico','🚌', 4),
        ('Parcheggio',        '🅿️', 5)
    ) AS sub(name, icon, sort_order)
    WHERE ec.user_id = p_user_id AND ec.name = 'Trasporti';

    -- Subcategories for Alimentari
    INSERT INTO public.expense_subcategories (category_id, user_id, name, icon, sort_order)
    SELECT id, p_user_id, sub.name, sub.icon, sub.sort_order
    FROM public.expense_categories ec,
    (VALUES
        ('Conad',  '🏪', 1),
        ('Pane',   '🍞', 2),
        ('Frutta', '🍎', 3)
    ) AS sub(name, icon, sort_order)
    WHERE ec.user_id = p_user_id AND ec.name = 'Alimentari';

    -- Subcategories for Utenze
    INSERT INTO public.expense_subcategories (category_id, user_id, name, icon, sort_order)
    SELECT id, p_user_id, sub.name, sub.icon, sub.sort_order
    FROM public.expense_categories ec,
    (VALUES
        ('Elettricità', '⚡', 1),
        ('Gas',         '🔥', 2),
        ('Acqua',       '💧', 3),
        ('Internet',    '🌐', 4),
        ('Telefono',    '📞', 5)
    ) AS sub(name, icon, sort_order)
    WHERE ec.user_id = p_user_id AND ec.name = 'Utenze';

    -- Subcategories for Intrattenimento (include Ristoranti)
    INSERT INTO public.expense_subcategories (category_id, user_id, name, icon, sort_order)
    SELECT id, p_user_id, sub.name, sub.icon, sub.sort_order
    FROM public.expense_categories ec,
    (VALUES
        ('Ristoranti', '🍽️', 1),
        ('Cinema',     '🎥', 2),
        ('Sport',      '⚽', 3),
        ('Musica',     '🎵', 4)
    ) AS sub(name, icon, sort_order)
    WHERE ec.user_id = p_user_id AND ec.name = 'Intrattenimento';

    -- Default Saving Categories
    INSERT INTO public.saving_categories (user_id, name, icon, color, sort_order) VALUES
    (p_user_id, 'Pensione',      '👴', '#14b8a6', 1),
    (p_user_id, 'Investimenti',  '📊', '#10b981', 2),
    (p_user_id, 'Altro',         '🎯', '#71717a', 3);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Auto-create categories on profile creation
-- Uncomment if you want categories created automatically
/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

    INSERT INTO public.settings (user_id)
    VALUES (NEW.id);

    -- Create default categories
    PERFORM public.create_default_categories(NEW.id);

    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;
*/

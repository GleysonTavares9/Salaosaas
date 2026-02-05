-- ==========================================================
-- FIX: Configurar CASCADE DELETE para reviews
-- Problema: Não consegue deletar appointments que têm reviews
-- Solução: Alterar FK para ON DELETE CASCADE
-- ==========================================================

-- 1. REMOVER A CONSTRAINT ANTIGA
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_appointment_id_fkey;

-- 2. RECRIAR A CONSTRAINT COM CASCADE DELETE
ALTER TABLE public.reviews
ADD CONSTRAINT reviews_appointment_id_fkey 
FOREIGN KEY (appointment_id) 
REFERENCES public.appointments(id) 
ON DELETE CASCADE;

-- 3. VERIFICAR A CONSTRAINT
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'reviews'
    AND kcu.column_name = 'appointment_id';

-- 4. MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Foreign Key atualizada com CASCADE DELETE!';
    RAISE NOTICE '✅ Agora ao deletar um appointment, as reviews serão deletadas automaticamente';
END $$;

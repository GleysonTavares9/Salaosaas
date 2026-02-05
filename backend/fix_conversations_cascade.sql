-- ==========================================================
-- FIX: Configurar CASCADE DELETE para conversations
-- Problema: Não consegue criar/atualizar users por causa de FK
-- Solução: Alterar FK para ON DELETE CASCADE
-- ==========================================================

-- 1. REMOVER AS CONSTRAINTS ANTIGAS
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user1_id_fkey;

ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey;

-- 2. RECRIAR AS CONSTRAINTS COM CASCADE DELETE
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user1_id_fkey 
FOREIGN KEY (user1_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user2_id_fkey 
FOREIGN KEY (user2_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 3. VERIFICAR AS CONSTRAINTS
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
    AND tc.table_name = 'conversations'
    AND (kcu.column_name = 'user1_id' OR kcu.column_name = 'user2_id');

-- 4. MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Foreign Keys atualizadas com CASCADE DELETE!';
    RAISE NOTICE '✅ Agora ao deletar um user, as conversations serão deletadas automaticamente';
END $$;

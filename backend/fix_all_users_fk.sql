-- ==========================================================
-- FIX: Configurar CASCADE DELETE para TODAS as tabelas relacionadas a users
-- Problema: Não consegue criar/atualizar users por causa de múltiplas FKs
-- Solução: Alterar TODAS as FKs para ON DELETE CASCADE
-- ==========================================================

-- 1. MESSAGES TABLE
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. CONVERSATIONS TABLE (user1_id e user2_id)
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user1_id_fkey;

ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey;

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

-- 3. PROFESSIONALS TABLE (user_id)
ALTER TABLE public.professionals 
DROP CONSTRAINT IF EXISTS professionals_user_id_fkey;

ALTER TABLE public.professionals
ADD CONSTRAINT professionals_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL; -- SET NULL porque queremos manter o profissional mesmo se deletar o user

-- 4. PROFILES TABLE (id referencia auth.users)
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 5. VERIFICAR TODAS AS CONSTRAINTS
SELECT
    tc.table_name,
    tc.constraint_name,
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
    AND ccu.table_name = 'users'
ORDER BY tc.table_name, kcu.column_name;

-- 6. MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ TODAS as Foreign Keys relacionadas a users foram atualizadas!';
    RAISE NOTICE '✅ messages: CASCADE DELETE';
    RAISE NOTICE '✅ conversations: CASCADE DELETE';
    RAISE NOTICE '✅ professionals: SET NULL (mantém profissional)';
    RAISE NOTICE '✅ profiles: CASCADE DELETE';
END $$;

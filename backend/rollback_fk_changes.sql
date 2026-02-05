-- ==========================================================
-- REVERTER: Voltar Foreign Keys para NO ACTION (padrão seguro)
-- ==========================================================

-- 1. MESSAGES TABLE - Voltar para NO ACTION
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES auth.users(id) 
ON DELETE NO ACTION;

-- 2. CONVERSATIONS TABLE - Voltar para NO ACTION
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user1_id_fkey;

ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user1_id_fkey 
FOREIGN KEY (user1_id) 
REFERENCES auth.users(id) 
ON DELETE NO ACTION;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user2_id_fkey 
FOREIGN KEY (user2_id) 
REFERENCES auth.users(id) 
ON DELETE NO ACTION;

-- 3. PROFESSIONALS TABLE - Voltar para NO ACTION
ALTER TABLE public.professionals 
DROP CONSTRAINT IF EXISTS professionals_user_id_fkey;

ALTER TABLE public.professionals
ADD CONSTRAINT professionals_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE NO ACTION;

-- 4. PROFILES TABLE - Voltar para CASCADE (este precisa ser CASCADE)
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 5. MENSAGEM
DO $$
BEGIN
    RAISE NOTICE '✅ Foreign Keys revertidas para configuração segura!';
    RAISE NOTICE '⚠️ Tente fazer login novamente';
END $$;


-- ==========================================================
-- FIX: Vínculos de Chat com Perfis (JOIN FIX)
-- ==========================================================

-- 1. ADICIONAR CONSTRAINTS PARA PUBLIC.PROFILES (Permite JOIN no frontend)
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user1_profiles_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user1_profiles_fkey 
FOREIGN KEY (user1_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_user2_profiles_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_user2_profiles_fkey 
FOREIGN KEY (user2_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. GARANTIR QUE RLS PERMITE SELECT EM PROFILES PARA QUEM ESTÁ NO CHAT
DROP POLICY IF EXISTS "Ver perfis de contatos do chat" ON public.profiles;
CREATE POLICY "Ver perfis de contatos do chat" 
ON public.profiles FOR SELECT 
USING (true); -- Já existe uma política global de leitura, mas garantimos aqui

-- MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Vínculos de chat com perfis criados!';
    RAISE NOTICE '✅ Agora o sistema consegue carregar nomes e fotos no chat corretamente.';
END $$;

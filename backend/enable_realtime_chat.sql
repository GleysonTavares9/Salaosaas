
-- ==========================================================
-- REALTIME & SECURITY: Versão Corrigida para SQL Editor
-- ==========================================================

-- 1. Habilitar Realtime para as tabelas de chat
-- Primeiro removemos a publicação antiga para recriar de forma limpa
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Criamos a publicação incluindo as tabelas de mensagens e conversas
CREATE PUBLICATION supabase_realtime FOR TABLE public.messages, public.conversations;

-- 2. Garantir REPLICA IDENTITY FULL para que o payload venha completo (Necessário para filtros Realtime funcionar)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 3. Habilitar RLS (Segurança)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS PARA CONVERSATIONS (Conversas Privadas)
DROP POLICY IF EXISTS "Usuários podem ver suas próprias conversas" ON public.conversations;
CREATE POLICY "Usuários podem ver suas próprias conversas" 
ON public.conversations FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas conversas" ON public.conversations;
CREATE POLICY "Usuários podem atualizar suas conversas" 
ON public.conversations FOR UPDATE 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 5. POLÍTICAS PARA MESSAGES (Mensagens Privadas)
DROP POLICY IF EXISTS "Usuários podem ver mensagens das suas conversas" ON public.messages;
CREATE POLICY "Usuários podem ver mensagens das suas conversas" 
ON public.messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Usuários podem enviar mensagens" ON public.messages;
CREATE POLICY "Usuários podem enviar mensagens" 
ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- MENSAGEM DE SUCESSO NO LOG
DO $$
BEGIN
    RAISE NOTICE '✅ Realtime e Segurança configurados com sucesso!';
END $$;

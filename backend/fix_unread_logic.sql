
-- ==========================================================
-- FIX: DUAL UNREAD COUNTERS (WhatsApp Style)
-- ==========================================================

-- 1. Adicionar contadores específicos para cada usuário na conversa
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user1_unread_count integer DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user2_unread_count integer DEFAULT 0;

-- 2. Migrar dados antigos (opcional, mas bom ter)
UPDATE public.conversations SET user1_unread_count = unread_count, user2_unread_count = unread_count;

-- 3. Remover coluna antiga compartilhada
ALTER TABLE public.conversations DROP COLUMN IF EXISTS unread_count;

-- 4. Função de Sync atualizada para incrementar apenas o RECEPTOR
CREATE OR REPLACE FUNCTION public.handle_chat_message_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_user1_id uuid;
    v_user2_id uuid;
BEGIN
    -- Busca os IDs dos participantes
    SELECT user1_id, user2_id INTO v_user1_id, v_user2_id 
    FROM public.conversations WHERE id = NEW.conversation_id;

    -- Atualiza a conversa
    -- Se quem enviou (sender_id) foi o user1, incrementa o contador do user2 e vice-versa
    UPDATE public.conversations
    SET 
        last_message = NEW.text,
        user1_unread_count = CASE WHEN NEW.sender_id = v_user2_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN NEW.sender_id = v_user1_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função de marcar como lido atualizada para o usuário logado
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(p_conversation_id uuid)
RETURNS void AS $$
BEGIN
    -- Se o usuário logado for o user1, zeramos o contador dele. Se for o user2, o dele.
    UPDATE public.conversations
    SET 
        user1_unread_count = CASE WHEN auth.uid() = user1_id THEN 0 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN auth.uid() = user2_id THEN 0 ELSE user2_unread_count END
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC para envio de mensagem atualizado (opcional se já tiver o trigger, mas bom garantir)
CREATE OR REPLACE FUNCTION public.send_chat_message(
    p_conv_id uuid,
    p_sender_id uuid,
    p_text text
)
RETURNS jsonb AS $$
DECLARE
    v_msg_data record;
    v_user1_id uuid;
    v_user2_id uuid;
BEGIN
    -- Inserir mensagem (o trigger acima vai cuidar dos contadores, mas vamos garantir o retorno)
    INSERT INTO public.messages (conversation_id, sender_id, text)
    VALUES (p_conv_id, p_sender_id, p_text)
    RETURNING * INTO v_msg_data;

    RETURN to_jsonb(v_msg_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Sistema de contador duplo (WhatsApp style) ativado!';
END $$;

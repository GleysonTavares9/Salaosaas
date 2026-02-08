
-- ==========================================================
-- CHAT AUTOMATION: Triggers para Mensagens e Notificações
-- ==========================================================

-- 1. Função para atualizar a conversa quando uma mensagem chega
CREATE OR REPLACE FUNCTION public.handle_chat_message_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualiza a conversa com a última mensagem e timestamp
    UPDATE public.conversations
    SET 
        last_message = NEW.text,
        unread_count = unread_count + 1,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar o Trigger
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.messages;
CREATE TRIGGER on_chat_message_inserted
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_chat_message_sync();

-- 3. Função para enviar mensagem e atualizar tudo atomicamente (RPC)
CREATE OR REPLACE FUNCTION public.send_chat_message(
    p_conv_id uuid,
    p_sender_id uuid,
    p_text text
)
RETURNS jsonb AS $$
DECLARE
    v_msg_data record;
BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, text)
    VALUES (p_conv_id, p_sender_id, p_text)
    RETURNING * INTO v_msg_data;

    UPDATE public.conversations
    SET 
        last_message = p_text,
        unread_count = unread_count + 1,
        updated_at = NOW()
    WHERE id = p_conv_id;

    RETURN to_jsonb(v_msg_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para limpar notificações ao ler
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(p_conversation_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.conversations
    SET unread_count = 0
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Triggers de Chat configurados!';
    RAISE NOTICE '✅ Agora as mensagens atualizam automaticamente o contador e a última mensagem.';
END $$;

-- ==========================================================
-- FIX: Inteligência Aura (Ai Usage & RPC)
-- ==========================================================

-- 1. Ajustar Tabela de Uso de IA
-- O tipo 'character' sem tamanho é apenas 1 letra. Mudamos para TEXT.
ALTER TABLE public.ai_usage ALTER COLUMN month TYPE text;

-- Adicionar constraint de unicidade para permitir INSERT ... ON CONFLICT
ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_user_month_unique;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_user_month_unique UNIQUE (user_id, month);

-- 2. Criar RPC que a Edge Function chama
-- Passamos o ID do usuário explicitamente pois a Edge Function usa SERVICE_ROLE
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_user_id uuid, p_max_limit int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month text;
    v_count int;
BEGIN
    v_month := to_char(now(), 'YYYY-MM');

    INSERT INTO public.ai_usage (user_id, month, count)
    VALUES (p_user_id, v_month, 1)
    ON CONFLICT (user_id, month) 
    DO UPDATE SET count = ai_usage.count + 1
    RETURNING count INTO v_count;

    RETURN v_count <= p_max_limit;
END;
$$;

-- 3. Habilitar RLS e Permissões (Safety First)
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem o próprio uso" ON public.ai_usage;
CREATE POLICY "Usuários veem o próprio uso" ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);

GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, int) TO authenticated;

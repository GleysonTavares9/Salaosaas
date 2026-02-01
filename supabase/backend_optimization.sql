-- Migration Aura Backend Optimization
-- Date: 2026-01-31
-- Author: Antigravity

-- 0. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA DE CONTROLE DE USO AI
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    month CHAR(7) NOT NULL, -- Format: YYYY-MM
    count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, month)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own usage" ON public.ai_usage;
CREATE POLICY "Users can view their own usage" 
ON public.ai_usage FOR SELECT 
USING (auth.uid() = user_id);

-- 2. RPC: check_and_increment_usage
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_max_limit INTEGER DEFAULT 40)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_month CHAR(7) := to_char(now(), 'YYYY-MM');
    v_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;

    INSERT INTO public.ai_usage (user_id, month, count)
    VALUES (v_user_id, v_month, 1)
    ON CONFLICT (user_id, month) 
    DO UPDATE SET count = ai_usage.count + 1
    RETURNING count INTO v_count;

    IF v_count > p_max_limit THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: get_available_slots_rpc
-- Retorna slots livres para um profissional/data em uma única query
CREATE OR REPLACE FUNCTION public.get_available_slots_rpc(
    p_pro_id UUID,
    p_date DATE,
    p_duration_min INTEGER DEFAULT 30,
    p_client_now_min INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_salon_id UUID;
    v_day_key TEXT;
    v_schedule JSONB;
    v_open TIME;
    v_close TIME;
    v_slots TEXT[] := ARRAY[]::TEXT[];
    v_time TIME;
    v_is_conflict BOOLEAN;
    v_reference_min INTEGER;
BEGIN
    -- Buscar Salão e Horário de Funcionamento
    SELECT salon_id INTO v_salon_id FROM public.professionals WHERE id = p_pro_id;
    
    -- Identificar dia da semana (0=Domingo, 6=Sábado)
    v_day_key := (ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])[EXTRACT(DOW FROM p_date) + 1];

    SELECT (horario_funcionamento->v_day_key) INTO v_schedule FROM public.salons WHERE id = v_salon_id;

    IF v_schedule IS NULL OR (v_schedule->>'closed')::BOOLEAN = TRUE THEN
        RETURN jsonb_build_object('date', p_date, 'slots', ARRAY[]::TEXT[]);
    END IF;

    v_open := (v_schedule->>'open')::TIME;
    v_close := (v_schedule->>'close')::TIME;

    -- Gerar Slots e Validar Conflitos
    v_time := v_open;
    v_reference_min := COALESCE(p_client_now_min, -1);

    WHILE v_time < v_close LOOP
        -- Validação de "Agora" (Se for hoje)
        IF p_date = CURRENT_DATE AND (EXTRACT(HOUR FROM v_time) * 60 + EXTRACT(MINUTE FROM v_time)) < v_reference_min THEN
            v_time := v_time + interval '30 minutes';
            CONTINUE;
        END IF;

        -- Cabe o serviço inteiro antes de fechar?
        IF v_time + (p_duration_min || ' minutes')::interval > v_close THEN
            EXIT;
        END IF;

        -- Conflito de Agendamento (Overbooking)
        SELECT EXISTS (
            SELECT 1 FROM public.appointments
            WHERE professional_id = p_pro_id
            AND date = p_date
            AND status != 'cancelled'
            AND (
                -- Caso 1: Agendamento existente começa antes/durante o novo slot
                (time::TIME <= v_time AND (time::TIME + (duration_min || ' minutes')::interval) > v_time)
                OR 
                -- Caso 2: Novo slot termina dentro de um agendamento existente
                (time::TIME < (v_time + (p_duration_min || ' minutes')::interval) AND time::TIME >= v_time)
            )
        ) INTO v_is_conflict;

        IF NOT v_is_conflict THEN
            v_slots := array_append(v_slots, to_char(v_time, 'HH24:MI'));
        END IF;

        v_time := v_time + interval '30 minutes';
    END LOOP;

    RETURN jsonb_build_object(
        'date', p_date,
        'slots', v_slots
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: get_profile_by_phone (Seguro)
CREATE OR REPLACE FUNCTION public.get_profile_by_phone(p_phone TEXT)
RETURNS JSONB AS $$
DECLARE
    v_data JSONB;
BEGIN
    SELECT jsonb_build_object('id', id, 'email', email, 'full_name', full_name) 
    INTO v_data
    FROM public.profiles 
    WHERE phone = p_phone 
    LIMIT 1;

    RETURN v_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: get_profile_by_email (Busca híbrida Profile + Auth)
CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_data JSONB;
BEGIN
    -- 1. Tenta no profiles (Público)
    SELECT jsonb_build_object('id', id, 'email', email, 'full_name', full_name) 
    INTO v_data
    FROM public.profiles 
    WHERE LOWER(email) = LOWER(TRIM(p_email))
    LIMIT 1;

    -- 2. Se não achar, busca no Auth (Garante o ID se o trigger falhou)
    IF v_data IS NULL THEN
        SELECT jsonb_build_object('id', id, 'email', email, 'full_name', (raw_user_meta_data->>'full_name')) 
        INTO v_data
        FROM auth.users 
        WHERE LOWER(email) = LOWER(TRIM(p_email))
        LIMIT 1;
    END IF;

    RETURN v_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.1 RPC: admin_update_user_auth
CREATE OR REPLACE FUNCTION public.admin_update_user_auth(
    target_user_id UUID,
    new_email TEXT DEFAULT NULL,
    new_phone TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- 1. Atualiza o e-mail se necessário
  IF new_email IS NOT NULL AND new_email <> '' THEN
    UPDATE auth.users 
    SET email = LOWER(TRIM(new_email))
    WHERE id = target_user_id;
  END IF;

  -- 2. Atualiza o telefone se necessário
  IF new_phone IS NOT NULL AND new_phone <> '' THEN
    UPDATE auth.users 
    SET phone = new_phone
    WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FLEXIBILIZAÇÃO: Remove restrição de 'usuário único' para permitir multi-unidade
-- Isso resolve o erro 409 quando o mesmo e-mail tenta ser profissional em perfis diferentes.
ALTER TABLE IF EXISTS public.professionals DROP CONSTRAINT IF EXISTS professionals_user_id_key;
DROP INDEX IF EXISTS professionals_user_id_key;

-- 7. RPC: admin_manage_user_access (Criação de Acesso God Mode)
-- Permite ao Gestor criar/atualizar acessos de colaboradores sem confirmação de e-mail.
CREATE OR REPLACE FUNCTION public.admin_manage_user_access(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Verifica se já existe o usuário pelo e-mail
    SELECT id INTO v_user_id FROM auth.users WHERE email = LOWER(TRIM(p_email));

    IF v_user_id IS NULL THEN
        -- 2. Cria Usuário se não existir (Security Definer Bypassa limites)
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
            created_at, updated_at, confirmation_token, email_change, 
            email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 
            'authenticated', LOWER(TRIM(p_email)), extensions.crypt(p_password, extensions.gen_salt('bf')),
            now(), '{"provider": "email", "providers": ["email"]}', 
            jsonb_build_object('name', p_full_name, 'full_name', p_full_name, 'role', 'pro'),
            now(), now(), '', '', '', ''
        ) RETURNING id INTO v_user_id;
    ELSE
        -- 3. Atualiza Usuário se já existir (Sincroniza Metadados e Senha)
        UPDATE auth.users 
        SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
            raw_user_meta_data = raw_user_meta_data || jsonb_build_object('name', p_full_name, 'full_name', p_full_name, 'role', 'pro'),
            updated_at = now(),
            email_confirmed_at = now()
        WHERE id = v_user_id;

        -- Garante que o perfil no Profiles também esteja alinhado
        UPDATE public.profiles SET role = 'pro', full_name = p_full_name WHERE id = v_user_id;
    END IF;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

-- 8. RPC: safe_link_professional
CREATE OR REPLACE FUNCTION public.safe_link_professional(p_pro_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.professionals SET user_id = p_user_id WHERE id = p_pro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

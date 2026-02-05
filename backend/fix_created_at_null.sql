-- ==========================================================
-- FIX CRÍTICO: Corrigir created_at NULL em auth.users
-- ==========================================================

-- 1. CORRIGIR o usuário existente que está com created_at NULL
UPDATE auth.users
SET created_at = COALESCE(created_at, now())
WHERE email = 'gleysontavares9@yahoo.com';

-- 2. CORRIGIR TODOS os usuários com created_at NULL
UPDATE auth.users
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

-- 3. RECRIAR a função admin_manage_user_access com created_at correto
CREATE OR REPLACE FUNCTION public.admin_manage_user_access(
    p_email TEXT,
    p_password TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_existing_user_id UUID;
BEGIN
    p_email := LOWER(TRIM(p_email));
    
    -- Verificar se o usuário já existe
    SELECT id INTO v_existing_user_id
    FROM auth.users
    WHERE email = p_email;
    
    IF v_existing_user_id IS NOT NULL THEN
        -- ATUALIZAR usuário existente
        UPDATE auth.users
        SET 
            encrypted_password = extensions.crypt(COALESCE(p_password, 'Aura@123456'), extensions.gen_salt('bf')),
            raw_user_meta_data = jsonb_build_object('role', 'pro', 'name', p_full_name, 'full_name', p_full_name),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            created_at = COALESCE(created_at, now()), -- GARANTIR que created_at não seja NULL
            updated_at = now()
        WHERE id = v_existing_user_id;
        
        RETURN v_existing_user_id;
    ELSE
        -- CRIAR novo usuário
        v_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id, 
            instance_id, 
            email, 
            encrypted_password, 
            raw_app_meta_data, 
            raw_user_meta_data, 
            aud, 
            role,
            email_confirmed_at,
            created_at,  -- OBRIGATÓRIO
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            v_user_id, 
            '00000000-0000-0000-0000-000000000000', 
            p_email,
            extensions.crypt(COALESCE(p_password, 'Aura@123456'), extensions.gen_salt('bf')), 
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('role', 'pro', 'name', p_full_name, 'full_name', p_full_name), 
            'authenticated', 
            'authenticated',
            now(),       -- email_confirmed_at
            now(),       -- created_at - OBRIGATÓRIO!
            now(),       -- updated_at
            '',          -- confirmation_token
            '',          -- recovery_token
            '',          -- email_change_token_new
            ''           -- email_change
        );

        -- Vínculo de Identidade
        INSERT INTO auth.identities (
            id, 
            user_id, 
            identity_data, 
            provider, 
            provider_id, 
            last_sign_in_at, 
            created_at, 
            updated_at
        ) VALUES (
            gen_random_uuid(), 
            v_user_id, 
            jsonb_build_object('sub', v_user_id::text, 'email', p_email), 
            'email', 
            p_email, 
            now(), 
            now(), 
            now()
        );

        RETURN v_user_id;
    END IF;
END;
$$;

-- 4. Verificar se foi corrigido
SELECT 
    email,
    created_at,
    CASE 
        WHEN created_at IS NULL THEN '❌ AINDA NULL!'
        ELSE '✅ OK'
    END as status
FROM auth.users
WHERE email = 'gleysontavares9@yahoo.com';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ created_at corrigido para todos os usuários!';
    RAISE NOTICE '✅ Função admin_manage_user_access atualizada!';
    RAISE NOTICE '✅ Tente fazer login novamente!';
END $$;

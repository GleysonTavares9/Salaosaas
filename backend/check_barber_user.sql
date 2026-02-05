-- ==========================================================
-- VERIFICAR: Dados completos do usuário barbeiro
-- ==========================================================

-- 1. Verificar TODOS os campos do usuário
SELECT 
    id,
    email,
    encrypted_password IS NOT NULL as has_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    instance_id
FROM auth.users
WHERE email = 'gleysontavares9@yahoo.com';

-- 2. Verificar identities
SELECT 
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
FROM auth.identities
WHERE provider_id = 'gleysontavares9@yahoo.com';

-- 3. Verificar se há campos NULL problemáticos
SELECT 
    CASE 
        WHEN created_at IS NULL THEN '❌ created_at NULL'
        WHEN updated_at IS NULL THEN '❌ updated_at NULL'
        WHEN confirmation_token IS NULL THEN '❌ confirmation_token NULL'
        WHEN recovery_token IS NULL THEN '❌ recovery_token NULL'
        WHEN email_change_token_new IS NULL THEN '❌ email_change_token_new NULL'
        WHEN email_change IS NULL THEN '❌ email_change NULL'
        ELSE '✅ Todos os campos OK'
    END as status
FROM auth.users
WHERE email = 'gleysontavares9@yahoo.com';

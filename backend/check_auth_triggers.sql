-- ==========================================================
-- VERIFICAR E DESABILITAR: Triggers problemáticos em auth.users
-- ==========================================================

-- 1. Listar TODOS os triggers em auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
ORDER BY trigger_name;

-- 2. Verificar se há triggers customizados (não do Supabase)
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    CASE tgenabled
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
    END as status
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
    AND tgisinternal = false
ORDER BY tgname;

-- 3. Verificar o registro do usuário criado
SELECT 
    id,
    email,
    email_confirmed_at,
    encrypted_password IS NOT NULL as has_password,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at
FROM auth.users
WHERE email = 'gleysontavares9@yahoo.com';

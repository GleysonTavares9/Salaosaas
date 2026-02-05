-- ==========================================================
-- VERIFICAR: Triggers que podem estar causando erro
-- ==========================================================

-- 1. Listar todos os triggers em auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
ORDER BY trigger_name;

-- 2. Listar todos os triggers em public.profiles
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table = 'profiles'
ORDER BY trigger_name;

-- 3. Verificar se a função admin_manage_user_access existe e está correta
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE proname = 'admin_manage_user_access';

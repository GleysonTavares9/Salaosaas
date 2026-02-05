-- ==========================================================
-- DIAGNÓSTICO: Verificar o estado atual do schema
-- ==========================================================

-- 1. Verificar todas as Foreign Keys relacionadas a auth.users
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (ccu.table_name = 'users' OR tc.table_name IN ('messages', 'conversations', 'professionals', 'profiles'))
ORDER BY tc.table_name, kcu.column_name;

-- 2. Verificar se há problemas com triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('users', 'messages', 'conversations', 'professionals', 'profiles')
ORDER BY event_object_table, trigger_name;

-- 3. Verificar RLS nas tabelas
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('users', 'messages', 'conversations', 'professionals', 'profiles', 'appointments')
ORDER BY tablename;

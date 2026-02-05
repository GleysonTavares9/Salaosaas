-- ==========================================================
-- DIAGNÓSTICO: Verificar todas as políticas RLS ativas
-- ==========================================================

-- 1. Listar TODAS as políticas RLS em todas as tabelas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename, policyname;

-- 2. Verificar quais tabelas têm RLS habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS Ativo'
        ELSE '❌ RLS Desabilitado'
    END as status
FROM pg_tables
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- 3. Contar políticas por tabela
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname IN ('public', 'auth')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

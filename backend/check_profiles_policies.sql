-- ==========================================================
-- VERIFICAR: Políticas RLS da tabela profiles
-- ==========================================================

-- Listar todas as políticas da tabela profiles
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'profiles'
ORDER BY policyname;

-- Verificar se há políticas bloqueando SELECT durante login
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'profiles'
    AND cmd = 'SELECT'
ORDER BY policyname;

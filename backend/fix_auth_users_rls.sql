-- ==========================================================
-- FIX CRÍTICO: Desabilitar RLS na tabela auth.users
-- PROBLEMA: RLS habilitado em auth.users quebra a autenticação
-- SOLUÇÃO: Desabilitar RLS (Supabase Auth gerencia internamente)
-- ==========================================================

-- DESABILITAR RLS NA TABELA auth.users
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- VERIFICAR SE FOI DESABILITADO
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS ATIVO (PROBLEMA!)'
        ELSE '✅ RLS DESABILITADO (CORRETO)'
    END as status
FROM pg_tables
WHERE schemaname = 'auth' AND tablename = 'users';

-- MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ RLS DESABILITADO na tabela auth.users!';
    RAISE NOTICE '✅ Autenticação deve funcionar agora!';
    RAISE NOTICE '⚠️ NUNCA habilite RLS em auth.users - é gerenciada pelo Supabase Auth';
END $$;

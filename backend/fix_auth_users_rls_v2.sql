-- ==========================================================
-- FIX CRÍTICO: Desabilitar RLS na tabela auth.users
-- Usando função com SECURITY DEFINER para ter privilégios
-- ==========================================================

-- 1. Criar função com privilégios elevados
CREATE OR REPLACE FUNCTION public.fix_auth_users_rls()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Desabilitar RLS na tabela auth.users
    EXECUTE 'ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY';
    
    RETURN '✅ RLS desabilitado em auth.users com sucesso!';
EXCEPTION
    WHEN OTHERS THEN
        RETURN '❌ Erro: ' || SQLERRM;
END;
$$;

-- 2. Executar a função
SELECT public.fix_auth_users_rls();

-- 3. Remover a função (limpeza)
DROP FUNCTION IF EXISTS public.fix_auth_users_rls();

-- 4. Verificar o resultado
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

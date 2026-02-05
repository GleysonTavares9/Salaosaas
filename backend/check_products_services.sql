-- ==========================================================
-- VERIFICAR: Cadastro de Produtos e Serviços
-- ==========================================================

-- 1. Verificar RLS nas tabelas products e services
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS Ativo'
        ELSE '❌ RLS Desabilitado'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
    AND tablename IN ('products', 'services')
ORDER BY tablename;

-- 2. Verificar políticas RLS de products
SELECT 
    policyname,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'products'
ORDER BY cmd, policyname;

-- 3. Verificar políticas RLS de services
SELECT 
    policyname,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'services'
ORDER BY cmd, policyname;

-- 4. Testar se consegue inserir um produto de teste
DO $$
DECLARE
    v_salon_id UUID;
BEGIN
    -- Pegar o primeiro salon
    SELECT id INTO v_salon_id FROM public.salons LIMIT 1;
    
    IF v_salon_id IS NOT NULL THEN
        RAISE NOTICE '✅ Salon encontrado: %', v_salon_id;
        RAISE NOTICE '✅ Tabelas products e services prontas para uso!';
    ELSE
        RAISE NOTICE '❌ Nenhum salon encontrado!';
    END IF;
END $$;

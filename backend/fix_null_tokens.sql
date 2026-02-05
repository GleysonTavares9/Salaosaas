-- ==========================================================
-- FIX CRÍTICO: Corrigir campos NULL em auth.users
-- Problema: confirmation_token e outros campos NULL causam erro
-- Solução: Definir como string vazia ('') ao invés de NULL
-- ==========================================================

-- 1. CORRIGIR o usuário barbeiro
UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    updated_at = COALESCE(updated_at, now())
WHERE email = 'gleysontavares9@yahoo.com';

-- 2. CORRIGIR TODOS os usuários com campos NULL
UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, now())
WHERE 
    confirmation_token IS NULL 
    OR recovery_token IS NULL 
    OR email_change_token_new IS NULL 
    OR email_change IS NULL
    OR created_at IS NULL
    OR updated_at IS NULL;

-- 3. Verificar se foi corrigido
SELECT 
    email,
    confirmation_token = '' as token_ok,
    created_at IS NOT NULL as created_ok,
    updated_at IS NOT NULL as updated_ok,
    CASE 
        WHEN confirmation_token = '' 
         AND recovery_token = '' 
         AND email_change_token_new = '' 
         AND email_change = ''
         AND created_at IS NOT NULL
         AND updated_at IS NOT NULL
        THEN '✅ TUDO OK!'
        ELSE '❌ AINDA TEM PROBLEMA'
    END as status
FROM auth.users
WHERE email = 'gleysontavares9@yahoo.com';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Campos NULL corrigidos para strings vazias!';
    RAISE NOTICE '✅ Tente fazer login novamente!';
END $$;

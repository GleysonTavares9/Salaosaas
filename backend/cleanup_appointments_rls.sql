-- ==========================================================
-- LIMPEZA: Remover políticas duplicadas/antigas da tabela APPOINTMENTS
-- Manter apenas as políticas corretas e funcionais
-- ==========================================================

-- 1. REMOVER POLÍTICAS ANTIGAS/DUPLICADAS
DROP POLICY IF EXISTS "Pros update salon appointments" ON public.appointments;
DROP POLICY IF EXISTS "Pros view salon appointments" ON public.appointments;
DROP POLICY IF EXISTS "appts_insert" ON public.appointments;
DROP POLICY IF EXISTS "appts_select" ON public.appointments;
DROP POLICY IF EXISTS "appts_update" ON public.appointments;

-- 2. ADICIONAR POLÍTICA DE DELETE (estava faltando nas antigas)
DROP POLICY IF EXISTS "Pros delete salon appointments" ON public.appointments;
CREATE POLICY "Pros delete salon appointments" 
ON public.appointments 
FOR DELETE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM professionals 
        WHERE professionals.salon_id = appointments.salon_id 
        AND professionals.user_id = auth.uid()
    ) 
    OR EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_master = true
    )
);

-- 3. VERIFICAÇÃO FINAL
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN '👁️ Leitura'
        WHEN cmd = 'INSERT' THEN '➕ Criação'
        WHEN cmd = 'UPDATE' THEN '✏️ Atualização'
        WHEN cmd = 'DELETE' THEN '🗑️ Exclusão'
    END as operacao,
    CASE 
        WHEN policyname LIKE '%Cliente%' THEN '👤 Cliente'
        WHEN policyname LIKE '%Profission%' THEN '💼 Profissional'
        WHEN policyname LIKE '%Usuário%' THEN '🔓 Todos Autenticados'
        WHEN policyname LIKE '%Pros%' THEN '💼 Profissional'
    END as quem_pode
FROM pg_policies 
WHERE tablename = 'appointments'
ORDER BY cmd, policyname;

-- 4. MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Limpeza concluída!';
    RAISE NOTICE '✅ Políticas duplicadas removidas';
    RAISE NOTICE '✅ Agora você tem políticas limpas e funcionais';
END $$;

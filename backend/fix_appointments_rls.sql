-- ==========================================================
-- FIX: Políticas RLS para tabela APPOINTMENTS
-- Problema: Operações de UPDATE e DELETE não estavam funcionando
-- Solução: Habilitar RLS e criar políticas corretas
-- ==========================================================

-- 1. HABILITAR RLS NA TABELA APPOINTMENTS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 2. REMOVER POLÍTICAS ANTIGAS (se existirem)
DROP POLICY IF EXISTS "Leitura pública de agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Clientes veem seus agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Profissionais veem agendamentos do salão" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem criar agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Profissionais podem atualizar agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Profissionais podem deletar agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem atualizar seus agendamentos" ON public.appointments;
DROP POLICY IF EXISTS "Clientes podem deletar seus agendamentos" ON public.appointments;

-- 3. CRIAR POLÍTICAS CORRETAS

-- 3.1. SELECT (Leitura)
-- Clientes veem seus próprios agendamentos
CREATE POLICY "Clientes veem seus agendamentos" 
ON public.appointments 
FOR SELECT 
USING (
    auth.uid() = client_id
);

-- Profissionais veem agendamentos do seu salão
CREATE POLICY "Profissionais veem agendamentos do salão" 
ON public.appointments 
FOR SELECT 
USING (
    salon_id IN (
        SELECT salon_id 
        FROM public.professionals 
        WHERE user_id = auth.uid() 
        AND status = 'active'
    )
);

-- 3.2. INSERT (Criação)
-- Qualquer usuário autenticado pode criar agendamentos
CREATE POLICY "Usuários autenticados podem criar agendamentos" 
ON public.appointments 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 3.3. UPDATE (Atualização)
-- Clientes podem atualizar seus próprios agendamentos
CREATE POLICY "Clientes podem atualizar seus agendamentos" 
ON public.appointments 
FOR UPDATE 
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

-- Profissionais podem atualizar agendamentos do seu salão
CREATE POLICY "Profissionais podem atualizar agendamentos do salão" 
ON public.appointments 
FOR UPDATE 
USING (
    salon_id IN (
        SELECT salon_id 
        FROM public.professionals 
        WHERE user_id = auth.uid() 
        AND status = 'active'
    )
)
WITH CHECK (
    salon_id IN (
        SELECT salon_id 
        FROM public.professionals 
        WHERE user_id = auth.uid() 
        AND status = 'active'
    )
);

-- 3.4. DELETE (Exclusão)
-- Clientes podem deletar seus próprios agendamentos
CREATE POLICY "Clientes podem deletar seus agendamentos" 
ON public.appointments 
FOR DELETE 
USING (auth.uid() = client_id);

-- Profissionais podem deletar agendamentos do seu salão
CREATE POLICY "Profissionais podem deletar agendamentos do salão" 
ON public.appointments 
FOR DELETE 
USING (
    salon_id IN (
        SELECT salon_id 
        FROM public.professionals 
        WHERE user_id = auth.uid() 
        AND status = 'active'
    )
);

-- 4. VERIFICAÇÃO (Execute para confirmar que as políticas foram criadas)
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
WHERE tablename = 'appointments'
ORDER BY policyname;

-- 5. MENSAGEM DE SUCESSO
DO $$
BEGIN
    RAISE NOTICE '✅ Políticas RLS para APPOINTMENTS criadas com sucesso!';
    RAISE NOTICE '✅ Agora os profissionais podem UPDATE e DELETE agendamentos do seu salão';
    RAISE NOTICE '✅ Clientes podem gerenciar seus próprios agendamentos';
END $$;

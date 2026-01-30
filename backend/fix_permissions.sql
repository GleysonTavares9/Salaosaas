-- CORREÇÃO DEFINITIVA DE PERMISSÕES SEM RECURSÃO (USANDO FUNÇÃO SECURITY DEFINER)
-- O erro 42P17 (recursão infinita) acontece quando uma política de uma tabela
-- faz uma consulta na própria tabela. Usar uma função com SECURITY DEFINER 
-- resolve isso pois ela roda com privilégios de "sistema", ignorando o RLS 
-- dentro da função.

-- 1. Criar a função de verificação de cargo
CREATE OR REPLACE FUNCTION public.check_is_admin_of_salon(target_salon_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.professionals
    WHERE professionals.salon_id = target_salon_id
    AND professionals.user_id = auth.uid()
    AND professionals.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpar todas as políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Professionals are viewable by everyone" ON professionals;
DROP POLICY IF EXISTS "Admins can register professionals" ON professionals;
DROP POLICY IF EXISTS "Admins can update professionals" ON professionals;
DROP POLICY IF EXISTS "Admins can remove professionals" ON professionals;
DROP POLICY IF EXISTS "Admins can register professionals in their salon" ON professionals;
DROP POLICY IF EXISTS "Admins can update professionals in their salon" ON professionals;
DROP POLICY IF EXISTS "Admins can remove professionals from their salon" ON professionals;
DROP POLICY IF EXISTS "Users can create their professional profile" ON professionals;
DROP POLICY IF EXISTS "Users can update their own professional profile" ON professionals;
DROP POLICY IF EXISTS "Users can delete their own professional profile" ON professionals;

-- 3. Recriar as políticas usando a função de segurança
-- Isso evita que o banco entre em loop ao tentar verificar permissões.

-- SELECT: Todos podem ver
CREATE POLICY "Professionals are viewable by everyone" ON professionals 
FOR SELECT USING (true);

-- INSERT: Próprio usuário OR Admin da unidade
CREATE POLICY "Admins can register professionals" ON professionals 
FOR INSERT TO authenticated 
WITH CHECK (
    auth.uid() = user_id 
    OR 
    public.check_is_admin_of_salon(salon_id)
);

-- UPDATE: Próprio usuário OR Admin da unidade
CREATE POLICY "Admins can update professionals" ON professionals 
FOR UPDATE TO authenticated 
USING (
    auth.uid() = user_id 
    OR 
    public.check_is_admin_of_salon(salon_id)
)
WITH CHECK (
    auth.uid() = user_id 
    OR 
    public.check_is_admin_of_salon(salon_id)
);

-- DELETE: Próprio usuário OR Admin da unidade
CREATE POLICY "Admins can remove professionals" ON professionals 
FOR DELETE TO authenticated 
USING (
    auth.uid() = user_id 
    OR 
    public.check_is_admin_of_salon(salon_id)
);

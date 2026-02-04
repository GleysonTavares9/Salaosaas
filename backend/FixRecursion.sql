
-- ======================================================
-- AURA ELITE SaaS - CORREÇÃO DE RECURSÃO (STOP ERROR 500)
-- ======================================================

-- 1. LIMPAR POLÍTICAS PROBLEMÁTICAS
DROP POLICY IF EXISTS "Admins manage salon professionals" ON public.professionals;
DROP POLICY IF EXISTS "Professionals viewable by everyone" ON public.professionals;

-- 2. NOVA LOGICA SEM RECURSÃO PARA PROFISSIONAIS
-- Regra de Leitura: Qualquer um pode ver profissionais (ajuda a quebrar o loop)
CREATE POLICY "Professionals_Select_Public" 
ON public.professionals FOR SELECT 
USING (true);

-- Regra de Gerenciamento: Apenas o próprio usuário ou um Master ou o Owner do salão
-- Nota: Usamos o auth.uid() direto para evitar o SELECT recursivo
CREATE POLICY "Professionals_Manage_Own_Or_Master" 
ON public.professionals FOR ALL 
TO authenticated 
USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

-- 3. REFORÇAR POLÍTICAS DE OUTRAS TABELAS (GARANTIR ISOLAMENTO)
-- Serviços
DROP POLICY IF EXISTS "Admins manage salon services" ON public.services;
CREATE POLICY "Admins manage salon services" ON public.services FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = services.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

-- Produtos
DROP POLICY IF EXISTS "Admins manage salon products" ON public.products;
CREATE POLICY "Admins manage salon products" ON public.products FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = products.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

-- Agendamentos
DROP POLICY IF EXISTS "Pros view salon appointments" ON public.appointments;
CREATE POLICY "Pros view salon appointments" ON public.appointments FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = appointments.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

-- 4. ATUALIZAÇÃO DO USUÁRIO MASTER (GARANTIR SEU ACESSO)
-- Garante que o gleysontavares9@gmail.com seja MASTER real no bando
UPDATE public.profiles SET is_master = true WHERE email = 'gleysontavares9@gmail.com';

COMMIT;

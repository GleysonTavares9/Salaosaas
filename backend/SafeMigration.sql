
-- ======================================================
-- AURA ELITE SaaS - MIGRAÇÃO SEGURA (SEM APAGAR DADOS)
-- ======================================================

-- 1. ADICIONAR COLUNAS NAS TABELAS EXISTENTES (SE NÃO EXISTIREM)
ALTER TABLE public.salons 
ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'premium')),
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
ADD COLUMN IF NOT EXISTS trial_start_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT (now() + interval '30 days');

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_master boolean DEFAULT false;

-- 2. CRIAR TABELAS DE GESTÃO (SE NÃO EXISTIREM)
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE UNIQUE,
    count integer DEFAULT 0,
    last_reset timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_history (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    plan_charged text NOT NULL,
    payment_status text DEFAULT 'pending',
    payment_method text,
    memo text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. ATUALIZAR FUNÇÕES (CREATE OR REPLACE NÃO APAGA DADOS)
CREATE OR REPLACE FUNCTION public.register_new_salon_and_owner(
    p_user_id UUID,
    p_salon_name TEXT,
    p_segment TEXT,
    p_owner_name TEXT,
    p_slug TEXT,
    p_email TEXT,
    p_logo_url TEXT,
    p_banner_url TEXT,
    p_initial_hours JSONB
)
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_salon_id UUID;
BEGIN
    INSERT INTO public.salons (
        nome, slug_publico, segmento, logo_url, banner_url, horario_funcionamento,
        subscription_plan, subscription_status, trial_ends_at
    ) VALUES (
        p_salon_name, p_slug, p_segment, p_logo_url, p_banner_url, p_initial_hours,
        'pro', 'trialing', now() + interval '30 days'
    ) RETURNING id INTO new_salon_id;

    INSERT INTO public.professionals (
        salon_id, user_id, name, role, email, status, comissao
    ) VALUES (
        new_salon_id, p_user_id, p_owner_name, 'Proprietário', p_email, 'active', 100
    );

    IF NOT EXISTS (SELECT 1 FROM public.ai_usage WHERE salon_id = new_salon_id) THEN
        INSERT INTO public.ai_usage (salon_id, count) VALUES (new_salon_id, 0);
    END IF;

    RETURN new_salon_id;
END;
$$;

-- 4. REFORÇAR SEGURANÇA (RLS) - APENAS ADICIONA AS TRAVAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public salons viewable by everyone" ON public.salons;
CREATE POLICY "Public salons viewable by everyone" ON public.salons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage own salon" ON public.salons;
CREATE POLICY "Admins manage own salon" ON public.salons FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = salons.id AND user_id = auth.uid() AND role = 'Proprietário')
);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage salon professionals" ON public.professionals;
CREATE POLICY "Admins manage salon professionals" ON public.professionals FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals p2 WHERE p2.salon_id = professionals.salon_id AND p2.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage salon services" ON public.services;
CREATE POLICY "Admins manage salon services" ON public.services FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = services.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage salon products" ON public.products;
CREATE POLICY "Admins manage salon products" ON public.products FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = products.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pros view salon appointments" ON public.appointments;
CREATE POLICY "Pros view salon appointments" ON public.appointments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = appointments.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);
DROP POLICY IF EXISTS "Pros update salon appointments" ON public.appointments;
CREATE POLICY "Pros update salon appointments" ON public.appointments FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = appointments.salon_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

-- Liberação de acesso Global para Master
DROP POLICY IF EXISTS "Master access all salons" ON public.salons;
CREATE POLICY "Master access all salons" ON public.salons FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

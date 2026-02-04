
-- ======================================================
-- AURA ELITE SaaS - SCHEMA MESTRE CONSOLIDADO (v1.1)
-- ======================================================

-- Ativa extensão para UUID e Criptografia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABELAS PRINCIPAIS
-- ==========================================

-- SALÕES (TENANTS/UNIDADES)
CREATE TABLE IF NOT EXISTS public.salons (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text NOT NULL,
    slug_publico text NOT NULL UNIQUE,
    segmento text NOT NULL,
    descricao text,
    logo_url text,
    banner_url text,
    endereco text,
    cidade text,
    rating numeric DEFAULT 5.0,
    reviews integer DEFAULT 0,
    telefone text,
    amenities text[] DEFAULT '{}',
    gallery_urls text[] DEFAULT '{}',
    location jsonb DEFAULT '{"lat": -23.55052, "lng": -46.633308}'::jsonb,
    horario_funcionamento jsonb,
    mp_public_key text,
    mp_access_token text,
    paga_no_local boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    
    -- SaaS & Monetização
    subscription_plan text DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'premium')),
    subscription_status text DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
    trial_start_at timestamp with time zone DEFAULT now(),
    trial_ends_at timestamp with time zone DEFAULT (now() + interval '30 days')
);

-- PERFIS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    phone text,
    avatar_url text,
    role text DEFAULT 'client' CHECK (role = ANY (ARRAY['client', 'pro', 'admin'])),
    is_master boolean DEFAULT false, -- Acesso administrativo global
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- PROFISSIONAIS (TIME/ARTISTAS)
CREATE TABLE IF NOT EXISTS public.professionals (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    name text NOT NULL,
    role text,
    image text,
    email text,
    productivity integer DEFAULT 0,
    rating numeric DEFAULT 5.0,
    status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'away'])),
    comissao numeric DEFAULT 30,
    horario_funcionamento jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- SERVIÇOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS public.services (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    name text NOT NULL,
    duration_min integer NOT NULL DEFAULT 30,
    price numeric NOT NULL,
    category text,
    description text,
    image text,
    premium boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- AGENDAMENTOS (AGENDA)
CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
    service_names text,
    valor numeric NOT NULL,
    date date NOT NULL,
    time time without time zone NOT NULL,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['confirmed', 'pending', 'completed', 'canceled'])),
    duration_min integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now()
);

-- PRODUTOS (ESTOQUE/BOUTIQUE)
CREATE TABLE IF NOT EXISTS public.products (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    image text,
    category text,
    stock integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- CHAT (CONVERSAS & MENSAGENS)
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user1_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message text,
    unread_count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    text text NOT NULL,
    timestamp timestamp with time zone DEFAULT now()
);

-- REVIEWS / AVALIAÇÕES
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
    client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT now()
);

-- GALERIA DE FOTOS
CREATE TABLE IF NOT EXISTS public.gallery_items (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    url text NOT NULL,
    category text,
    title text,
    created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 2. TABELAS DE GESTÃO SaaS
-- ==========================================

-- USO DE IA (CONTROLE DE LIMITES)
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE UNIQUE,
    count integer DEFAULT 0,
    last_reset timestamp with time zone DEFAULT now()
);

-- HISTÓRICO DE FATURAMENTO (MONETIZAÇÃO)
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

-- ==========================================
-- 3. FUNÇÕES E SEGURANÇA (RPC & TRIGGERS)
-- ==========================================

-- [NOVO] Função God Mode para Gerir Acesso de Colaboradores
CREATE OR REPLACE FUNCTION public.admin_manage_user_access(p_email TEXT, p_password TEXT, p_full_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_user_id UUID;
    clean_email TEXT := LOWER(TRIM(p_email));
BEGIN
    -- 1. Verifica se já existe na auth.users
    SELECT id INTO new_user_id FROM auth.users WHERE email = clean_email;

    IF new_user_id IS NULL THEN
        -- CRIA USUÁRIO SE NÃO EXISTIR
        INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
        VALUES (
            clean_email,
            extensions.crypt(p_password, extensions.gen_salt('bf')),
            now(),
            jsonb_build_object('name', p_full_name, 'role', 'pro'),
            now(), now(), 'authenticated', 'authenticated'
        ) RETURNING id INTO new_user_id;

        -- Garante a criação da identidade do Supabase
        INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (uuid_generate_v4(), new_user_id, jsonb_build_object('sub', new_user_id, 'email', clean_email), 'email', now(), now(), now());
    ELSE
        -- ATUALIZA SENHA SE JÁ EXISTIR
        UPDATE auth.users 
        SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
            updated_at = now()
        WHERE id = new_user_id;
    END IF;

    RETURN new_user_id;
END;
$$;

-- Função de Registro Mestre (Salão + Proprietário + Trial PRO)
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

    INSERT INTO public.ai_usage (salon_id, count) VALUES (new_salon_id, 0);

    RETURN new_salon_id;
END;
$$;

-- Trigger para sincronização automática de Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. POLÍTICAS DE RLS (SEGURANÇA)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public salons viewable by everyone" ON public.salons FOR SELECT USING (true);
CREATE POLICY "Admins manage own salon" ON public.salons FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = salons.id AND user_id = auth.uid() AND role = 'Proprietário')
);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professionals viewable by everyone" ON public.professionals FOR SELECT USING (true);
CREATE POLICY "Admins manage salon professionals" ON public.professionals FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals p2 WHERE p2.salon_id = professionals.salon_id AND p2.user_id = auth.uid())
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services viewable by everyone" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins manage salon services" ON public.services FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = services.salon_id AND user_id = auth.uid())
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins manage salon products" ON public.products FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = products.salon_id AND user_id = auth.uid())
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Pros view salon appointments" ON public.appointments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = appointments.salon_id AND user_id = auth.uid())
);
CREATE POLICY "Clients create appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Pros update salon appointments" ON public.appointments FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = appointments.salon_id AND user_id = auth.uid())
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view conversation messages" ON public.messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);
CREATE POLICY "Users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view salon AI usage" ON public.ai_usage FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = ai_usage.salon_id AND user_id = auth.uid())
);

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view salon billing" ON public.billing_history FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE salon_id = billing_history.salon_id AND user_id = auth.uid())
);

-- Liberação de acesso para Master (Visão Global)
CREATE POLICY "Master access all salons" ON public.salons FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);
CREATE POLICY "Master access all professionals" ON public.professionals FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);
CREATE POLICY "Master access all appointments" ON public.appointments FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
);

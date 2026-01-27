
-- Ativa extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- LIMPEZA INICIAL (Cuidado: Apaga dados existentes!)
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.gallery_items CASCADE;
DROP TABLE IF EXISTS public.professionals CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.salons CASCADE;

-- 1. TABELA DE SALÕES (TENANTS)
CREATE TABLE public.salons (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome text NOT NULL,
    slug_publico text NOT NULL UNIQUE,
    segmento text NOT NULL,
    descricao text,
    logo_url text,
    banner_url text,
    endereco text,
    cidade text,
    rating numeric DEFAULT 0,
    reviews integer DEFAULT 0,
    telefone text,
    amenities text[], 
    gallery_urls text[], 
    location jsonb,
    horario_funcionamento jsonb,
    mp_public_key text,
    mp_access_token text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT salons_pkey PRIMARY KEY (id)
);

-- 2. TABELA DE PERFIS DE USUÁRIOS (PUBLIC DATA)
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    phone text,
    avatar_url text,
    role text DEFAULT 'client' CHECK (role = ANY (ARRAY['client', 'pro', 'admin'])),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3. TABELA DE SERVIÇOS (RITUAIS)
CREATE TABLE public.services (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    name text NOT NULL,
    duration_min integer NOT NULL DEFAULT 30,
    price numeric NOT NULL,
    category text,
    description text,
    image text,
    premium boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT services_pkey PRIMARY KEY (id)
);

-- 4. TABELA DE PROFISSIONAIS (TIME)
CREATE TABLE public.professionals (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    name text NOT NULL,
    role text,
    image text,
    productivity integer DEFAULT 0,
    rating numeric DEFAULT 0,
    status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'away'])),
    comissao numeric DEFAULT 0,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT professionals_pkey PRIMARY KEY (id)
);

-- 5. TABELA DE AGENDAMENTOS ( AGENDA)
CREATE TABLE public.appointments (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
    service_names text,
    valor numeric NOT NULL,
    date date NOT NULL,
    time text NOT NULL, 
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['confirmed', 'pending', 'completed', 'canceled'])),
    duration_min integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT appointments_pkey PRIMARY KEY (id)
);

-- 6. TABELA DE CONVERSAS (CHAT)
CREATE TABLE public.conversations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user1_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message text,
    unread_count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

-- 7. TABELA DE MENSAGENS (CHAT)
CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    text text NOT NULL,
    timestamp timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_pkey PRIMARY KEY (id)
);

-- 8. TABELA DE GALERIA (GALLERY ITEMS)
CREATE TABLE public.gallery_items (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    url text NOT NULL,
    category text,
    title text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gallery_items_pkey PRIMARY KEY (id)
);

-- 9. TABELA DE PRODUTOS (BOUTIQUE)
CREATE TABLE public.products (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    image text,
    category text,
    stock integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- 10. TABELA DE AVALIAÇÕES (REVIEWS)
CREATE TABLE public.reviews (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
    salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
    professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
    client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_pkey PRIMARY KEY (id)
);

-- FUNÇÕES E TRIGGERS

-- Função para decrementar estoque
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE products
    SET stock = stock - p_qty
    WHERE id = p_id AND stock >= p_qty;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS DE RLS (SEGURANÇA EXTREMA)

ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public salons are viewable by everyone" ON salons FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON salons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for owners" ON salons FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = salons.id 
        AND professionals.user_id = auth.uid()
    )
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own appointments" ON appointments FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Professionals can view salon appointments" ON appointments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = appointments.salon_id 
        AND professionals.user_id = auth.uid()
    )
);

-- STORAGE SETUP (AURA-PUBLIC)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('aura-public', 'aura-public', true) ON CONFLICT (id) DO NOTHING;

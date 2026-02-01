
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
    paga_no_local boolean DEFAULT false,
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
    horario_funcionamento jsonb,
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

-- Trigger para criar profile automaticamente (Robustecido para Aura Elite)
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
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REINICIALIZAÇÃO DE TRIGGERS (Evita erro 500 no Login)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Trigger apenas para INSERT (Criação)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para UPDATE apenas se houver mudança de metadados (Ignora Last Sign In)
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (old.raw_user_meta_data IS DISTINCT FROM new.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- POLÍTICAS DE RLS (SEGURANÇA COMPLETA)
-- ============================================

-- 1. SALÕES
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public salons are viewable by everyone" ON salons FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON salons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for owners and admins" ON salons FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = salons.id 
        AND professionals.user_id = auth.uid()
        AND professionals.role IN ('owner', 'admin')
    )
);

-- 2. PERFIS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = id);


-- 3. SERVIÇOS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are viewable by everyone" ON services FOR SELECT USING (true);
CREATE POLICY "Salon owners can manage services" ON services FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = services.salon_id 
        AND professionals.user_id = auth.uid()
    )
);

-- 4. PROFISSIONAIS (SEM RECURSÃO)
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professionals are viewable by everyone" ON professionals FOR SELECT USING (true);
CREATE POLICY "Users can create their professional profile" ON professionals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own professional profile" ON professionals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own professional profile" ON professionals FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 5. AGENDAMENTOS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own appointments" ON appointments FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Professionals can view salon appointments" ON appointments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = appointments.salon_id 
        AND professionals.user_id = auth.uid()
    )
);
CREATE POLICY "Authenticated users can create appointments" ON appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Professionals can update salon appointments" ON appointments FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = appointments.salon_id 
        AND professionals.user_id = auth.uid()
    )
);

-- 6. CONVERSAS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
);
CREATE POLICY "Authenticated users can create conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
);
CREATE POLICY "Users can update their conversations" ON conversations FOR UPDATE USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
);

-- 7. MENSAGENS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages from their conversations" ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
    )
);
CREATE POLICY "Users can send messages in their conversations" ON messages FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
    )
);

-- 8. GALERIA
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gallery items are viewable by everyone" ON gallery_items FOR SELECT USING (true);
CREATE POLICY "Salon owners can manage gallery" ON gallery_items FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = gallery_items.salon_id 
        AND professionals.user_id = auth.uid()
    )
);

-- 9. PRODUTOS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Salon owners can manage products" ON products FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = products.salon_id 
        AND professionals.user_id = auth.uid()
    )
);

-- 10. AVALIAÇÕES
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for their appointments" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);

-- STORAGE SETUP (AURA-PUBLIC)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('aura-public', 'aura-public', true) ON CONFLICT (id) DO NOTHING;

-- 11. FUNÇÃO ADMINISTRATIVA PARA ACESSOS (AUTORIDADE DO GESTOR)
-- Permite que o administrador do sistema altere e-mail e senha de colaboradores sem que eles precisem confirmar o link de reset.
CREATE OR REPLACE FUNCTION public.admin_update_user_auth(target_user_id UUID, new_email TEXT, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Atualiza e-mail em todas as tabelas vinculadas
  IF new_email IS NOT NULL AND new_email <> '' THEN
    UPDATE auth.users SET email = LOWER(TRIM(new_email)), email_confirmed_at = now() WHERE id = target_user_id;
    UPDATE public.profiles SET email = LOWER(TRIM(new_email)) WHERE id = target_user_id;
    UPDATE public.professionals SET email = LOWER(TRIM(new_email)) WHERE user_id = target_user_id;
  END IF;

  -- Atualiza a senha usando a criptografia nativa do Supabase (pgcrypto)
  IF new_password IS NOT NULL AND new_password <> '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = target_user_id;
  END IF;
END;
$$;

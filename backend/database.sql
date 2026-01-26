
-- Ativa extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- LIMPEZA INICIAL (Cuidado: Apaga dados existentes!)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS gallery_items CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS professionals CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS salons CASCADE;

-- Tabela de Salões (Tenants)
CREATE TABLE salons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    slug_publico TEXT UNIQUE NOT NULL,
    segmento TEXT NOT NULL,
    descricao TEXT,
    logo_url TEXT,
    banner_url TEXT,
    endereco TEXT,
    cidade TEXT,
    rating DECIMAL(2,1) DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    telefone TEXT,
    amenities TEXT[],
    gallery_urls TEXT[],
    location JSONB, -- { lat: number, lng: number }
    horario_funcionamento JSONB, -- { "Segunda": { "open": "09:00", "close": "18:00", "closed": false }, ... }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Perfis de Usuários (Public Data)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('client', 'pro', 'admin')) DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Serviços
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category TEXT,
    description TEXT,
    image TEXT,
    premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Produtos
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT,
    category TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Profissionais
CREATE TABLE professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    image TEXT,
    productivity INTEGER DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'away')) DEFAULT 'active',
    comissao DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Agendamentos
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    client_id UUID REFERENCES auth.users(id),
    professional_id UUID REFERENCES professionals(id),
    service_names TEXT,
    valor DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status TEXT CHECK (status IN ('confirmed', 'pending', 'completed', 'canceled')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Avaliações (Reviews)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id),
    client_id UUID REFERENCES auth.users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Galeria (Gallery Items)
CREATE TABLE gallery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    category TEXT,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Conversas (Chat)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES auth.users(id),
    user2_id UUID REFERENCES auth.users(id),
    last_message TEXT,
    unread_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Mensagens
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- OBS: Para ativar o trigger no Supabase, descomente as linhas abaixo se tiver permissão de superuser/admin
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Políticas de RLS
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public salons are viewable by everyone" ON salons;
CREATE POLICY "Public salons are viewable by everyone" ON salons FOR SELECT USING (true);

-- Allow Authenticated Users to INSERT new salons (Business Setup)
CREATE POLICY "Enable insert for authenticated users only" ON salons FOR INSERT TO authenticated WITH CHECK (true);

-- Allow Owners to UPDATE their salons
CREATE POLICY "Enable update for owners" ON salons FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM professionals 
        WHERE professionals.salon_id = salons.id 
        AND professionals.user_id = auth.uid()
    )
);

-- STORAGE SETUP (aura-public)
INSERT INTO storage.buckets (id, name, public) VALUES ('aura-public', 'aura-public', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'aura-public' );
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'aura-public' );
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'aura-public' );

-- ==========================================
-- LUXE AURA PREMIUM - SCHEMA COMPLETO (v1.2)
-- ==========================================

-- 1. EXTENSÕES ESSENCIAIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Garante que o banco encontre as funções de criptografia e extensões
ALTER DATABASE postgres SET search_path TO "$user", public, extensions;

-- 2. TABELA DE SALÕES (UNIDADES)
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
  amenities text[], -- Array de mimos/serviços inclusos
  gallery_urls text[], -- Array de fotos da galeria
  location jsonb, -- Coordenadas Lat/Lng
  horario_funcionamento jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Campos Financeiros (Critografia manual via código/RPC para evitar triggers lentos)
  mp_public_key text,
  mp_access_token text,
  paga_no_local boolean DEFAULT true,
  
  -- Assinatura e SaaS
  subscription_plan text DEFAULT 'free'::text,
  trial_start_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  subscription_status text DEFAULT 'trialing'::text,
  
  CONSTRAINT salons_pkey PRIMARY KEY (id)
);

-- 3. TABELA DE PERFIS (USUÁRIOS E CLIENTES)
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role text DEFAULT 'client'::text CHECK (role = ANY (ARRAY['client'::text, 'pro'::text, 'admin'::text])),
  is_master boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

-- 4. TABELA DE PROFISSIONAIS (EQUIPE)
CREATE TABLE public.professionals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  role text, -- Ex: Barbeiro, Manicure
  image text,
  productivity integer DEFAULT 0,
  rating numeric DEFAULT 0,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'away'::text])),
  comissao numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  horario_funcionamento jsonb,
  CONSTRAINT professionals_pkey PRIMARY KEY (id)
);

-- 5. TABELA DE SERVIÇOS
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  name text NOT NULL,
  duration_min integer NOT NULL,
  price numeric NOT NULL,
  category text,
  description text,
  image text,
  premium boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT services_pkey PRIMARY KEY (id)
);

-- 6. TABELA DE AGENDAMENTOS
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  client_id uuid REFERENCES public.profiles(id),
  professional_id uuid REFERENCES public.professionals(id),
  service_names text,
  valor numeric NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['confirmed'::text, 'pending'::text, 'completed'::text, 'canceled'::text])),
  duration_min integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (id)
);

-- ==========================================
-- FUNÇÕES ESPECIAIS (BLINDAGEM DO SISTEMA)
-- ==========================================

-- Função Mega Update: Salva tudo do salão ignorando bloqueios de criptografia
CREATE OR REPLACE FUNCTION public.mega_update_salon(p_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_updated_id uuid;
BEGIN
    UPDATE public.salons SET
        nome = COALESCE((p_data->>'nome'), nome),
        slug_publico = COALESCE((p_data->>'slug_publico'), slug_publico),
        segmento = COALESCE((p_data->>'segmento'), segmento),
        descricao = COALESCE((p_data->>'descricao'), descricao),
        telefone = COALESCE((p_data->>'telefone'), telefone),
        endereco = COALESCE((p_data->>'endereco'), endereco),
        cidade = COALESCE((p_data->>'cidade'), cidade),
        paga_no_local = COALESCE((p_data->>'paga_no_local')::boolean, paga_no_local),
        mp_public_key = COALESCE((p_data->>'mp_public_key'), mp_public_key),
        mp_access_token = COALESCE((p_data->>'mp_access_token'), mp_access_token),
        amenities = COALESCE((p_data->'amenities'), amenities),
        gallery_urls = COALESCE((p_data->'gallery_urls'), gallery_urls),
        location = COALESCE((p_data->'location'), location),
        horario_funcionamento = COALESCE((p_data->'horario_funcionamento'), horario_funcionamento),
        updated_at = now()
    WHERE id = p_id RETURNING id INTO v_updated_id;
    RETURN jsonb_build_object('id', v_updated_id, 'status', 'success');
END; $$;

-- Função Pagar no Local: Unifica o botão de pagamento
CREATE OR REPLACE FUNCTION public.set_paga_no_local(p_salon_id uuid, p_value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.salons SET paga_no_local = p_value WHERE id = p_salon_id;
END; $$;

-- ==========================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ==========================================

-- Salões (Leitura pública, Atualização para autenticados)
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública total" ON public.salons FOR SELECT USING (true);
CREATE POLICY "Update para autenticados" ON public.salons FOR UPDATE TO authenticated USING (true);

-- Perfis (LOGIN SEGURO)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visualização de perfis" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Edição de perfis próprios" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Criação de perfis" ON public.profiles FOR INSERT WITH CHECK (true);

-- Profissionais
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura profissionais" ON public.professionals FOR SELECT USING (true);
CREATE POLICY "Gestão profissionais" ON public.professionals FOR ALL TO authenticated USING (true);

-- Permissões Finais
GRANT EXECUTE ON FUNCTION public.mega_update_salon TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_paga_no_local TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

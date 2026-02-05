-- ==========================================================
-- LUXE AURA PREMIUM - SCHEMA FINAL CONSOLIDADO (v3.0)
-- Data: 2026-02-04
-- Contém: Estrutura, Segurança, RPCs Blindadas e Planos
-- ==========================================================

-- 1. EXTENSÕES E CONFIGURAÇÃO
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Forçar search_path seguro
ALTER DATABASE postgres SET search_path TO "$user", public, extensions;

-- 2. TABELAS ESTRUTURAIS

CREATE TABLE public.subscription_plans (
  id text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  period text DEFAULT '/mês'::text,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  blocked_features jsonb DEFAULT '[]'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  highlight boolean DEFAULT false,
  color text DEFAULT 'slate'::text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);

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
  created_at timestamp with time zone DEFAULT now(),
  mp_public_key text,
  mp_access_token text,
  paga_no_local boolean DEFAULT false,
  subscription_plan text DEFAULT 'starter'::text,
  trial_start_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  subscription_status text DEFAULT 'trialing'::text,
  CONSTRAINT salons_pkey PRIMARY KEY (id)
);

CREATE TABLE public.billing_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salon_id uuid REFERENCES public.salons(id),
  amount numeric NOT NULL,
  plan_charged text NOT NULL,
  payment_status text DEFAULT 'pending'::text,
  payment_method text,
  memo text,
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  CONSTRAINT billing_history_pkey PRIMARY KEY (id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role text DEFAULT 'client'::text CHECK (role = ANY (ARRAY['client'::text, 'pro'::text, 'admin'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  is_master boolean DEFAULT false
);

CREATE TABLE public.professionals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  role text,
  image text,
  productivity integer DEFAULT 0,
  rating numeric DEFAULT 0,
  status text DEFAULT 'active'::text,
  comissao numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  horario_funcionamento jsonb,
  CONSTRAINT professionals_pkey PRIMARY KEY (id)
);

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

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image text,
  category text,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  client_id uuid REFERENCES public.profiles(id),
  professional_id uuid REFERENCES public.professionals(id),
  service_names text,
  valor numeric NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  duration_min integer DEFAULT 30,
  CONSTRAINT appointments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  appointment_id uuid REFERENCES public.appointments(id),
  salon_id uuid REFERENCES public.salons(id),
  professional_id uuid REFERENCES public.professionals(id),
  client_id uuid REFERENCES public.profiles(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  month character NOT NULL,
  count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_usage_pkey PRIMARY KEY (id)
);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user1_id uuid REFERENCES auth.users(id),
  user2_id uuid REFERENCES auth.users(id),
  last_message text,
  unread_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES public.conversations(id),
  sender_id uuid REFERENCES auth.users(id),
  text text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.gallery_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  salon_id uuid REFERENCES public.salons(id),
  url text NOT NULL,
  category text,
  title text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gallery_items_pkey PRIMARY KEY (id)
);

-- 3. SEEDING DE DADOS (PLANOS OFICIAIS)
DELETE FROM public.subscription_plans WHERE id = 'free';

INSERT INTO public.subscription_plans (id, name, price, period, description, features, blocked_features, limits, highlight, color, active)
VALUES
(
  'starter', 'Starter', 19.00, '/mês', 'Taxa de Manutenção & Hospedagem',
  '["Acesso ao Sistema", "Agenda Inteligente", "Até 2 Profissionais", "Link de Agendamento", "Suporte Básico"]'::jsonb,
  '["IA Concierge", "Gestão Financeira Completa", "Comissões Automáticas"]'::jsonb,
  '{"max_professionals": 2, "financial_enabled": false, "ai_enabled": false, "max_services": 30, "max_products": 30}'::jsonb,
  false, 'slate', true
),
(
  'pro', 'PRO', 49.00, '/mês', 'Gestão completa do salão',
  '["Profissionais Ilimitados", "Gestão Financeira", "Relatórios Básicos", "Comissões", "IA Limitada"]'::jsonb,
  '[]'::jsonb,
  '{"max_professionals": 999, "financial_enabled": true, "ai_enabled": true, "ai_monthly_limit": 100}'::jsonb,
  true, 'primary', true
),
(
  'premium', 'PREMIUM', 99.00, '/mês', 'Experiência Elite com IA',
  '["Tudo do PRO", "IA Concierge Ilimitada", "Relatórios Avançados", "Clube de Benefícios", "Suporte Prioritário"]'::jsonb,
  '[]'::jsonb,
  '{"max_professionals": 999, "financial_enabled": true, "ai_enabled": true, "ai_monthly_limit": 9999}'::jsonb,
  false, 'gold', true
)
ON CONFLICT (id) DO UPDATE SET 
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

-- 4. FUNÇÕES RPC (BUSINESS LOGIC)

-- 4.1. Faturamento e Limites (Com Fallback e Proteção de Search Path)
CREATE OR REPLACE FUNCTION public.get_salon_billing_info(p_salon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_plan_id text;
    v_subscription_status text;
    v_trial_ends_at timestamptz;
    v_plan_data jsonb;
    v_limits jsonb;
    v_is_trial_active boolean;
BEGIN
    SELECT subscription_plan, subscription_status, trial_ends_at
    INTO v_plan_id, v_subscription_status, v_trial_ends_at
    FROM public.salons WHERE id = p_salon_id;

    IF NOT FOUND THEN RETURN NULL; END IF;

    SELECT to_jsonb(sp.*) INTO v_plan_data FROM public.subscription_plans sp WHERE sp.id = v_plan_id;
    
    IF v_plan_data IS NULL THEN
         SELECT to_jsonb(sp.*) INTO v_plan_data FROM public.subscription_plans sp WHERE sp.id = 'starter';
         v_plan_id := 'starter';
    END IF;

    v_limits := v_plan_data->'limits';
    v_is_trial_active := (v_subscription_status = 'trialing' AND v_trial_ends_at > now());

    RETURN jsonb_build_object(
        'plan_id', v_plan_id,
        'subscription_status', v_subscription_status,
        'trial_ends_at', v_trial_ends_at,
        'is_trial_active', v_is_trial_active,
        'plan_name', v_plan_data->>'name',
        'price', v_plan_data->>'price',
        'limits', v_limits,
        'features', v_plan_data->'features',
        'blocked_features', v_plan_data->'blocked_features'
    );
END;
$function$;

-- 4.2. Atualização de Dados (Mega Update)
CREATE OR REPLACE FUNCTION public.mega_update_salon(p_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- 4.3. Agendamento Inteligente (Timezone Fix & Past Block)
CREATE OR REPLACE FUNCTION public.get_available_slots_rpc(
    p_pro_id uuid,
    p_date date,
    p_duration_min integer,
    p_client_now_min integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_conf jsonb;
    v_day_of_week text;
    v_open_str text;
    v_close_str text;
    v_start_min integer;
    v_end_min integer;
    v_slots text[] := ARRAY[]::text[];
    v_curr_min integer;
    v_slot_str text;
    v_busy_ranges int4range[];
    v_is_today boolean;
    v_timezone text := 'America/Sao_Paulo'; 
BEGIN
    v_day_of_week := CASE extract(isodow from p_date)
        WHEN 1 THEN 'segunda' WHEN 2 THEN 'terca' WHEN 3 THEN 'quarta' WHEN 4 THEN 'quinta'
        WHEN 5 THEN 'sexta' WHEN 6 THEN 'sabado' WHEN 7 THEN 'domingo'
    END;

    SELECT horario_funcionamento INTO v_conf FROM public.professionals WHERE id = p_pro_id;
    IF v_conf IS NULL OR v_conf->v_day_of_week IS NULL THEN
         SELECT s.horario_funcionamento INTO v_conf FROM public.salons s JOIN public.professionals p ON p.salon_id = s.id WHERE p.id = p_pro_id;
    END IF;

    IF v_conf IS NULL OR (v_conf->v_day_of_week->>'closed')::boolean IS TRUE THEN
        RETURN jsonb_build_object('slots', v_slots);
    END IF;

    v_open_str := v_conf->v_day_of_week->>'open';
    v_close_str := v_conf->v_day_of_week->>'close';
    IF v_open_str IS NULL OR v_close_str IS NULL THEN
        RETURN jsonb_build_object('slots', v_slots);
    END IF;

    v_start_min := (split_part(v_open_str, ':', 1)::int * 60) + split_part(v_open_str, ':', 2)::int;
    v_end_min := (split_part(v_close_str, ':', 1)::int * 60) + split_part(v_close_str, ':', 2)::int;

    SELECT array_agg(int4range(
        (extract(hour from time)::int * 60 + extract(minute from time)::int),
        (extract(hour from time)::int * 60 + extract(minute from time)::int + duration_min)
    )) INTO v_busy_ranges
    FROM public.appointments
    WHERE professional_id = p_pro_id AND date = p_date AND status NOT IN ('canceled', 'declined', 'reagendado');

    v_is_today := (p_date = (now() AT TIME ZONE v_timezone)::date);
    IF p_date < (now() AT TIME ZONE v_timezone)::date THEN
         RETURN jsonb_build_object('slots', v_slots);
    END IF;

    v_curr_min := v_start_min;
    WHILE (v_curr_min + p_duration_min) <= v_end_min LOOP
        IF v_is_today AND v_curr_min < p_client_now_min THEN
            v_curr_min := v_curr_min + 30;
            CONTINUE;
        END IF;

        DECLARE
            is_busy boolean := false;
            range_check int4range;
            i int4range;
        BEGIN
            range_check := int4range(v_curr_min, v_curr_min + p_duration_min);
            IF v_busy_ranges IS NOT NULL THEN
                FOREACH i IN ARRAY v_busy_ranges LOOP
                    IF i && range_check THEN is_busy := true; EXIT; END IF;
                END LOOP;
            END IF;
            IF NOT is_busy THEN
                v_slot_str := to_char((v_curr_min || ' minutes')::interval, 'HH24:MI');
                v_slots := array_append(v_slots, v_slot_str);
            END IF;
        END;
        v_curr_min := v_curr_min + 30; 
    END LOOP;
    RETURN jsonb_build_object('slots', v_slots);
END;
$function$;

-- 5. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- 5.1. Salões
DROP POLICY IF EXISTS "Leitura pública total" ON public.salons;
CREATE POLICY "Leitura pública total" ON public.salons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create salons" ON public.salons;
CREATE POLICY "Authenticated users can create salons" ON public.salons FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Update para autenticados" ON public.salons;
CREATE POLICY "Update para autenticados" ON public.salons FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.professionals WHERE professionals.salon_id = salons.id AND professionals.user_id = auth.uid() AND professionals.status = 'active')
);

-- 5.2. Perfis (Login Seguro)
DROP POLICY IF EXISTS "Visualização de perfis" ON public.profiles;
CREATE POLICY "Visualização de perfis" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Edição de perfis próprios" ON public.profiles;
CREATE POLICY "Edição de perfis próprios" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can create profile" ON public.profiles;
CREATE POLICY "Users can create profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 5.3. Faturamento
DROP POLICY IF EXISTS "Ver faturas do próprio salão" ON public.billing_history;
CREATE POLICY "Ver faturas do próprio salão" ON public.billing_history FOR SELECT USING (
  salon_id IN (SELECT salon_id FROM public.professionals WHERE user_id = auth.uid())
);

-- Permissões Gerais
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

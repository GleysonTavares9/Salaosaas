-- Tabela de Planos de Assinatura
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id text PRIMARY KEY, -- 'free', 'pro', 'premium'
    name text NOT NULL,
    price numeric(10,2) NOT NULL DEFAULT 0,
    period text DEFAULT '/mês',
    description text,
    features jsonb DEFAULT '[]'::jsonb, -- Lista de funcionalidades inclusas
    blocked_features jsonb DEFAULT '[]'::jsonb, -- Lista de funcionalidades bloqueadas (visual)
    limits jsonb DEFAULT '{}'::jsonb, -- Limites técnicos (max_professionals, ai_enabled, etc)
    highlight boolean DEFAULT false,
    color text DEFAULT 'slate',
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS (Leitura pública, Escrita apenas Admin)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planos visíveis para todos" ON public.subscription_plans
    FOR SELECT USING (active = true);

-- Inserir Planos Iniciais (Baseado no código atual)
INSERT INTO public.subscription_plans (id, name, price, description, features, blocked_features, limits, color, highlight)
VALUES
('free', 'Gratuito', 0.00, 'Essencial para começar', 
 '["Até 2 profissionais", "Agenda completa", "Página pública", "Agendamentos ilimitados"]'::jsonb,
 '["IA Concierge", "Gestão Financeira", "Relatórios", "Comissões"]'::jsonb,
 '{"max_professionals": 2, "ai_enabled": false, "financial_enabled": false}'::jsonb,
 'slate', false),

('pro', 'PRO', 49.00, 'Gestão completa do salão',
 '["Profissionais ilimitados", "Gestão financeira", "Relatórios básicos", "Comissões", "IA limitada"]'::jsonb,
 '[]'::jsonb,
 '{"max_professionals": 999, "ai_enabled": true, "financial_enabled": true, "ai_monthly_limit": 100}'::jsonb,
 'primary', true),

('premium', 'PREMIUM', 99.00, 'Escala e inteligência',
 '["IA avançada", "Insights automáticos", "Relatórios detalhados", "Suporte prioritário", "Marca personalizada"]'::jsonb,
 '[]'::jsonb,
 '{"max_professionals": 999, "ai_enabled": true, "financial_enabled": true, "ai_monthly_limit": 500}'::jsonb,
 'purple', false)
ON CONFLICT (id) DO UPDATE SET
    price = EXCLUDED.price,
    features = EXCLUDED.features,
    blocked_features = EXCLUDED.blocked_features,
    limits = EXCLUDED.limits;

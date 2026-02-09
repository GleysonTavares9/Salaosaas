-- ==========================================================
-- LUXE AURA PREMIUM - ATUALIZAÇÃO DE SCHEMA IA
-- Adiciona colunas de configuração da Aura na tabela salons
-- ==========================================================

-- 1. Adicionar colunas de configuração
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS ai_promo_text TEXT DEFAULT 'Olá! Se agendar agora, posso verificar um mimo especial para você. ✨';
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS ai_promo_discount NUMERIC DEFAULT 0;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS ai_voice_tone TEXT DEFAULT 'elegant';

-- 2. Garantir que as colunas sejam acessíveis
-- (O RLS já cobre SELECT * e UPDATE para donos de salão)

-- 3. Mock de dados para o seu salão (Opcional, mas ajuda a ver se está funcionando)
-- UPDATE public.salons SET ai_enabled = true WHERE slug_publico = 'seu-slug'; 

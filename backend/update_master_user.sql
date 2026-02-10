-- Script para conceder acesso MASTER ao usuário informado
-- Execute este comando no SQL Editor do seu Dashboard Supabase

UPDATE public.profiles 
SET is_master = true, role = 'admin'
WHERE id = 'f55164f2-1870-4b3c-b54a-ee796c8f1a50';

-- Verificação:
SELECT id, email, full_name, role, is_master 
FROM public.profiles 
WHERE id = 'f55164f2-1870-4b3c-b54a-ee796c8f1a50';

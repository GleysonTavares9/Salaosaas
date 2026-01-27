-- ============================================
-- LIMPEZA E CORREÇÃO DE SALÕES
-- ============================================

-- 1. VER COORDENADAS DOS SALÕES
SELECT 
    nome,
    cidade,
    slug_publico,
    location,
    created_at
FROM salons
ORDER BY created_at DESC;

-- 2. DELETAR SALÕES DUPLICADOS (MANTER APENAS O MAIS RECENTE)
-- Deletar os 5 salões mais antigos do GRACIELLE CARVALHO BEAUTY
DELETE FROM salons 
WHERE id IN (
    'e84cc704-1ac4-4cad-8093-b5ddea0edef9',
    'e68125cd-eaf0-45e4-bec4-036373521451',
    '053cf654-e5d3-463f-a0ad-3877fce550ad',
    '747ecb58-2c27-4688-ba2f-d04ba4534335',
    '4616307b-93a7-4a8b-bf75-a6581e848458'
);

-- 3. ATUALIZAR COORDENADAS DO GRACIELLE CARVALHO BEAUTY
-- Santa Luzia - MG (próximo ao centro)
UPDATE salons 
SET location = '{"lat": -19.7697, "lng": -43.8512}'::jsonb,
    endereco = 'Rua Prefeito Oswaldo Pieruccetti, 400'
WHERE id = 'bab43a3f-1ccc-4de0-801a-0cac534ad5a9';

-- 4. ATUALIZAR COORDENADAS DO CALADINHO DU CORTE
-- Santa Luzia - MG (outro ponto)
UPDATE salons 
SET location = '{"lat": -19.7650, "lng": -43.8480}'::jsonb,
    endereco = 'Av. Brasília, 1500'
WHERE id = 'd4a765fc-8ae5-49a1-a3b2-c1a3c2504b6f';

-- 5. VERIFICAR RESULTADO FINAL
SELECT 
    nome,
    cidade,
    endereco,
    location->>'lat' as latitude,
    location->>'lng' as longitude
FROM salons
ORDER BY created_at DESC;

-- 6. CONTAR SALÕES FINAIS
SELECT COUNT(*) as total_saloes FROM salons;

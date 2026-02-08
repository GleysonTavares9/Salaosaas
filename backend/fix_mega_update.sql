-- ==========================================================
-- FIX: Mega Update e Limpeza de Duplicados
-- ==========================================================

-- 1. Corrigir a RPC mega_update_salon para lidar com arrays JSON
CREATE OR REPLACE FUNCTION public.mega_update_salon(p_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_updated_id uuid;
    v_amenities text[];
    v_gallery text[];
BEGIN
    -- Converter arrays JSON para arrays PostgreSQL
    IF p_data ? 'amenities' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(p_data->'amenities')) INTO v_amenities;
    END IF;
    
    IF p_data ? 'gallery_urls' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(p_data->'gallery_urls')) INTO v_gallery;
    END IF;

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
        amenities = COALESCE(v_amenities, amenities),
        gallery_urls = COALESCE(v_gallery, gallery_urls),
        location = COALESCE((p_data->'location'), location),
        horario_funcionamento = COALESCE((p_data->'horario_funcionamento'), horario_funcionamento)
    WHERE id = p_id RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Salão não encontrado');
    END IF;

    RETURN jsonb_build_object('id', v_updated_id, 'status', 'success');
END; $$;

-- 2. Limpeza de possíveis slugs duplicados (Garante unicidade)
-- Se houver salões "fantasmas" sem profissionais vinculados, removemos eles
DELETE FROM public.salons 
WHERE id NOT IN (SELECT DISTINCT salon_id FROM public.professionals WHERE salon_id IS NOT NULL)
  AND created_at < now() - interval '5 minutes';

-- 3. Caso o slug ainda conflite, este comando ajuda a identificar quem é o dono do slug
-- SELECT id, nome FROM public.salons WHERE slug_publico = 'seu-slug-aqui';

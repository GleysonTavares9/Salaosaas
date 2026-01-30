
-- 1. FUNÇÃO ATÔMICA PARA REGISTRO DE PARCEIRO (Resolve problemas de RLS/Auth Sync)
-- Esta função roda como 'security definer' (privilégios de admin) para garantir que o registro
-- ocorra mesmo que o usuário ainda não tenha sessão ativa (devido à confirmação de e-mail).

CREATE OR REPLACE FUNCTION public.register_new_salon_and_owner(
    p_user_id UUID,
    p_salon_name TEXT,
    p_segment TEXT,
    p_owner_name TEXT,
    p_slug TEXT,
    p_email TEXT,
    p_logo_url TEXT,
    p_banner_url TEXT,
    p_initial_hours JSONB
)
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_salon_id UUID;
BEGIN
    -- 1. Cria o Salão
    INSERT INTO public.salons (
        nome, 
        slug_publico, 
        segmento, 
        descricao, 
        logo_url, 
        banner_url, 
        horario_funcionamento,
        location,
        rating,
        reviews
    ) VALUES (
        p_salon_name, 
        p_slug, 
        p_segment, 
        'Seja bem-vindo ao ' || p_salon_name || '!',
        p_logo_url, 
        p_banner_url, 
        p_initial_hours,
        '{"lat": -23.55052, "lng": -46.633308}'::jsonb, -- Coordenadas padrão (SP)
        5.0,
        0
    ) RETURNING id INTO new_salon_id;

    -- 2. Cria o registro de Profissional (Dono)
    INSERT INTO public.professionals (
        salon_id,
        user_id,
        name,
        role,
        image,
        email,
        status,
        comissao,
        rating,
        productivity
    ) VALUES (
        new_salon_id,
        p_user_id,
        p_owner_name,
        'Proprietário',
        'https://ui-avatars.com/api/?name=' || encode(convert_to(p_owner_name, 'UTF8'), 'escape') || '&background=0c0d10&color=c1a571&bold=true',
        p_email,
        'active',
        100,
        5.0,
        0
    );

    RETURN new_salon_id;
END;
$$;

-- Garantir que qualquer usuário (mesmo anon) possa chamar a função de registro
GRANT EXECUTE ON FUNCTION public.register_new_salon_and_owner TO anon, authenticated;
